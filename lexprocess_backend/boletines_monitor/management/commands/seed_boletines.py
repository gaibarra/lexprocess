from django.core.management.base import BaseCommand
from boletines_monitor.models import PublicacionFiltro, OrigenBoletin
from casos.models import Caso
from django.conf import settings

class Command(BaseCommand):
    help = 'Configura filtros de monitoreo para los casos existentes'

    def handle(self, *args, **options):
        casos = Caso.objects.all()
        default_origens = set(settings.DEFAULT_BOLETIN_ORIGINS)
        valid_origens = {choice[0] for choice in OrigenBoletin.choices}
        selected_origens = [origin for origin in default_origens if origin in valid_origens]
        if not selected_origens:
            selected_origens = [OrigenBoletin.SISE, OrigenBoletin.SONORA]
        for caso in casos:
            for origen in selected_origens:
                PublicacionFiltro.objects.get_or_create(
                    caso=caso,
                    numero_expediente=caso.numero_expediente or "123/2024",
                    origen=origen
                )
        self.stdout.write(self.style.SUCCESS(f'Filtros de monitoreo configurados para {casos.count()} casos.'))
