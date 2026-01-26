from django.contrib import admin
from .models import Caso, Cliente, ParteProcesal

@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ('nombre_completo', 'email', 'telefono', 'despacho')
    search_fields = ('nombre_completo', 'email')
    list_filter = ('despacho',)

class ParteProcesalInline(admin.TabularInline):
    model = ParteProcesal
    extra = 1

@admin.register(Caso)
class CasoAdmin(admin.ModelAdmin):
    list_display = ('nombre_caso', 'numero_expediente', 'tipo_proceso', 'cliente', 'abogado_asignado', 'estado_caso', 'fecha_creacion', 'despacho')
    list_filter = ('tipo_proceso', 'estado_caso', 'despacho', 'abogado_asignado')
    search_fields = ('nombre_caso', 'numero_expediente', 'cliente__nombre_completo', 'juzgado_tribunal')
    date_hierarchy = 'fecha_creacion'
    raw_id_fields = ('cliente', 'abogado_asignado') # Para mejor rendimiento con muchos usuarios/clientes
    inlines = [ParteProcesalInline]

@admin.register(ParteProcesal)
class ParteProcesalAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'rol_en_proceso', 'caso')
    search_fields = ('nombre',)
    list_filter = ('rol_en_proceso',)
    raw_id_fields = ('caso',)