# casos/models.py
from django.db import models
import uuid
from django.conf import settings # Para ForeignKey a UserProfile o User
from despachos.models import Despacho

class TipoProcesoChoices(models.TextChoices):
    CIVIL = 'CIVIL', 'Civil'
    PENAL = 'PENAL', 'Penal'
    LABORAL = 'LABORAL', 'Laboral'
    ADMINISTRATIVO = 'ADMINISTRATIVO', 'Administrativo'
    MERCANTIL = 'MERCANTIL', 'Mercantil'
    FAMILIAR = 'FAMILIAR', 'Familiar'
    OTRO = 'OTRO', 'Otro'

class EstadoCasoChoices(models.TextChoices):
    ACTIVO = 'ACTIVO', 'Activo'
    EN_TRAMITE = 'EN_TRAMITE', 'En Trámite'
    SUSPENDIDO = 'SUSPENDIDO', 'Suspendido'
    ARCHIVADO = 'ARCHIVADO', 'Archivado'
    FINALIZADO = 'FINALIZADO', 'Finalizado'

class Cliente(models.Model): # Modelo simple para cliente, podría expandirse
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    nombre_completo = models.CharField(max_length=255)
    email = models.EmailField(blank=True, null=True)
    telefono = models.CharField(max_length=20, blank=True, null=True)
    despacho = models.ForeignKey(Despacho, on_delete=models.CASCADE, related_name='clientes')

    def __str__(self):
        return self.nombre_completo

class Caso(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    despacho = models.ForeignKey(Despacho, on_delete=models.CASCADE, related_name='casos')
    nombre_caso = models.CharField(max_length=255, help_text="Nombre descriptivo o identificador interno del caso.")
    numero_expediente = models.CharField(max_length=100, blank=True, null=True, help_text="Número de expediente oficial del juzgado/tribunal.")
    # unique_together = ('despacho', 'numero_expediente') # Considerar si el numero_expediente debe ser único por despacho
    
    tipo_proceso = models.CharField(max_length=50, choices=TipoProcesoChoices.choices, default=TipoProcesoChoices.OTRO)
    juzgado_tribunal = models.CharField(max_length=255, blank=True, null=True)
    
    cliente = models.ForeignKey(Cliente, on_delete=models.SET_NULL, null=True, blank=True, related_name='casos')
    # O si prefieres un CharField para empezar:
    # nombre_cliente = models.CharField(max_length=255, blank=True, null=True)

    # Usar UserProfile de tu app 'users'
    abogado_asignado = models.ForeignKey(
        settings.AUTH_USER_MODEL, # Esto apunta a django.contrib.auth.models.User
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='casos_asignados',
        limit_choices_to={'profile__isnull': False} # Asegurar que solo usuarios con perfil puedan ser asignados
    )
    
    estado_caso = models.CharField(max_length=50, choices=EstadoCasoChoices.choices, default=EstadoCasoChoices.ACTIVO)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)
    descripcion_breve = models.TextField(blank=True, null=True)
    
    openai_thread_id = models.CharField(max_length=100, blank=True, null=True, help_text="ID del Thread de OpenAI Assistants para este caso.")

    def __str__(self):
        return f"{self.nombre_caso} ({self.numero_expediente or 'Sin Exp.'})"

    class Meta:
        ordering = ['-fecha_creacion']
        verbose_name = "Caso"
        verbose_name_plural = "Casos"
        constraints = [
            models.UniqueConstraint(fields=['despacho', 'numero_expediente'], name='unique_expediente_por_despacho', condition=models.Q(numero_expediente__isnull=False) & ~models.Q(numero_expediente=''))
        ]

class ParteProcesal(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    caso = models.ForeignKey(Caso, on_delete=models.CASCADE, related_name='partes_procesales')
    nombre = models.CharField(max_length=255)
    rol_en_proceso = models.CharField(max_length=100, help_text="Ej: Demandante, Demandado, Coadyuvante") # Podría ser un TextChoices
    # Más detalles: DNI/CIF, dirección, abogado representante, etc.

    def __str__(self):
        return f"{self.nombre} ({self.rol_en_proceso}) en caso {self.caso.id}"