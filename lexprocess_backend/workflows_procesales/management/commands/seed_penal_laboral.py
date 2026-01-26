from django.core.management.base import BaseCommand
from workflows_procesales.models import WorkflowPlantilla, EtapaPlantilla

class Command(BaseCommand):
    help = 'Añade flujos procesales detallados para materia Penal y Laboral en México'

    def handle(self, *args, **options):
        workflows = [
            {
                "nombre": "Procedimiento Penal (Sistema Acusatorio)",
                "descripcion": "Flujo etapas del proceso penal: Inicial, Intermedia y Juicio Oral.",
                "etapas": [
                    ("Audiencia Inicial (Control de Detención)", 1),
                    ("Formulación de Imputación", 1),
                    ("Vinculación a Proceso", 1),
                    ("Investigación Complementaria", 60),
                    ("Cierre de Investigación", 1),
                    ("Fase Escrita (Acusación)", 15),
                    ("Audiencia Intermedia", 20),
                    ("Auto de Apertura a Juicio", 5),
                    ("Audiencia de Juicio Oral", 30),
                    ("Sindividualización de Sanciones", 5),
                    ("Sentencia", 5),
                ]
            },
            {
                "nombre": "Juicio Especial Laboral (Individual)",
                "descripcion": "Procedimientos bajo el nuevo sistema de Centros de Conciliación y Tribunales.",
                "etapas": [
                    ("Etapa de Conciliación Prejudicial", 15),
                    ("Presentación de Demanda ante Tribunal", 1),
                    ("Auto Admisorio", 3),
                    ("Emplazamiento a la Demandada", 5),
                    ("Contestación de Demanda (Demandada)", 15),
                    ("Réplica (Actor)", 8),
                    ("Contrarréplica (Demandada)", 5),
                    ("Audiencia Preliminar", 10),
                    ("Audiencia de Juicio (Desahogo)", 20),
                    ("Sentencia Laboral", 5),
                ]
            },
            {
                "nombre": "Procedimiento de Huelga (Laboral)",
                "descripcion": "Procedimiento especial por revisión de contrato o violaciones.",
                "etapas": [
                    ("Presentación de Emplazamiento", 1),
                    ("Notificación a la Empresa", 2),
                    ("Audiencia de Conciliación", 3),
                    ("Estallamiento / Prórroga", 6),
                    ("Incidente de Inexistencia / Ilicitud", 3),
                    ("Resolución Incidental", 5),
                ]
            }
        ]

        for wf_data in workflows:
            wf, created = WorkflowPlantilla.objects.get_or_create(
                nombre=wf_data["nombre"],
                defaults={'descripcion': wf_data["descripcion"]}
            )
            
            wf.etapas.all().delete()
            
            for idx, (nombre_etapa, dias) in enumerate(wf_data["etapas"]):
                EtapaPlantilla.objects.create(
                    workflow=wf,
                    nombre=nombre_etapa,
                    orden=idx,
                    dias_termino_sugerido=dias
                )
            
            self.stdout.write(self.style.SUCCESS(f'Plantilla "{wf_data["nombre"]}" configurada.'))

        self.stdout.write(self.style.SUCCESS('Flujos Penal y Laboral actualizados.'))
