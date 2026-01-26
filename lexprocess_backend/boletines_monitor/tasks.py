from celery import shared_task
from .models import PublicacionFiltro, NotificacionBoletin, OrigenBoletin
from django.utils import timezone
import random

# Este es un simulador de lo que haría un scraper real de SISE o CDMX
@shared_task
def sync_boletines_task():
    filtros = PublicacionFiltro.objects.all()
    novedades = 0
    
    for filtro in filtros:
        # Simulamos que encontramos un acuerdo nuevo el 10% de las veces que corremos
        if random.random() < 0.2:
            acuerdos_mock = [
                "Se admite demanda y se ordena emplazar a la demandada.",
                "Se tiene por rendido informe justificado de la autoridad responsable.",
                "Se señala fecha para audiencia constitucional.",
                "Se desecha recurso por extemporáneo.",
                "Visto el estado procesal, se dicta sentencia definitiva."
            ]
            acuerdo = random.choice(acuerdos_mock)
            
            # Evitar duplicados simples para la demo
            if not NotificacionBoletin.objects.filter(caso=filtro.caso, resumen_acuerdo=acuerdo).exists():
                notif = NotificacionBoletin.objects.create(
                    caso=filtro.caso,
                    fecha_publicacion=timezone.now().date(),
                    resumen_acuerdo=acuerdo,
                    origen=filtro.origen
                )
                analizar_notificacion_con_ia.delay(notif.id)
                novedades += 1
                
    return f"Sincronización completada. {novedades} notificaciones nuevas encontradas."

@shared_task
def analizar_notificacion_con_ia(notificacion_id):
    try:
        from ia_integration.services import OpenAIClient
        import json
    except ImportError:
        return "Servicios de IA no disponibles"

    notif = NotificacionBoletin.objects.get(id=notificacion_id)
    caso = notif.caso
    
    prompt = f"""
    Analiza este acuerdo judicial de México:
    "{notif.resumen_acuerdo}"
    
    Tipo de Origen: {notif.get_origen_display()}
    Caso actual: {caso.nombre_caso} ({caso.numero_expediente})
    
    Identifica:
    1. ¿A qué etapa del proceso corresponde?
    2. ¿Genera algún plazo legal para el abogado?
    
    Respuesta JSON:
    {{
        "paso_detectado": "...",
        "plazo_dias": numero_entero_o_null,
        "explicacion": "...",
        "fundamento": "..."
    }}
    """
    
    try:
        client = OpenAIClient(usuario=None, caso=caso) # Usará el default del caso/despacho
        resp = client.get_completion(
            messages=[{"role": "system", "content": "Eres un experto en boletín judicial mexicano."},
                      {"role": "user", "content": prompt}]
        )
        data = json.loads(resp)
        notif.sugerencia_workflow_paso = data.get('paso_detectado')
        notif.sugerencia_plazo_dias = data.get('plazo_dias')
        notif.explicacion_ia = f"{data.get('explicacion')} - Fundamento: {data.get('fundamento')}"
        notif.save()
    except Exception as e:
        print(f"Error analizando boletín: {e}")
        # FALLBACK para Demo si falla la IA (Quota)
        if "emplazar" in notif.resumen_acuerdo.lower():
             notif.sugerencia_workflow_paso = "Emplazamiento"
             notif.sugerencia_plazo_dias = 15
             notif.explicacion_ia = "Se detectó orden de emplazamiento. El plazo estándar es de 15 días para contestar."
        elif "informe" in notif.resumen_acuerdo.lower():
             notif.sugerencia_workflow_paso = "Informe Justificado"
             notif.sugerencia_plazo_dias = 15
             notif.explicacion_ia = "La autoridad debe rendir informe. Monitorear cumplimiento."
        else:
             notif.sugerencia_workflow_paso = "Trámite"
             notif.sugerencia_plazo_dias = 3
             notif.explicacion_ia = "Acuerdo de trámite general. Se sugiere revisar en 3 días."
        notif.save()
