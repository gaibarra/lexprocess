from django.apps import AppConfig


class BoletinesMonitorConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'boletines_monitor'

    def ready(self):
        from . import signals  # noqa: F401
