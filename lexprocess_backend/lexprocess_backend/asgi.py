"""
ASGI config for lexprocess_backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'lexprocess_backend.settings.prod')

django_asgi_app = get_asgi_application()

from lexprocess_backend.channels_auth import TokenAuthMiddlewareStack
from lexprocess_backend.routing import websocket_urlpatterns

application = ProtocolTypeRouter({
	'http': django_asgi_app,
	'websocket': TokenAuthMiddlewareStack(URLRouter(websocket_urlpatterns)),
})
