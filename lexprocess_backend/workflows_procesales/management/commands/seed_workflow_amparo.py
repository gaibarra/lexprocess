from django.core.management.base import BaseCommand
from workflows_procesales.models import WorkflowPlantilla, EtapaPlantilla

class Command(BaseCommand):
    help = 'Semilla para el flujo de Amparo Indirecto (México)'

    def handle(self, *args, **options):
        workflow, created = WorkflowPlantilla.objects.get_or_create(
            nombre="Amparo Indirecto",
            defaults={'descripcion': 'Procedimiento ordinario de Amparo Indirecto ante Juez de Distrito.'}
        )
        
        if not created:
             workflow.etapas.all().delete()

        etapas = [
            ("Presentación de Demanda", 0, 1),
            ("Auto Inicial (Desecha/Previene/Admite)", 1, 3),
            ("Informe Justificado", 2, 15),
            ("Audiencia Incidental (Suspensión)", 3, 5),
            ("Audiencia Constitucional", 4, 30),
            ("Sentencia", 5, 10),
            ("Recurso de Revisión", 6, 10),
        ]

        for nombre, orden, dias in etapas:
            EtapaPlantilla.objects.create(
                workflow=workflow,
                nombre=nombre,
                orden=orden,
                dias_termino_sugerido=dias
            )
            
        self.stdout.write(self.style.SUCCESS('Plantilla de Amparo Indirecto creada exitosamente.'))
