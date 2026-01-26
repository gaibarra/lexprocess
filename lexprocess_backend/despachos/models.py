from django.db import models

# Create your models here.
# despachos/models.py
from django.db import models
import uuid

class Despacho(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre = models.CharField(max_length=255, unique=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    openai_assistant_id = models.CharField(max_length=100, blank=True, null=True, help_text="ID del Assistant de OpenAI para este despacho")

    def __str__(self):
        return self.nombre

    class Meta:
        verbose_name = "Despacho"
        verbose_name_plural = "Despachos"