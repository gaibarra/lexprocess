from django.db import models
import uuid

class Jurisdiccion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.nombre

    class Meta:
        verbose_name = "Jurisdicción"
        verbose_name_plural = "Jurisdicciones"

class DiaInhabil(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fecha = models.DateField()
    jurisdiccion = models.ForeignKey(Jurisdiccion, on_delete=models.CASCADE, related_name='dias_inhabiles')
    motivo = models.CharField(max_length=255, blank=True, null=True)
    es_suspension_extraordinaria = models.BooleanField(default=False, help_text="Si es una suspensión no programada (ej. huelga, desastre natural)")

    def __str__(self):
        return f"{self.fecha} - {self.jurisdiccion.nombre} ({self.motivo})"

    class Meta:
        unique_together = ('fecha', 'jurisdiccion')
        verbose_name = "Día Inhábil"
        verbose_name_plural = "Días Inhábiles"
        ordering = ['-fecha']
