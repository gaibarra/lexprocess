# documentos/tasks.py
import fitz  # PyMuPDF
import docx
import os
from celery import shared_task
from django.db import transaction
from .models import Documento, ProcessingStatus

def _extraer_texto_pdf(filepath):
    """Función helper para extraer texto de un archivo PDF."""
    texto_completo = ""
    with fitz.open(filepath) as doc:
        for page in doc:
            texto_completo += page.get_text()
    return texto_completo

def _extraer_texto_docx(filepath):
    """Función helper para extraer texto de un archivo DOCX."""
    doc = docx.Document(filepath)
    parrafos = [p.text for p in doc.paragraphs]
    return "\n".join(parrafos)

@shared_task(bind=True, max_retries=3, default_retry_delay=60) # Permite reintentos
def extract_text_from_document(self, documento_id):
    """
    Tarea de Celery para extraer texto de un documento subido.
    """
    try:
        # Usamos transaction.atomic para asegurar la consistencia
        with transaction.atomic():
            # Bloqueamos el objeto para evitar condiciones de carrera
            documento = Documento.objects.select_for_update().get(id=documento_id)

            if documento.processing_status != ProcessingStatus.PENDIENTE:
                # Si ya está siendo procesado o ya fue procesado, no hacer nada.
                return f"El documento {documento_id} ya no está pendiente. Estado actual: {documento.processing_status}"
            
            # Marcamos como PROCESANDO
            documento.processing_status = ProcessingStatus.PROCESANDO
            documento.save(update_fields=['processing_status'])

    except Documento.DoesNotExist:
        # El documento fue borrado antes de que la tarea se ejecutara.
        return f"Documento con ID {documento_id} no encontrado. No se procesará."

    try:
        filepath = documento.archivo.path
        ext = os.path.splitext(filepath)[1].lower()
        texto_extraido = ""

        if ext == '.pdf':
            texto_extraido = _extraer_texto_pdf(filepath)
        elif ext == '.docx':
            texto_extraido = _extraer_texto_docx(filepath)
        elif ext == '.txt':
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as fh:
                texto_extraido = fh.read()
        else:
            # Si la extensión no es soportada, marcamos como error.
            raise ValueError(f"Extensión de archivo no soportada: {ext}")
            
        # Actualizamos el documento con el texto y el estado final
        documento.texto_extraido = texto_extraido
        documento.processing_status = ProcessingStatus.PROCESADO
        documento.processing_error = None # Limpiar errores previos
        documento.save(update_fields=['texto_extraido', 'processing_status', 'processing_error'])

        return f"Texto extraído exitosamente del documento {documento_id}."

    except Exception as exc:
        # Si ocurre cualquier error durante la extracción, lo registramos.
        documento.processing_status = ProcessingStatus.ERROR
        documento.processing_error = str(exc)
        documento.save(update_fields=['processing_status', 'processing_error'])
        
        # Reintentar la tarea si es un error potencialmente transitorio
        self.retry(exc=exc)
        return f"Falló la extracción de texto para el documento {documento_id}. Error: {exc}"