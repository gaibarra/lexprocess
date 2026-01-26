from django.contrib import admin
from .models import Plazo

@admin.register(Plazo)
class PlazoAdmin(admin.ModelAdmin):
    list_display = ('titulo', 'caso', 'tipo_evento', 'fecha_hora_vencimiento', 'responsable', 'completado')
    list_filter = ('tipo_evento', 'completado', 'responsable', 'caso__despacho')
    search_fields = ('titulo', 'descripcion', 'caso__nombre_caso')
    date_hierarchy = 'fecha_hora_vencimiento'
    raw_id_fields = ('caso', 'responsable')