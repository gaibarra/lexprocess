from django.core.management.base import BaseCommand
from workflows_procesales.models import WorkflowPlantilla, EtapaPlantilla

class Command(BaseCommand):
    help = 'Semilla para los flujos procesales más comunes en México'

    def handle(self, *args, **options):
        workflows = [
            {
                "nombre": "Amparo Indirecto",
                "descripcion": "Procedimiento ante Juez de Distrito contra actos de autoridad.",
                "etapas": [
                    ("Presentación de Demanda", 1),
                    ("Auto Inicial (Desecha/Previene/Admite)", 3),
                    ("Informe Justificado", 15),
                    ("Audiencia Incidental (Suspensión)", 5),
                    ("Audiencia Constitucional", 30),
                    ("Sentencia", 10),
                    ("Recurso de Revisión", 10),
                ]
            },
            {
                "nombre": "Amparo Directo",
                "descripcion": "Contra sentencias definitivas ante Tribunal Colegiado.",
                "etapas": [
                    ("Presentación de Demanda (Autoridad Responsable)", 1),
                    ("Emplazamiento a Tercero Interesado", 5),
                    ("Envío de Expediente al Colegiado", 3),
                    ("Auto Inicial (Admite/Desecha/Previene)", 3),
                    ("Amparo Adhesivo", 15),
                    ("Turno a Ponencia", 5),
                    ("Sentencia (Resolución)", 90),
                ]
            },
            {
                "nombre": "Juicio Ordinario Civil",
                "descripcion": "Juicio civil de cuantía mayor o materia indeterminada.",
                "etapas": [
                    ("Presentación de Demanda", 1),
                    ("Auto Admisorio", 3),
                    ("Emplazamiento", 5),
                    ("Contestación de Demanda", 15),
                    ("Ofrecimiento de Pruebas", 10),
                    ("Desahogo de Pruebas", 30),
                    ("Alegatos", 5),
                    ("Sentencia", 15),
                ]
            },
            {
                "nombre": "Juicio Ejecutivo Mercantil",
                "descripcion": "Juicio basado en títulos de crédito (pagarés, cheques).",
                "etapas": [
                    ("Presentación de Demanda", 1),
                    ("Auto de Exequendo", 2),
                    ("Embargo y Emplazamiento", 3),
                    ("Contestación de Demanda", 8),
                    ("Desahogo de Pruebas", 15),
                    ("Alegatos", 2),
                    ("Sentencia", 10),
                ]
            },
            {
                "nombre": "Juicio Oral Mercantil",
                "descripcion": "Procedimiento oral para controversias mercantiles sin limitación de cuantía.",
                "etapas": [
                    ("Presentación de Demanda", 1),
                    ("Auto Admisorio", 3),
                    ("Emplazamiento", 5),
                    ("Contestación de Demanda", 9),
                    ("Audiencia Preliminar", 15),
                    ("Audiencia de Juicio", 20),
                    ("Sentencia", 10),
                ]
            },
            {
                "nombre": "Procedimiento Laboral (Ordinario)",
                "descripcion": "Nuevo sistema laboral (Centros de Conciliación y Tribunales).",
                "etapas": [
                    ("Constancia de No Conciliación", 1),
                    ("Presentación de Demanda", 1),
                    ("Auto Admisorio", 3),
                    ("Emplazamiento", 5),
                    ("Contestación y Réplica", 15),
                    ("Audiencia Preliminar", 10),
                    ("Audiencia de Juicio", 20),
                    ("Sentencia", 5),
                ]
            }
        ]

        for wf_data in workflows:
            wf, created = WorkflowPlantilla.objects.get_or_create(
                nombre=wf_data["nombre"],
                defaults={'descripcion': wf_data["descripcion"]}
            )
            
            # Limpiar etapas previas si se está actualizando la semilla
            wf.etapas.all().delete()
            
            for idx, (nombre_etapa, dias) in enumerate(wf_data["etapas"]):
                EtapaPlantilla.objects.create(
                    workflow=wf,
                    nombre=nombre_etapa,
                    orden=idx,
                    dias_termino_sugerido=dias
                )
            
            self.stdout.write(self.style.SUCCESS(f'Plantilla "{wf_data["nombre"]}" configurada.'))

        self.stdout.write(self.style.SUCCESS('Todos los flujos comunes han sido inicializados.'))
