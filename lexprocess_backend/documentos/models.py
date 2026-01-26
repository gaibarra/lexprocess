# documentos/models.py
from django.db import models
import uuid
from casos.models import Caso
from django.conf import settings

# --- DEFINICIÓN DE CHOICES PRIMERO ---
class TipoDocumentoChoices(models.TextChoices):
    DEMANDA = 'DEMANDA', 'Demanda'
    CONTESTACION = 'CONTESTACION', 'Contestación'
    PRUEBA = 'PRUEBA', 'Prueba Documental'
    SENTENCIA = 'SENTENCIA', 'Sentencia'
    RESOLUCION = 'RESOLUCION', 'Resolución Judicial'
    ESCRITO_TRAMITE = 'ESCRITO_TRAMITE', 'Escrito de Trámite'
    NOTIFICACION = 'NOTIFICACION', 'Notificación'
    RECURSO = 'RECURSO', 'Recurso'
    INFORME_PERICIAL = 'INFORME_PERICIAL', 'Informe Pericial'
    OTRO = 'OTRO', 'Otro'

class ProcessingStatus(models.TextChoices): # <-- MOVIDO AQUÍ ARRIBA
    PENDIENTE = 'PENDIENTE', 'Pendiente'
    PROCESANDO = 'PROCESANDO', 'Procesando'
    PROCESADO = 'PROCESADO', 'Procesado'
    ERROR = 'ERROR', 'Error'

# --- FUNCIÓN HELPER ---
def ruta_archivo_documento(instance, filename):
    return f'casos/{instance.caso.id}/{instance.id}_{filename}'

# --- MODELO PRINCIPAL ---
class Documento(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    caso = models.ForeignKey(Caso, on_delete=models.CASCADE, related_name='documentos')
    nombre_documento = models.CharField(max_length=255, help_text="Nombre descriptivo del documento.")
    archivo = models.FileField(upload_to=ruta_archivo_documento)
    
    tipo_documento = models.CharField(
        max_length=50, 
        choices=TipoDocumentoChoices.choices, 
        default=TipoDocumentoChoices.OTRO,
        blank=True, null=True
    )
    
    fecha_documento = models.DateField(blank=True, null=True, help_text="Fecha que figura en el documento (ej: fecha de la sentencia).")
    fecha_carga = models.DateTimeField(auto_now_add=True)
    cargado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, blank=True,
        related_name='documentos_cargados'
    )
    
    descripcion = models.TextField(blank=True, null=True)
    metadatos_ia = models.JSONField(blank=True, null=True, help_text="Metadatos extraídos por IA (clasificación, entidades, resumen, etc.)")
    openai_file_id = models.CharField(max_length=100, blank=True, null=True, help_text="ID del archivo en OpenAI si se subió para RAG.")
    texto_extraido = models.TextField(blank=True, null=True, help_text="Texto extraído del documento (si aplica y se procesó).")

    # --- CAMPOS NUEVOS ---
    processing_status = models.CharField(
        max_length=20,
        choices=ProcessingStatus.choices, # <-- Ahora funciona
        default=ProcessingStatus.PENDIENTE
    )
    processing_error = models.TextField(blank=True, null=True, help_text="Detalles del error si el procesamiento falló.")


    def __str__(self):
        return self.nombre_documento or f"Documento {self.id} de caso {self.caso.id}"

    class Meta:
        ordering = ['-fecha_carga']
        verbose_name = "Documento"
        verbose_name_plural = "Documentos"