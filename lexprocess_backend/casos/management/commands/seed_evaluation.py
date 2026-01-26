from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from users.models import UserProfile
from despachos.models import Despacho
from casos.models import Caso, Cliente, ParteProcesal
from workflows_procesales.models import WorkflowPlantilla, WorkflowInstancia, HitoProcesal
from boletines_monitor.models import PublicacionFiltro, NotificacionBoletin, OrigenBoletin
from django.utils import timezone
import datetime

class Command(BaseCommand):
    help = 'Genera datos de prueba exhaustivos para evaluación integral'

    def handle(self, *args, **options):
        # 1. Usuario de Prueba
        user, created = User.objects.get_or_create(
            username='abogado_test',
            defaults={
                'email': 'test@lexprocess.com',
                'first_name': 'Lic. Demo',
                'last_name': 'LexProcess',
                'is_staff': True
            }
        )
        if created:
            user.set_password('LexPass123!')
            user.save()
            self.stdout.write('Usuario "abogado_test" creado (Pass: LexPass123!)')

        # 2. Despacho
        despacho, _ = Despacho.objects.get_or_create(
            nombre="Consultoría Legal Integral S.C.",
            defaults={'openai_assistant_id': 'asst_mock_123'}
        )
        
        # Perfil
        profile, _ = UserProfile.objects.get_or_create(user=user)
        profile.despacho = despacho
        profile.rol = 'ABOGADO'
        profile.save()

        # 3. Clientes
        c1, _ = Cliente.objects.get_or_create(
            nombre_completo="Juan Pérez García",
            despacho=despacho,
            defaults={'email': 'juan@ejemplo.com'}
        )
        c2, _ = Cliente.objects.get_or_create(
            nombre_completo="Tecnología Avanzada S.A. de C.V.",
            despacho=despacho,
            defaults={'email': 'legal@tecnologia.com'}
        )

        # 4. Casos
        # Caso 1: Amparo Indirecto
        caso1, _ = Caso.objects.get_or_create(
            nombre_caso="Amparo contra Orden de Clausura",
            despacho=despacho,
            defaults={
                'numero_expediente': '450/2024',
                'cliente': c1,
                'abogado_asignado': user,
                'juzgado_tribunal': 'Juzgado Tercero de Distrito en Materia Administrativa',
                'tipo_proceso': 'AMPARO_INDIRECTO'
            }
        )

        # Caso 2: Penal
        caso2, _ = Caso.objects.get_or_create(
            nombre_caso="Proceso de Fraude Específico",
            despacho=despacho,
            defaults={
                'numero_expediente': '98/2023',
                'cliente': c2,
                'abogado_asignado': user,
                'juzgado_tribunal': 'Juez de Control del Sistema Procesal Penal Acusatorio (CDMX)',
                'tipo_proceso': 'PENAL'
            }
        )

        # 5. Asignar Workflows
        amparo_plantilla = WorkflowPlantilla.objects.filter(nombre__icontains="Amparo Indirecto").first()
        if amparo_plantilla:
            instancia, c_inst = WorkflowInstancia.objects.get_or_create(
                caso=caso1,
                defaults={'plantilla': amparo_plantilla}
            )
            if c_inst:
                # Generar hitos
                for etapa in amparo_plantilla.etapas.all():
                    HitoProcesal.objects.create(workflow_instancia=instancia, etapa=etapa)
                # Completar los dos primeros
                hitos = instancia.hitos.all().order_by('etapa__orden')
                if hitos.count() >= 2:
                    h1 = hitos[0]
                    h1.completado = True
                    h1.fecha_cumplimiento = timezone.now() - datetime.timedelta(days=5)
                    h1.save()
                    
                    h2 = hitos[1]
                    h2.completado = True
                    h2.fecha_cumplimiento = timezone.now() - datetime.timedelta(days=2)
                    h2.save()
                    
                    instancia.etapa_actual = hitos[2].etapa
                    instancia.save()

        # 6. Notificaciones de Boletín Simuladas
        NotificacionBoletin.objects.get_or_create(
            caso=caso1,
            resumen_acuerdo="Se tiene por recibido el informe justificado de la autoridad responsable; se da vista a las partes.",
            defaults={
                'fecha_publicacion': timezone.now().date(),
                'origen': OrigenBoletin.SISE,
                'sugerencia_workflow_paso': 'Informe Justificado',
                'sugerencia_plazo_dias': 8,
                'explicacion_ia': 'Se detectó la recepción de informe. Tienes 8 días para ampliar demanda si hay hechos nuevos.'
            }
        )

        NotificacionBoletin.objects.get_or_create(
            caso=caso2,
            resumen_acuerdo="Se señala fecha para audiencia de vinculación a proceso para el próximo martes.",
            defaults={
                'fecha_publicacion': timezone.now().date(),
                'origen': OrigenBoletin.SONORA,
                'sugerencia_workflow_paso': 'Vinculación a Proceso',
                'sugerencia_plazo_dias': 1,
                'explicacion_ia': 'Audiencia inminente. Preparar argumentos de defensa.'
            }
        )

        self.stdout.write(self.style.SUCCESS('Carga integral finalizada. El sistema está listo para evaluación.'))
