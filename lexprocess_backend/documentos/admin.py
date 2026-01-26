from django.contrib import admin
from .models import Documento

@admin.register(Documento)
class DocumentoAdmin(admin.ModelAdmin):
    list_display = ('nombre_documento', 'caso', 'tipo_documento', 'fecha_documento', 'fecha_carga', 'cargado_por')
    list_filter = ('tipo_documento', 'caso__despacho', 'cargado_por')
    search_fields = ('nombre_documento', 'caso__nombre_caso', 'descripcion')
    date_hierarchy = 'fecha_carga'
    raw_id_fields = ('caso', 'cargado_por')