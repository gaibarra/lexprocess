# api_v1/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
# Importa ViewSets desde views.py
from .views import (
    UserViewSet, DespachoViewSet, ClienteViewSet, CasoViewSet,
    ParteProcesalViewSet, DocumentoViewSet, PlazoViewSet, LogoutView, AuthSessionView,
    JurisdiccionViewSet, DiaInhabilViewSet, TerminoLegalView,
    WorkflowPlantillaViewSet, WorkflowInstanciaViewSet, HitoProcesalViewSet,
    PublicacionFiltroViewSet, NotificacionBoletinViewSet
)
# Importa la vista de logout desde jwt_views.py
from .jwt_views import LogoutView

router = DefaultRouter()
# ... (tus registros de router no cambian) ...
router.register(r'users', UserViewSet, basename='user')
router.register(r'despachos', DespachoViewSet, basename='despacho')
router.register(r'clientes', ClienteViewSet, basename='cliente')
router.register(r'casos', CasoViewSet, basename='caso')
router.register(r'partes-procesales', ParteProcesalViewSet, basename='parteprocesal')
router.register(r'documentos', DocumentoViewSet, basename='documento')
router.register(r'plazos', PlazoViewSet, basename='plazo')
router.register(r'calendario/jurisdicciones', JurisdiccionViewSet, basename='jurisdiccion')
router.register(r'calendario/dias-inhabiles', DiaInhabilViewSet, basename='diainhabil')
router.register(r'workflows/plantillas', WorkflowPlantillaViewSet, basename='workflowplantilla')
router.register(r'workflows/instancias', WorkflowInstanciaViewSet, basename='workflowinstancia')
router.register(r'workflows/hitos', HitoProcesalViewSet, basename='hitoprocesal')
router.register(r'boletines/filtros', PublicacionFiltroViewSet, basename='publicacionfiltro')
router.register(r'boletines/notificaciones', NotificacionBoletinViewSet, basename='notificacionboletin')


urlpatterns = [
    path('', include(router.urls)),
    path('auth/logout/', LogoutView.as_view(), name='auth_logout'), # Endpoint de Logout
    path('auth/session/', AuthSessionView.as_view(), name='auth_session'),
    path('calendario/calcular-vencimiento/', TerminoLegalView.as_view(), name='calcular_vencimiento'),
]