# ia_integration/models.py
from django.db import models
import uuid
from casos.models import Caso
from django.conf import settings

class APIUtilizadaChoices(models.TextChoices):
    OPENAI_ASSISTANT = 'OPENAI_ASSISTANT', 'OpenAI Assistants API'
    OPENAI_GENERAL = 'OPENAI_GENERAL', 'OpenAI API (General)'
    DEEPSEEK = 'DEEPSEEK', 'Deepseek API'
    PERPLEXITY = 'PERPLEXITY', 'Perplexity AI API'
    OTRA = 'OTRA', 'Otra API'

class InteraccionIA(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Puede estar asociado a un caso, o ser una interacción general
    caso = models.ForeignKey(Caso, on_delete=models.SET_NULL, null=True, blank=True, related_name='interacciones_ia')
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, # Puede ser una interacción del sistema
        related_name='interacciones_ia'
    )
    
    timestamp = models.DateTimeField(auto_now_add=True)
    api_utilizada = models.CharField(max_length=50, choices=APIUtilizadaChoices.choices)
    
    prompt_enviado = models.TextField(blank=True, null=True)
    respuesta_recibida = models.TextField(blank=True, null=True)
    archivos_adjuntos_prompt = models.JSONField(blank=True, null=True, help_text="IDs de archivos enviados en el prompt, ej: OpenAI file_ids")
    
    costo_aproximado = models.DecimalField(max_digits=10, decimal_places=6, null=True, blank=True)
    duracion_ms = models.PositiveIntegerField(null=True, blank=True, help_text="Duración de la llamada a la API en milisegundos")
    
    referencia_externa_id = models.CharField(max_length=100, blank=True, null=True, help_text="Ej: thread_id, run_id, message_id de OpenAI")
    metadatos_adicionales = models.JSONField(blank=True, null=True, help_text="Cualquier otro metadato relevante de la interacción")
    exitoso = models.BooleanField(default=True)
    error_info = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Interacción IA ({self.get_api_utilizada_display()}) el {self.timestamp.strftime('%Y-%m-%d %H:%M')}"

    class Meta:
        ordering = ['-timestamp']
        verbose_name = "Interacción IA"
        verbose_name_plural = "Interacciones IA"