"""
WSGI config for lexprocess_backend project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

# Por defecto usar settings de producción; puede redefinirse en el entorno
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'lexprocess_backend.settings.prod')

application = get_wsgi_application()
