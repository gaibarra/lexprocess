import datetime
from .models import DiaInhabil, Jurisdiccion

class TerminoLegalService:
    @staticmethod
    def es_dia_habil(fecha, jurisdiccion):
        """
        Determina si una fecha es hábil para una jurisdicción dada.
        Excluye fines de semana y días registrados en DiaInhabil.
        """
        if fecha.weekday() >= 5:  # Sábado o Domingo
            return False
            
        return not DiaInhabil.objects.filter(fecha=fecha, jurisdiccion=jurisdiccion).exists()

    @staticmethod
    def calcular_vencimiento(fecha_notificacion, dias_termino, jurisdiccion_nombre, desde_dia_siguiente=True):
        """
        Calcula la fecha de vencimiento de un término legal en México.
        """
        try:
            jurisdiccion = Jurisdiccion.objects.get(nombre=jurisdiccion_nombre)
        except Jurisdiccion.DoesNotExist:
            raise ValueError(f"Jurisdicción '{jurisdiccion_nombre}' no configurada.")

        fecha_actual = fecha_notificacion
        
        if desde_dia_siguiente:
            fecha_actual += datetime.timedelta(days=1)
        
        dias_contados = 0
        while dias_contados < dias_termino:
            if TerminoLegalService.es_dia_habil(fecha_actual, jurisdiccion):
                dias_contados += 1
            
            if dias_contados < dias_termino:
                fecha_actual += datetime.timedelta(days=1)
                
        return fecha_actual

    @staticmethod
    def obtener_dias_inhabiles_rango(fecha_inicio, fecha_fin, jurisdiccion):
        return DiaInhabil.objects.filter(
            jurisdiccion=jurisdiccion,
            fecha__range=(fecha_inicio, fecha_fin)
        ).order_by('fecha')
