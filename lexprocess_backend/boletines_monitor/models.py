from django.db import models
import uuid
from casos.models import Caso

class OrigenBoletin(models.TextChoices):
    SISE = 'SISE', 'PJF - SISE (Federal)'
    CDMX = 'CDMX', 'TSJCDMX (Local)'
    ESTADO_MEXICO = 'EDOMEX', 'PJEDOMEX (Local)'

class PublicacionFiltro(models.Model):
    """Define qué expedientes estamos monitoreando por despacho/usuario."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    caso = models.ForeignKey(Caso, on_delete=models.CASCADE, related_name='filtros_boletin')
    numero_expediente = models.CharField(max_length=100)
    origen = models.CharField(max_length=20, choices=OrigenBoletin.choices)
    ultimo_acuerdo_visto = models.CharField(max_length=255, blank=True, null=True)

    def __str__(self):
        return f"Monitoreo {self.origen} - {self.numero_expediente}"

class NotificacionBoletin(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    caso = models.ForeignKey(Caso, on_delete=models.CASCADE, related_name='notificaciones_boletin')
    fecha_publicacion = models.DateField()
    resumen_acuerdo = models.TextField()
    contenido_completo = models.TextField(blank=True, null=True)
    origen = models.CharField(max_length=20, choices=OrigenBoletin.choices)
    revisado = models.BooleanField(default=False)
    
    # Sugerencias de la IA basadas en el acuerdo
    sugerencia_workflow_paso = models.CharField(max_length=255, blank=True, null=True)
    sugerencia_plazo_dias = models.IntegerField(null=True, blank=True)
    explicacion_ia = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"{self.fecha_publicacion} - {self.caso.numero_expediente} ({self.origen})"

    class Meta:
        ordering = ['-fecha_publicacion']
