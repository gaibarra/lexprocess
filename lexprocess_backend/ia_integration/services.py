"""
Servicios de alto nivel para interactuar con funcionalidades de IA.
Esta es la capa que el resto de la aplicación Django debe consumir.
"""
from .clients.openai_client import OpenAIClient
from .clients.deepseek_client import DeepseekClient
from .clients.perplexity_client import PerplexityClient
from .exceptions import IAIntegrationError, APIRequestError
from documentos.models import Documento
import json

def clasificar_documento(texto_documento: str, usuario, caso=None) -> dict:
    """
    Clasifica un documento y extrae metadatos usando Deepseek.
    
    Retorna un diccionario con la clasificación y metadatos.
    """
    prompt_messages = [
        {"role": "system", "content": """Eres un asistente legal experto en clasificar documentos jurídicos en español. 
         Analiza el texto y devuelve una respuesta JSON con la siguiente estructura: 
         {"tipo_documento": "...", "fecha_documento": "YYYY-MM-DD", "partes_identificadas": ["...", "..."], "resumen_breve": "..."}.
         Los posibles valores para "tipo_documento" son: DEMANDA, CONTESTACION, PRUEBA, SENTENCIA, RESOLUCION, ESCRITO_TRAMITE, NOTIFICACION, RECURSO, INFORME_PERICIAL, OTRO.
         Si una fecha no es clara, devuelve null. Extrae un resumen de no más de 3 frases."""},
        {"role": "user", "content": f"Por favor, clasifica el siguiente texto:\n\n---\n{texto_documento[:8000]}\n---"} # Limitar para no exceder tokens
    ]
    try:
        client = DeepseekClient(usuario=usuario, caso=caso)
        respuesta_texto = client.generate_text(messages=prompt_messages, model="deepseek-chat")
        
        # Intentar parsear el JSON de la respuesta
        return json.loads(respuesta_texto)
    except json.JSONDecodeError:
        # Si la IA no devuelve un JSON válido, lo devolvemos como un campo de texto simple.
        return {"error": "La respuesta de la IA no fue un JSON válido.", "respuesta_bruta": respuesta_texto}
    except IAIntegrationError as e:
        # Los errores ya se loguean en el cliente
        return {"error": str(e)}

def generar_borrador_escrito(prompt_contextual: str, usuario, caso) -> str:
    """
    Genera un borrador de un escrito legal usando la API de Deepseek por su potencial en código/estructuras.
    
    Retorna el texto del borrador.
    """
    prompt_messages = [
        {"role": "system", "content": "Eres un asistente legal altamente competente. Genera un borrador de escrito jurídico basado en el siguiente contexto. Mantén un tono formal y una estructura legalmente apropiada."},
        {"role": "user", "content": prompt_contextual}
    ]
    try:
        client = DeepseekClient(usuario=usuario, caso=caso)
        return client.generate_text(messages=prompt_messages)
    except IAIntegrationError as e:
        return f"Error al generar el borrador: {e}"

def investigar_jurisprudencia_actualizada(pregunta: str, usuario, caso=None) -> str:
    """
    Usa Perplexity para investigar jurisprudencia o temas legales con acceso a internet.
    
    Retorna la respuesta de la investigación.
    """
    try:
        client = PerplexityClient(usuario=usuario, caso=caso)
        return client.research(query=pregunta)
    except IAIntegrationError as e:
        return f"Error durante la investigación: {e}"

def realizar_consulta_rag_asistente(pregunta: str, caso, usuario) -> str:
    """
    Realiza una consulta contextualizada usando Deepseek (Long Context RAG).
    Aprovecha la ventana de contexto de Deepseek para enviar el texto de los documentos.
    """
    try:
        # 1. Obtener texto de los documentos asociados al caso
        docs = Documento.objects.filter(caso=caso).exclude(texto_extraido__isnull=True).exclude(texto_extraido="")
        
        contexto_textos = []
        for d in docs:
            # Incluimos el nombre y el contenido (limitado por precaución, aunque Deepseek aguante mucho)
            contexto_textos.append(f"ARCHIVO: {d.nombre_documento}\nCONTENIDO: {d.texto_extraido[:15000]}")
        
        contexto_completo = "\n\n".join(contexto_textos)
        
        prompt_messages = [
            {
                "role": "system", 
                "content": (
                    "Eres LexProcess IA, un asistente jurídico avanzado. "
                    "Responde basándote en los documentos del caso proporcionados a continuación. "
                    "Si la respuesta no se encuentra en los documentos, usa tu conocimiento legal "
                    "pero aclara que es una opinión general y no basada en el expediente."
                )
            },
            {
                "role": "user", 
                "content": f"DOCUMENTACIÓN DEL CASO:\n{contexto_completo}\n\nPREGUNTA:\n{pregunta}"
            }
        ]
        
        client = DeepseekClient(usuario=usuario, caso=caso)
        return client.generate_text(messages=prompt_messages)
        
    except Exception as e:
        return f"Error al procesar la consulta con la IA principal (Deepseek): {str(e)}"

def sugerir_proximo_hito(hito_completado, usuario) -> dict:
    """
    Analiza el hito recien completado y sugiere el siguiente paso y su plazo legal.
    """
    workflow_instancia = hito_completado.workflow_instancia
    caso = workflow_instancia.caso
    plantilla = workflow_instancia.plantilla
    
    # Identificar el siguiente hito en la plantilla
    orden_actual = hito_completado.etapa.orden
    siguiente_etapa = workflow_instancia.plantilla.etapas.filter(orden__gt=orden_actual).first()
    
    if not siguiente_etapa:
        return {"mensaje": "Has llegado al final del workflow configurado."}

    prompt_contextual = f"""
    Contexto del Caso: {caso.nombre_caso}
    Tipo de Juicio: {plantilla.nombre}
    Hito Recién Completado: {hito_completado.etapa.nombre}
    Siguiente Hito Programado: {siguiente_etapa.nombre}
    Días de término sugeridos por plantilla: {siguiente_etapa.dias_termino_sugerido}
    
    Como experto legal en México, ¿es este el siguiente paso correcto? 
    Si hay una regla legal específica (ej. Ley de Amparo, Código de Comercio) que dicte el plazo para {siguiente_etapa.nombre}, por favor indícala.
    Devuelve un JSON con:
    {{
        "confirmacion_paso": true/false,
        "paso_sugerido": "nombre del paso",
        "dias_plazo": numero,
        "explicacion_legal": "...",
        "fundamento_legal": "Art. X de la Ley Y"
    }}
    """
    
    prompt_messages = [
        {"role": "system", "content": "Eres un consultor procesal experto en derecho mexicano."},
        {"role": "user", "content": prompt_contextual}
    ]
    
    try:
        client = DeepseekClient(usuario=usuario, caso=caso)
        respuesta_texto = client.generate_text(messages=prompt_messages, model="deepseek-chat")
        
        # Intentar parsear el JSON
        sugerencia = json.loads(respuesta_texto)
        sugerencia["siguiente_etapa_id"] = siguiente_etapa.id
        return sugerencia
    except Exception as e:
        # Fallback a la lógica de la plantilla si la IA falla
        return {
            "confirmacion_paso": True,
            "paso_sugerido": siguiente_etapa.nombre,
            "dias_plazo": siguiente_etapa.dias_termino_sugerido or 3,
            "explicacion_legal": "Sugerencia basada en la configuración estándar de la plantilla.",
            "fundamento_legal": "Práctica procesal estándar.",
            "siguiente_etapa_id": siguiente_etapa.id
        }