# lexprocess_backend/celery.py
import os
from celery import Celery

# Establece el módulo de settings de Django para el programa 'celery'.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'lexprocess_backend.settings')

app = Celery('lexprocess_backend')

# Usando una cadena de texto aquí significa que el worker no necesita
# serializar el objeto de configuración a los procesos hijos.
# El namespace='CELERY' significa que todas las claves de configuración de Celery
# deben tener un prefijo `CELERY_`.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Carga automáticamente los módulos de tareas de todas las apps registradas.
app.autodiscover_tasks()