from django.urls import path

from boletines_monitor.consumers import BoletinesConsumer

websocket_urlpatterns = [
    path('ws/boletines/', BoletinesConsumer.as_asgi()),
]
