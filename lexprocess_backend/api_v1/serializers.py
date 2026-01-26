# api_v1/serializers.py
import os
from django.utils import timezone
from rest_framework import serializers
from django.contrib.auth.models import User
from users.models import UserProfile
from despachos.models import Despacho
from casos.models import Caso, Cliente, ParteProcesal
from documentos.models import Documento
from agenda_plazos.models import Plazo
from calendario_legal.models import Jurisdiccion, DiaInhabil
from workflows_procesales.models import WorkflowPlantilla, EtapaPlantilla, WorkflowInstancia, HitoProcesal
from boletines_monitor.models import PublicacionFiltro, NotificacionBoletin

# --- Serializers Simples para Anidación ---
class UserSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']

class CasoSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Caso
        fields = ['id', 'nombre_caso', 'numero_expediente']

class DespachoSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Despacho
        fields = ['id', 'nombre']

# --- Serializers para Workflows Procesales (Movidos arriba para CasoSerializer) ---
class EtapaPlantillaSerializer(serializers.ModelSerializer):
    class Meta:
        model = EtapaPlantilla
        fields = ['id', 'nombre', 'orden', 'dias_termino_sugerido']

class WorkflowPlantillaSerializer(serializers.ModelSerializer):
    etapas = EtapaPlantillaSerializer(many=True, read_only=True)
    class Meta:
        model = WorkflowPlantilla
        fields = ['id', 'nombre', 'descripcion', 'activo', 'etapas']

class HitoProcesalSerializer(serializers.ModelSerializer):
    etapa_nombre = serializers.CharField(source='etapa.nombre', read_only=True)
    class Meta:
        model = HitoProcesal
        fields = ['id', 'workflow_instancia', 'etapa', 'etapa_nombre', 'fecha_cumplimiento', 'completado', 'notas']

class WorkflowInstanciaSerializer(serializers.ModelSerializer):
    plantilla_nombre = serializers.CharField(source='plantilla.nombre', read_only=True)
    hitos = HitoProcesalSerializer(many=True, read_only=True)
    etapa_actual_nombre = serializers.CharField(source='etapa_actual.nombre', read_only=True)
    
    class Meta:
        model = WorkflowInstancia
        fields = ['id', 'caso', 'plantilla', 'plantilla_nombre', 'fecha_inicio', 'etapa_actual', 'etapa_actual_nombre', 'hitos']

# --- Serializers Principales ---

# --- Serializers para User y UserProfile ---
class UserProfileSerializer(serializers.ModelSerializer):
    despacho_detalle = DespachoSimpleSerializer(source='despacho', read_only=True)
    despacho_id = serializers.PrimaryKeyRelatedField(queryset=Despacho.objects.all(), source='despacho', write_only=True, allow_null=True, required=False)
    class Meta: model = UserProfile; fields = ['rol', 'telefono', 'despacho_id', 'despacho_detalle']

class UserSerializer(serializers.ModelSerializer):
    profile = UserProfileSerializer(required=False, allow_null=True)
    class Meta: model = User; fields = ['id', 'username', 'email', 'first_name', 'last_name', 'profile', 'is_staff', 'is_active']; read_only_fields = ['id', 'is_staff']; extra_kwargs = {'password': {'write_only': True, 'required': False}}
    def create(self, validated_data): profile_data = validated_data.pop('profile', None); password = validated_data.pop('password', None); user = User(**validated_data); user.set_password(password); user.save(); UserProfile.objects.create(user=user, **profile_data) if profile_data else UserProfile.objects.create(user=user); return user
    def update(self, instance, validated_data): profile_data = validated_data.pop('profile', None); password = validated_data.pop('password', None); instance.email = validated_data.get('email', instance.email); instance.first_name = validated_data.get('first_name', instance.first_name); instance.last_name = validated_data.get('last_name', instance.last_name); instance.is_active = validated_data.get('is_active', instance.is_active); instance.set_password(password) if password else None; instance.save(); UserProfile.objects.create(user=instance, **profile_data) if profile_data and not hasattr(instance, 'profile') else UserProfileSerializer(instance.profile, data=profile_data, partial=True).is_valid(raise_exception=True) and UserProfileSerializer(instance.profile, data=profile_data, partial=True).save() if profile_data else None; return instance
# --- Serializer para Despacho ---

class DespachoSerializer(serializers.ModelSerializer):
    class Meta: model = Despacho; fields = ['id', 'nombre', 'fecha_creacion', 'openai_assistant_id']; read_only_fields = ['id', 'fecha_creacion']

# --- Serializers para Casos ---
class ClienteSerializer(serializers.ModelSerializer):
    despacho_id = serializers.PrimaryKeyRelatedField(queryset=Despacho.objects.all(), source='despacho', write_only=True); despacho = DespachoSimpleSerializer(read_only=True)
    class Meta: model = Cliente; fields = ['id', 'nombre_completo', 'email', 'telefono', 'despacho_id', 'despacho']; read_only_fields = ['id']

class ParteProcesalSerializer(serializers.ModelSerializer):
    caso_id = serializers.PrimaryKeyRelatedField(queryset=Caso.objects.all(), source='caso', write_only=True)
    class Meta: model = ParteProcesal; fields = ['id', 'nombre', 'rol_en_proceso', 'caso_id']; read_only_fields = ['id']

class CasoSerializer(serializers.ModelSerializer):
    tipo_proceso_display = serializers.CharField(source='get_tipo_proceso_display', read_only=True); estado_caso_display = serializers.CharField(source='get_estado_caso_display', read_only=True)
    abogado_asignado_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source='abogado_asignado', write_only=True, allow_null=True, required=False); abogado_asignado = UserSimpleSerializer(read_only=True)
    cliente_id = serializers.PrimaryKeyRelatedField(queryset=Cliente.objects.all(), source='cliente', write_only=True, allow_null=True, required=False); cliente = ClienteSerializer(read_only=True)
    despacho_id = serializers.PrimaryKeyRelatedField(queryset=Despacho.objects.all(), source='despacho', write_only=True); despacho = DespachoSimpleSerializer(read_only=True)
    partes_procesales = ParteProcesalSerializer(many=True, read_only=True)
    workflow = WorkflowInstanciaSerializer(read_only=True)
    class Meta: model = Caso; fields = ['id', 'despacho_id', 'despacho', 'nombre_caso', 'numero_expediente', 'tipo_proceso', 'tipo_proceso_display', 'juzgado_tribunal', 'cliente_id', 'cliente', 'abogado_asignado_id', 'abogado_asignado', 'estado_caso', 'estado_caso_display', 'fecha_creacion', 'fecha_actualizacion', 'descripcion_breve', 'openai_thread_id', 'partes_procesales', 'workflow']; read_only_fields = ['id', 'fecha_creacion', 'fecha_actualizacion', 'openai_thread_id', 'tipo_proceso_display', 'estado_caso_display', 'partes_procesales', 'workflow']
    def validate_despacho_id(self, value): request = self.context.get('request'); (request and hasattr(request, 'user') and hasattr(request.user, 'profile') and not request.user.is_staff and request.user.profile.despacho != value) and (_ for _ in ()).throw(serializers.ValidationError("No tienes permiso para asignar este caso a un despacho diferente al tuyo.")); return value


# --- Serializers para Documentos ---
class DocumentoSerializer(serializers.ModelSerializer):
    tipo_documento_display = serializers.CharField(source='get_tipo_documento_display', read_only=True, allow_null=True)
    caso_id = serializers.PrimaryKeyRelatedField(queryset=Caso.objects.all(), source='caso', write_only=True)
    caso = CasoSimpleSerializer(read_only=True)
    cargado_por = UserSimpleSerializer(read_only=True)

    class Meta:
        model = Documento
        fields = ['id', 'caso_id', 'caso', 'nombre_documento', 'archivo', 'tipo_documento', 'tipo_documento_display', 'fecha_documento', 'fecha_carga', 'cargado_por', 'descripcion', 'metadatos_ia', 'openai_file_id', 'texto_extraido']
        read_only_fields = ['id', 'fecha_carga', 'cargado_por', 'metadatos_ia', 'openai_file_id', 'texto_extraido', 'tipo_documento_display']
        extra_kwargs = {'archivo': {'required': True, 'allow_null': False}}
    
    # --- NUEVA VALIDACIÓN ---
    def validate_archivo(self, value):
        ext = os.path.splitext(value.name)[1].lower()
        valid_extensions = ['.pdf', '.docx', '.txt']
        if not ext in valid_extensions:
            raise serializers.ValidationError(f"Extensión de archivo no soportada. Solo se permiten: {', '.join(valid_extensions)}")
        if value.size > 50 * 1024 * 1024: # Límite de 50MB
             raise serializers.ValidationError("El archivo no puede superar los 50MB.")
        return value

# --- Serializers para Agenda/Plazos ---
class PlazoSerializer(serializers.ModelSerializer):
    tipo_evento_display = serializers.CharField(source='get_tipo_evento_display', read_only=True)
    caso_id = serializers.PrimaryKeyRelatedField(queryset=Caso.objects.all(), source='caso', write_only=True)
    caso = CasoSimpleSerializer(read_only=True)
    responsable_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), source='responsable', write_only=True, allow_null=True, required=False)
    responsable = UserSimpleSerializer(read_only=True)

    class Meta:
        model = Plazo
        fields = ['id', 'caso_id', 'caso', 'titulo', 'descripcion', 'tipo_evento', 'tipo_evento_display', 'fecha_hora_vencimiento', 'responsable_id', 'responsable', 'completado', 'fecha_completado', 'recordatorio_activo', 'dias_antes_recordatorio', 'recordatorio_enviado', 'fecha_creacion', 'fecha_actualizacion']
        read_only_fields = ['id', 'fecha_creacion', 'fecha_actualizacion', 'tipo_evento_display', 'recordatorio_enviado']
        
    # --- NUEVA VALIDACIÓN ---
    def validate(self, data):
        instance = getattr(self, 'instance', None)
        completado = data.get('completado', instance.completado if instance else False)
        fecha_completado = data.get('fecha_completado', instance.fecha_completado if instance else None)

        if completado and not fecha_completado:
            data['fecha_completado'] = timezone.now()
        elif not completado:
            data['fecha_completado'] = None
            
        return data

# --- Serializers para Calendario Legal ---
class JurisdiccionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Jurisdiccion
        fields = ['id', 'nombre', 'descripcion']

class DiaInhabilSerializer(serializers.ModelSerializer):
    jurisdiccion_id = serializers.PrimaryKeyRelatedField(queryset=Jurisdiccion.objects.all(), source='jurisdiccion', write_only=True)
    jurisdiccion = JurisdiccionSerializer(read_only=True)
    class Meta:
        model = DiaInhabil
        fields = ['id', 'fecha', 'jurisdiccion_id', 'jurisdiccion', 'motivo', 'es_suspension_extraordinaria']

# --- Serializers para Boletines Judiciales ---
class PublicacionFiltroSerializer(serializers.ModelSerializer):
    class Meta:
        model = PublicacionFiltro
        fields = ['id', 'caso', 'numero_expediente', 'origen', 'ultimo_acuerdo_visto']

class NotificacionBoletinSerializer(serializers.ModelSerializer):
    caso_nombre = serializers.CharField(source='caso.nombre_caso', read_only=True)
    origen_display = serializers.CharField(source='get_origen_display', read_only=True)
    
    class Meta:
        model = NotificacionBoletin
        fields = ['id', 'caso', 'caso_nombre', 'fecha_publicacion', 'resumen_acuerdo', 'origen', 'origen_display', 'revisado', 'sugerencia_workflow_paso', 'sugerencia_plazo_dias', 'explicacion_ia']