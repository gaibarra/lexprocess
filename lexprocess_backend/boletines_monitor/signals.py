from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from api_v1.serializers import NotificacionBoletinSerializer
from .models import NotificacionBoletin


def _get_recipients(notificacion):
    recipients = set()
    caso = notificacion.caso
    if caso.abogado_asignado and caso.abogado_asignado.email:
        recipients.add(caso.abogado_asignado.email)
    despacho = caso.despacho
    if despacho:
        for profile in despacho.miembros.select_related('user').all():
            if profile.user.email:
                recipients.add(profile.user.email)
    return list(recipients)


def _send_email_notification(notificacion):
    if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
        return
    recipients = _get_recipients(notificacion)
    if not recipients:
        return
    subject = f"[LexProcess] Nuevo boletín: {notificacion.caso.nombre_caso}"
    body = (
        f"Caso: {notificacion.caso.nombre_caso}\n"
        f"Expediente: {notificacion.caso.numero_expediente or 'Sin expediente'}\n"
        f"Origen: {notificacion.get_origen_display()}\n"
        f"Fecha: {notificacion.fecha_publicacion}\n\n"
        f"Resumen:\n{notificacion.resumen_acuerdo}\n"
    )
    send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, recipients, fail_silently=True)


def _send_ws_notification(notificacion):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
    payload = NotificacionBoletinSerializer(notificacion).data
    group_name = f"boletines_despacho_{notificacion.caso.despacho_id}"
    async_to_sync(channel_layer.group_send)(
        group_name,
        {"type": "boletin.notificacion", "payload": payload},
    )


def _dispatch_notifications(notificacion_id):
    notificacion = (
        NotificacionBoletin.objects.select_related(
            'caso',
            'caso__despacho',
            'caso__abogado_asignado',
        )
        .get(id=notificacion_id)
    )
    _send_ws_notification(notificacion)
    _send_email_notification(notificacion)


@receiver(post_save, sender=NotificacionBoletin)
def notify_on_notificacion(sender, instance, created, **kwargs):
    if not created:
        return
    transaction.on_commit(lambda: _dispatch_notifications(instance.id))
