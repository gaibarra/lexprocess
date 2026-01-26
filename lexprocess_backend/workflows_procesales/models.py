from django.db import models
import uuid
from casos.models import Caso

class WorkflowPlantilla(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre = models.CharField(max_length=255, help_text="Ej: Amparo Indirecto, Juicio Civil Ordinario")
    descripcion = models.TextField(blank=True, null=True)
    activo = models.BooleanField(default=True)

    def __str__(self):
        return self.nombre

class EtapaPlantilla(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow = models.ForeignKey(WorkflowPlantilla, on_delete=models.CASCADE, related_name='etapas')
    nombre = models.CharField(max_length=255, help_text="Ej: Demanda, Audiencia Incidental, Sentencia")
    orden = models.PositiveIntegerField(default=0)
    dias_termino_sugerido = models.PositiveIntegerField(null=True, blank=True, help_text="Días para el siguiente hito")
    
    def __str__(self):
        return f"{self.workflow.nombre} - {self.nombre}"

    class Meta:
        ordering = ['orden']

class WorkflowInstancia(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    caso = models.OneToOneField(Caso, on_delete=models.CASCADE, related_name='workflow')
    plantilla = models.ForeignKey(WorkflowPlantilla, on_delete=models.PROTECT)
    fecha_inicio = models.DateTimeField(auto_now_add=True)
    etapa_actual = models.ForeignKey(EtapaPlantilla, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"Workflow para {self.caso.nombre_caso} ({self.plantilla.nombre})"

class HitoProcesal(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workflow_instancia = models.ForeignKey(WorkflowInstancia, on_delete=models.CASCADE, related_name='hitos')
    etapa = models.ForeignKey(EtapaPlantilla, on_delete=models.CASCADE)
    fecha_cumplimiento = models.DateTimeField(null=True, blank=True)
    completado = models.BooleanField(default=False)
    notas = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Hito {self.etapa.nombre} para {self.workflow_instancia.caso.nombre_caso}"
