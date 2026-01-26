from django.core.management.base import BaseCommand
from calendario_legal.models import Jurisdiccion, DiaInhabil
import datetime

class Command(BaseCommand):
    help = 'Semilla inicial para el calendario legal (México 2024)'

    def handle(self, *args, **options):
        fed, created = Jurisdiccion.objects.get_or_create(
            nombre="Federal",
            defaults={'descripcion': 'Poder Judicial de la Federación (PJF)'}
        )
        if created:
            self.stdout.write(self.style.SUCCESS('Jurisdicción Federal creada.'))

        dias = [
            ("2024-01-01", "Año Nuevo"),
            ("2024-02-05", "Aniversario Constitución"),
            ("2024-03-18", "Natalicio Benito Juárez"),
            ("2024-03-28", "Jueves Santo"),
            ("2024-03-29", "Viernes Santo"),
            ("2024-05-01", "Día del Trabajo"),
            ("2024-09-16", "Día de Independencia"),
            ("2024-10-01", "Cambio Poder Ejecutivo"),
            ("2024-11-18", "Revolución Mexicana"),
            ("2024-12-25", "Navidad"),
        ]

        for fecha_str, motivo in dias:
            fecha = datetime.datetime.strptime(fecha_str, '%Y-%m-%d').date()
            _, created = DiaInhabil.objects.get_or_create(
                fecha=fecha,
                jurisdiccion=fed,
                defaults={'motivo': motivo}
            )
            if created:
                self.stdout.write(f'Añadido inhábil: {fecha_str} ({motivo})')

        self.stdout.write(self.style.SUCCESS('Calendario legal inicializado.'))
