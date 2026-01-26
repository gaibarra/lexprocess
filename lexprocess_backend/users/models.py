# users/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models
import uuid
from despachos.models import Despacho # Importar Despacho

# Si no vas a extender AbstractUser, sino usar OneToOneField:
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


class RolUsuario(models.TextChoices):
    ABOGADO = 'ABOGADO', 'Abogado'
    ADMINISTRADOR = 'ADMINISTRADOR', 'Administrador de Despacho'
    PARALEGAL = 'PARALEGAL', 'Paralegal'
    # Añadir más roles según sea necesario


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, primary_key=True, related_name='profile')
    despacho = models.ForeignKey(Despacho, on_delete=models.SET_NULL, null=True, blank=True, related_name='miembros')
    rol = models.CharField(max_length=50, choices=RolUsuario.choices, default=RolUsuario.ABOGADO)
    telefono = models.CharField(max_length=20, blank=True, null=True)
    # openai_assistant_id específico del usuario si la lógica lo requiere,
    # pero priorizamos el del despacho.
    # openai_user_assistant_id = models.CharField(max_length=100, blank=True, null=True, help_text="ID del Assistant de OpenAI personal del usuario (si aplica)")


    def __str__(self):
        return self.user.username

# Opcional: Crear UserProfile automáticamente cuando se crea un User
@receiver(post_save, sender=User)
def create_or_update_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)
    # instance.profile.save() # Descomentar si tienes lógica que necesite guardarse en cada update del User