from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.views import TokenRefreshView
from api_v1.jwt_views import CustomTokenObtainPairView

CustomTokenObtainPairView.permission_classes = (AllowAny,)
TokenRefreshView.permission_classes = (AllowAny,)

from django.db import connections
from django.db.utils import OperationalError
from django.http import JsonResponse
import redis
import os

def health_view(request):
    status = {
        'database': 'ok',
        'redis': 'unknown',
        'app': 'ok'
    }
    # DB check
    try:
        connections['default'].cursor()
    except OperationalError:
        status['database'] = 'error'
    # Redis check (best-effort)
    redis_url = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
    try:
        r = redis.from_url(redis_url, socket_connect_timeout=0.5)
        r.ping()
        status['redis'] = 'ok'
    except Exception:
        status['redis'] = 'error'
    code = 200 if all(v == 'ok' for v in status.values()) else 503
    return JsonResponse(status, status=code)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', include('api_v1.urls')),
    path('api/v1/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/v1/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/health/', health_view, name='health'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)