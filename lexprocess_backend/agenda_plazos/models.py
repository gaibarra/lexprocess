# agenda_plazos/models.py
from django.db import models
import uuid
from casos.models import Caso
from django.conf import settings

class TipoEventoAgenda(models.TextChoices):
    PLAZO_PROCESAL = 'PLAZO_PROCESAL', 'Plazo Procesal'
    AUDIENCIA = 'AUDIENCIA', 'Audiencia'
    REUNION_CLIENTE = 'REUNION_CLIENTE', 'Reunión con Cliente'
    TAREA_INTERNA = 'TAREA_INTERNA', 'Tarea Interna'
    OTRO = 'OTRO', 'Otro'

class Plazo(models.Model): # Renombrado de PlazoProcesal a Plazo para ser más genérico
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    caso = models.ForeignKey(Caso, on_delete=models.CASCADE, related_name='plazos_agenda')
    
    titulo = models.CharField(max_length=255)
    descripcion = models.TextField(blank=True, null=True)
    tipo_evento = models.CharField(max_length=50, choices=TipoEventoAgenda.choices, default=TipoEventoAgenda.PLAZO_PROCESAL)
    
    fecha_hora_vencimiento = models.DateTimeField(help_text="Fecha y hora límite o del evento.")
    responsable = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, blank=True,
        related_name='plazos_responsable'
    )
    
    completado = models.BooleanField(default=False)
    fecha_completado = models.DateTimeField(null=True, blank=True)
    
    # Para recordatorios
    recordatorio_activo = models.BooleanField(default=True)
    dias_antes_recordatorio = models.PositiveIntegerField(default=1, null=True, blank=True, help_text="Días antes del vencimiento para enviar recordatorio.")
    recordatorio_enviado = models.BooleanField(default=False)

    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.get_tipo_evento_display()}: {self.titulo} - {self.caso.nombre_caso}"

    class Meta:
        ordering = ['fecha_hora_vencimiento']
        verbose_name = "Plazo o Evento de Agenda"
        verbose_name_plural = "Plazos y Eventos de Agenda"