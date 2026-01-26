from django.test import TestCase
from django.utils import timezone
from .models import Jurisdiccion, DiaInhabil
from .services import TerminoLegalService

class TerminoLegalTestCase(TestCase):
    def setUp(self):
        self.jurisdiccion = Jurisdiccion.objects.create(nombre="Federal")
        # 1 de Mayo es inhábil
        DiaInhabil.objects.create(
            fecha="2024-05-01", 
            jurisdiccion=self.jurisdiccion, 
            motivo="Día del Trabajo"
        )

    def test_calculo_plazo_simple(self):
        # Lunes 29 Abril 2024. Notificación.
        # Martes 30 Abril corre (Día 1)
        # Miércoles 1 Mayo es INHÁBIL
        # Jueves 2 Mayo corre (Día 2)
        # Viernes 3 Mayo corre (Día 3) -> Vencimiento
        fecha_notif = timezone.datetime(2024, 4, 29).date()
        vencimiento = TerminoLegalService.calcular_vencimiento(fecha_notif, 3, "Federal")
        self.assertEqual(vencimiento.strftime('%Y-%m-%d'), "2024-05-03")

    def test_calculo_con_fin_de_semana(self):
        # Jueves 23 Mayo 2024. Notificación.
        # Viernes 24 Mayo (Día 1)
        # Sábado 25 (Inhábil)
        # Domingo 26 (Inhábil)
        # Lunes 27 Mayo (Día 2)
        # Martes 28 Mayo (Día 3) -> Vencimiento
        fecha_notif = timezone.datetime(2024, 5, 23).date()
        vencimiento = TerminoLegalService.calcular_vencimiento(fecha_notif, 3, "Federal")
        self.assertEqual(vencimiento.strftime('%Y-%m-%d'), "2024-05-28")
