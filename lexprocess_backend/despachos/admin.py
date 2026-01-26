from django.contrib import admin
from .models import Despacho

@admin.register(Despacho)
class DespachoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'fecha_creacion', 'openai_assistant_id')
    search_fields = ('nombre',)