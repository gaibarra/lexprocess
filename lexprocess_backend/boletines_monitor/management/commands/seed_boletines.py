from django.core.management.base import BaseCommand
from boletines_monitor.models import PublicacionFiltro, OrigenBoletin
from casos.models import Caso

class Command(BaseCommand):
    help = 'Configura filtros de monitoreo para los casos existentes'

    def handle(self, *args, **options):
        casos = Caso.objects.all()
        for caso in casos:
            PublicacionFiltro.objects.get_or_create(
                caso=caso,
                numero_expediente=caso.numero_expediente or "123/2024",
                origen=OrigenBoletin.SISE
            )
            PublicacionFiltro.objects.get_or_create(
                caso=caso,
                numero_expediente=caso.numero_expediente or "123/2024",
                origen=OrigenBoletin.CDMX
            )
        self.stdout.write(self.style.SUCCESS(f'Filtros de monitoreo configurados para {casos.count()} casos.'))
