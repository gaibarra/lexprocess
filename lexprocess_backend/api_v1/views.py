# api_v1/views.py

# --- Imports de Django y REST Framework ---
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken, TokenError
from django.contrib.auth.models import User
from django.conf import settings
from django.shortcuts import get_object_or_404
from documentos.tasks import extract_text_from_document # <-- IMPORTANTE: Importar la tarea
from django.utils import timezone
from datetime import timedelta
from django.db import connection

# --- Imports de Módulos Locales ---
from .permissions import IsAdminOrRelatedDespacho, IsAdminOrOwnerOfObject
from .serializers import (
    UserSerializer, DespachoSerializer,
    CasoSerializer, ClienteSerializer, ParteProcesalSerializer,
    DocumentoSerializer, PlazoSerializer,
    JurisdiccionSerializer, DiaInhabilSerializer,
    WorkflowPlantillaSerializer, WorkflowInstanciaSerializer, HitoProcesalSerializer,
    NotificacionBoletinSerializer, PublicacionFiltroSerializer
)
from calendario_legal.models import Jurisdiccion, DiaInhabil
from workflows_procesales.models import WorkflowPlantilla, WorkflowInstancia, HitoProcesal, EtapaPlantilla
from boletines_monitor.models import NotificacionBoletin, PublicacionFiltro, OrigenBoletin
from calendario_legal.services import TerminoLegalService
from ia_integration.services import (
    clasificar_documento,
    generar_borrador_escrito,
    investigar_jurisprudencia_actualizada,
    realizar_consulta_rag_asistente,
    sugerir_proximo_hito
)
from ia_integration.exceptions import IAIntegrationError
from despachos.models import Despacho
from casos.models import Caso, Cliente, ParteProcesal
from documentos.models import Documento, TipoDocumentoChoices
from agenda_plazos.models import Plazo
from users.models import UserProfile


# --- ViewSets ---

class UserViewSet(viewsets.ModelViewSet):
    """API endpoint para ver y editar usuarios. Acceso restringido a administradores."""
    queryset = User.objects.select_related('profile__despacho').all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAdminUser]

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated], url_path='me')
    def get_current_user(self, request):
        """Devuelve la información del usuario autenticado actualmente."""
        serializer = self.get_serializer(request.user)
        return Response(serializer.data)

class DespachoViewSet(viewsets.ModelViewSet):
    """API endpoint para ver y editar despachos. Acceso restringido a administradores."""
    queryset = Despacho.objects.all()
    serializer_class = DespachoSerializer
    permission_classes = [permissions.IsAdminUser]

class ClienteViewSet(viewsets.ModelViewSet):
    """API endpoint para gestionar clientes del despacho."""
    serializer_class = ClienteSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrRelatedDespacho]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Cliente.objects.select_related('despacho').all()
        if hasattr(user, 'profile') and user.profile.despacho:
            return Cliente.objects.filter(despacho=user.profile.despacho).select_related('despacho')
        return Cliente.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if not user.is_staff and hasattr(user, 'profile') and user.profile.despacho:
            serializer.save(despacho=user.profile.despacho)
        else:
            serializer.save()

class CasoViewSet(viewsets.ModelViewSet):
    """API endpoint para gestionar casos, con funcionalidades de IA integradas."""
    serializer_class = CasoSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrRelatedDespacho]

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            self.permission_classes = [permissions.IsAuthenticated, IsAdminOrOwnerOfObject]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        qs = Caso.objects.none()
        if user.is_staff:
            qs = Caso.objects.all()
        elif hasattr(user, 'profile') and user.profile.despacho:
            qs = Caso.objects.filter(despacho=user.profile.despacho)
        return qs.select_related('cliente', 'abogado_asignado__profile', 'despacho', 'workflow', 'workflow__etapa_actual').prefetch_related('partes_procesales', 'workflow__hitos__etapa')

    def perform_create(self, serializer):
        user = self.request.user
        if not user.is_staff and hasattr(user, 'profile') and user.profile.despacho:
            serializer.save(despacho=user.profile.despacho)
        else:
            serializer.save()

    @action(detail=True, methods=['post'], url_path='consulta-ia')
    def consulta_ia(self, request, pk=None):
        caso = self.get_object()
        pregunta = request.data.get('pregunta')
        if not pregunta:
            return Response({"error": "El campo 'pregunta' es requerido."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            respuesta_ia = realizar_consulta_rag_asistente(pregunta, caso, request.user)
            return Response({"respuesta": respuesta_ia}, status=status.HTTP_200_OK)
        except IAIntegrationError as e:
            return Response({"error": str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            return Response({"error": f"Error inesperado: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'], url_path='generar-escrito')
    def generar_escrito(self, request, pk=None):
        caso = self.get_object()
        tipo_escrito = request.data.get('tipo_escrito')
        puntos_clave = request.data.get('puntos_clave')
        if not tipo_escrito or not puntos_clave:
            return Response({"error": "Los campos 'tipo_escrito' y 'puntos_clave' son requeridos."}, status=status.HTTP_400_BAD_REQUEST)
        prompt_contextual = f"Generar un borrador para un escrito del tipo: '{tipo_escrito}'.\nContexto del Caso: {caso.nombre_caso} ({caso.numero_expediente or 'N/A'}).\nPuntos clave a incluir: {puntos_clave}"
        try:
            borrador = generar_borrador_escrito(prompt_contextual, request.user, caso)
            return Response({"borrador_texto": borrador}, status=status.HTTP_200_OK)
        except IAIntegrationError as e:
            return Response({"error": str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    @action(detail=False, methods=['post'], url_path='investigar')
    def investigar(self, request):
        query = request.data.get('query')
        if not query:
            return Response({"error": "El campo 'query' es requerido."}, status=status.HTTP_400_BAD_REQUEST)
        caso = None
        caso_id = request.data.get('caso_id')
        if caso_id:
            caso = get_object_or_404(Caso, pk=caso_id)
            if not request.user.is_staff and caso.despacho != request.user.profile.despacho:
                return Response({"error": "No tienes permiso para asociar esta búsqueda a ese caso."}, status=status.HTTP_403_FORBIDDEN)
        try:
            resultado = investigar_jurisprudencia_actualizada(query, request.user, caso)
            return Response({"resultado": resultado}, status=status.HTTP_200_OK)
        except IAIntegrationError as e:
            return Response({"error": str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

class ParteProcesalViewSet(viewsets.ModelViewSet):
    serializer_class = ParteProcesalSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return ParteProcesal.objects.select_related('caso').all()
        if hasattr(user, 'profile') and user.profile.despacho:
            return ParteProcesal.objects.filter(caso__despacho=user.profile.despacho).select_related('caso')
        return ParteProcesal.objects.none()

    def perform_create(self, serializer):
        caso = serializer.validated_data.get('caso')
        user = self.request.user
        if not user.is_staff and hasattr(user, 'profile') and user.profile.despacho:
            if caso.despacho != user.profile.despacho:
                raise permissions.PermissionDenied("No puedes añadir partes a casos de otros despachos.")
        serializer.save()

class DocumentoViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentoSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            self.permission_classes = [permissions.IsAuthenticated, IsAdminOrOwnerOfObject]
        elif self.action in ['list', 'retrieve', 'clasificar']:
            self.permission_classes = [permissions.IsAuthenticated, IsAdminOrRelatedDespacho]
        else:
            self.permission_classes = [permissions.IsAuthenticated]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Documento.objects.select_related('caso', 'cargado_por').all()
        if hasattr(user, 'profile') and user.profile.despacho:
            return Documento.objects.filter(caso__despacho=user.profile.despacho).select_related('caso', 'cargado_por')
        return Documento.objects.none()

    # MODIFICAMOS el método create o perform_create
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Guardamos el documento con el estado por defecto 'PENDIENTE'
        self.perform_create(serializer)
        
        # --- LANZAR LA TAREA EN SEGUNDO PLANO ---
        documento_id = serializer.instance.id
        extract_text_from_document.delay(documento_id)
        
        headers = self.get_success_headers(serializer.data)
        
        # Devolvemos 202 ACCEPTED en lugar de 201 CREATED
        # para indicar que la solicitud fue aceptada pero el procesamiento no ha terminado.
        return Response(serializer.data, status=status.HTTP_202_ACCEPTED, headers=headers)
    
    # perform_create sigue asignando el 'cargado_por'
    def perform_create(self, serializer):
        caso = serializer.validated_data.get('caso')
        user = self.request.user
        if not user.is_staff and hasattr(user, 'profile') and user.profile.despacho:
            if caso.despacho != user.profile.despacho:
                raise permissions.PermissionDenied("No puedes añadir documentos a casos de otros despachos.")
        # El estado 'PENDIENTE' se establece por defecto en el modelo
        serializer.save(cargado_por=user)
    
    @action(detail=True, methods=['post'])
    def clasificar(self, request, pk=None):
        documento = self.get_object()
        if not documento.texto_extraido:
            return Response({"error": "El texto del documento no ha sido extraído. Esta acción debe realizarse primero."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            resultado_ia = clasificar_documento(documento.texto_extraido, request.user, documento.caso)
            if "error" in resultado_ia:
                 return Response(resultado_ia, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            documento.metadatos_ia = resultado_ia
            tipo_doc_ia = resultado_ia.get('tipo_documento')
            if tipo_doc_ia and tipo_doc_ia in TipoDocumentoChoices.values:
                 documento.tipo_documento = tipo_doc_ia
            documento.save(update_fields=['metadatos_ia', 'tipo_documento'])
            serializer = self.get_serializer(documento)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": f"Ocurrió un error inesperado: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class PlazoViewSet(viewsets.ModelViewSet):
    serializer_class = PlazoSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminOrRelatedDespacho]

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'destroy']:
            self.permission_classes = [permissions.IsAuthenticated, IsAdminOrOwnerOfObject]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Plazo.objects.select_related('caso', 'responsable').all()
        if hasattr(user, 'profile') and user.profile.despacho:
            return Plazo.objects.filter(caso__despacho=user.profile.despacho).select_related('caso', 'responsable')
        return Plazo.objects.none()

    def perform_create(self, serializer):
        caso = serializer.validated_data.get('caso')
        user = self.request.user
        if not user.is_staff and hasattr(user, 'profile') and user.profile.despacho:
            if caso.despacho != user.profile.despacho:
                raise permissions.PermissionDenied("No puedes añadir plazos a casos de otros despachos.")
        serializer.save()

class JurisdiccionViewSet(viewsets.ModelViewSet):
    queryset = Jurisdiccion.objects.all()
    serializer_class = JurisdiccionSerializer
    permission_classes = [permissions.IsAuthenticated] # Solo lectura o admin? Por ahora auth.

class DiaInhabilViewSet(viewsets.ModelViewSet):
    queryset = DiaInhabil.objects.select_related('jurisdiccion').all()
    serializer_class = DiaInhabilSerializer
    permission_classes = [permissions.IsAuthenticated]

class TerminoLegalView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        fecha_notificacion = request.data.get('fecha_notificacion')
        dias_termino = request.data.get('dias_termino')
        jurisdiccion_nombre = request.data.get('jurisdiccion_nombre')
        desde_dia_siguiente = request.data.get('desde_dia_siguiente', True)

        if not all([fecha_notificacion, dias_termino, jurisdiccion_nombre]):
            return Response({"error": "Faltan parámetros requeridos."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            fecha_dt = timezone.datetime.strptime(fecha_notificacion, '%Y-%m-%d').date()
            vencimiento = TerminoLegalService.calcular_vencimiento(
                fecha_dt, int(dias_termino), jurisdiccion_nombre, desde_dia_siguiente
            )
            return Response({
                "fecha_notificacion": fecha_notificacion,
                "dias_termino": dias_termino,
                "jurisdiccion": jurisdiccion_nombre,
                "fecha_vencimiento": vencimiento.strftime('%Y-%m-%d')
            })
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"error": f"Error interno: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class WorkflowPlantillaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = WorkflowPlantilla.objects.filter(activo=True)
    serializer_class = WorkflowPlantillaSerializer
    permission_classes = [permissions.IsAuthenticated]

class WorkflowInstanciaViewSet(viewsets.ModelViewSet):
    serializer_class = WorkflowInstanciaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return WorkflowInstancia.objects.all()
        return WorkflowInstancia.objects.filter(caso__despacho=user.profile.despacho)

    def perform_create(self, serializer):
        # Al crear una instancia, inicializamos los hitos basados en la plantilla
        instancia = serializer.save()
        etapas = instancia.plantilla.etapas.all()
        for etapa in etapas:
            HitoProcesal.objects.create(
                workflow_instancia=instancia,
                etapa=etapa
            )
        if etapas.exists():
            instancia.etapa_actual = etapas.first()
            instancia.save()

class HitoProcesalViewSet(viewsets.ModelViewSet):
    serializer_class = HitoProcesalSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return HitoProcesal.objects.all()
        return HitoProcesal.objects.filter(workflow_instancia__caso__despacho=user.profile.despacho)

    @action(detail=True, methods=['get'])
    def sugerencia_ia(self, request, pk=None):
        hito = self.get_object()
        if not hito.completado:
            return Response({"error": "Solo se pueden pedir sugerencias para hitos completados."}, status=status.HTTP_400_BAD_REQUEST)
        
        sugerencia = sugerir_proximo_hito(hito, request.user)
        
        # Opcionalmente, calcular de una vez la fecha de vencimiento real
        # usando la jurisdicción del caso (si está definida)
        dias = sugerencia.get("dias_plazo")
        if dias and hito.workflow_instancia.caso.juzgado_tribunal:
             # Aquí podríamos intentar inferir la jurisdicción o usar 'Federal' por defecto
             try:
                 vencimiento = TerminoLegalService.calcular_vencimiento(
                     timezone.now().date(), dias, "Federal" 
                 )
                 sugerencia["fecha_vencimiento_calculada"] = vencimiento.strftime('%Y-%m-%d')
             except:
                 pass
                 
        return Response(sugerencia)

class PublicacionFiltroViewSet(viewsets.ModelViewSet):
    serializer_class = PublicacionFiltroSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return PublicacionFiltro.objects.all()
        return PublicacionFiltro.objects.filter(caso__despacho=user.profile.despacho)

class NotificacionBoletinViewSet(viewsets.ModelViewSet):
    serializer_class = NotificacionBoletinSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return NotificacionBoletin.objects.all()
        return NotificacionBoletin.objects.filter(caso__despacho=user.profile.despacho)

    @action(detail=False, methods=['post'])
    def sincronizar(self, request):
        from boletines_monitor.tasks import sync_boletines_task
        sync_boletines_task.delay()
        return Response({"status": "Sincronización iniciada en segundo plano."}, status=status.HTTP_202_ACCEPTED)

class BoletinDefaultsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        available = [
            {"value": choice[0], "label": choice[1]}
            for choice in OrigenBoletin.choices
        ]
        available_sorted = sorted(available, key=lambda item: item["label"])
        valid = {choice[0] for choice in OrigenBoletin.choices}
        defaults = [origin for origin in settings.DEFAULT_BOLETIN_ORIGINS if origin in valid]
        if not defaults:
            defaults = [OrigenBoletin.SISE, OrigenBoletin.SONORA]
        defaults_sorted = sorted(
            defaults,
            key=lambda origin: next(
                (label for value, label in OrigenBoletin.choices if value == origin),
                origin,
            )
        )
        return Response({
            "default_origins": defaults_sorted,
            "available_origins": available_sorted,
        })

# --- Vistas de Autenticación (No son ViewSets) ---

class AuthSessionView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        # build user data similar to login response
        profile_payload = None
        if hasattr(user, 'profile'):
            profile = user.profile
            profile_payload = {
                'rol': profile.rol,
                'despacho_id': profile.despacho.id if profile.despacho else None,
                'despacho_nombre': profile.despacho.nombre if profile.despacho else None,
                'preferred_jurisdiccion': {
                    'id': str(profile.preferred_jurisdiccion.id),
                    'nombre': profile.preferred_jurisdiccion.nombre,
                } if profile.preferred_jurisdiccion else None,
            }
        user_data = {
            'id': user.id,
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'email': user.email,
            'profile': profile_payload,
            'permissions': {
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser,
            }
        }
        # Lightweight metrics (can expand later)
        # Alcance de datos según permisos
        if user.is_staff:
            qs_casos = Caso.objects.all()
            qs_docs = Documento.objects.all()
            qs_plazos = Plazo.objects.all()
        elif profile_payload and profile_payload['despacho_id']:
            despacho_id = profile_payload['despacho_id']
            qs_casos = Caso.objects.filter(despacho_id=despacho_id)
            qs_docs = Documento.objects.filter(caso__despacho_id=despacho_id)
            qs_plazos = Plazo.objects.filter(caso__despacho_id=despacho_id)
        else:
            qs_casos = Caso.objects.none()
            qs_docs = Documento.objects.none()
            qs_plazos = Plazo.objects.none()

        now = timezone.now()
        horizon = now + timedelta(days=7)
        plazos_qs = qs_plazos.filter(completado=False, fecha_hora_vencimiento__gte=now).order_by('fecha_hora_vencimiento')
        # Filtramos para la métrica rápida (proximos 7 días)
        plazos_proximos_count = plazos_qs.filter(fecha_hora_vencimiento__lte=horizon).count()
        
        casos_activos = qs_casos.filter(estado_caso='ACTIVO').count()

        # Serializamos datos para widgets (los 5 más próximos/recientes)
        plazos_data = PlazoSerializer(plazos_qs[:5], many=True).data
        docs_data = DocumentoSerializer(qs_docs.order_by('-fecha_carga')[:5], many=True).data

        metrics = {
            'casos_total': qs_casos.count(),
            'casos_activos': casos_activos,
            'documentos_total': qs_docs.count(),
            'plazos_proximos_7d': plazos_proximos_count,
            'timestamp': now.isoformat(),
            'horizon_days': 7,
            'widgets': {
                'plazos_proximos': plazos_data,
                'documentos_recientes': docs_data,
            }
        }
        return Response({'user': user_data, 'metrics': metrics})

    def patch(self, request):
        user = request.user
        profile, _ = UserProfile.objects.get_or_create(user=user)

        preferred_id = request.data.get('preferred_jurisdiccion_id', None)
        if preferred_id is not None:
            if preferred_id in ['', None]:
                profile.preferred_jurisdiccion = None
            else:
                try:
                    jurisdiccion = Jurisdiccion.objects.get(pk=preferred_id)
                except Jurisdiccion.DoesNotExist:
                    return Response({"error": "Jurisdicción no válida."}, status=status.HTTP_400_BAD_REQUEST)
                profile.preferred_jurisdiccion = jurisdiccion

        profile.save()
        return self.get(request)