from django.contrib import admin
from .models import InteraccionIA

@admin.register(InteraccionIA)
class InteraccionIAAdmin(admin.ModelAdmin):
    list_display = ('id', 'timestamp', 'api_utilizada', 'usuario', 'caso', 'exitoso', 'costo_aproximado')
    list_filter = ('api_utilizada', 'exitoso', 'usuario', 'caso__despacho')
    search_fields = ('prompt_enviado', 'respuesta_recibida', 'referencia_externa_id')
    date_hierarchy = 'timestamp'
    raw_id_fields = ('caso', 'usuario')