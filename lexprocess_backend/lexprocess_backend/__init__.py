# lexprocess_backend/__init__.py

# Esto asegurará que la app siempre se importe cuando Django se inicie
# para que las tareas compartidas (@shared_task) usen esta app.
from .celery import app as celery_app

__all__ = ('celery_app',)