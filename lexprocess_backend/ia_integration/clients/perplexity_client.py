from .base_client import BaseAPIClient
from ..models import APIUtilizadaChoices
import time

class PerplexityClient(BaseAPIClient):
    def __init__(self, usuario=None, caso=None):
        super().__init__('PERPLEXITY_API_KEY', 'Perplexity', 'https://api.perplexity.ai')
        self.usuario = usuario
        self.caso = caso

    def research(self, query, model="pplx-7b-online"):
        """Realiza una búsqueda web-conectada con Perplexity."""
        messages = [{"role": "user", "content": query}]
        payload = {"model": model, "messages": messages}

        start_time = time.time()
        try:
            response_json = self._post('/chat/completions', payload)
            duracion_ms = int((time.time() - start_time) * 1000)
            respuesta_texto = response_json['choices'][0]['message']['content']

            self._log_interaction(
                caso=self.caso, usuario=self.usuario, api_utilizada=APIUtilizadaChoices.PERPLEXITY,
                prompt_enviado=query, respuesta_recibida=respuesta_texto, duracion_ms=duracion_ms
            )
            return respuesta_texto
        except Exception as e:
            self._log_interaction(
                caso=self.caso, usuario=self.usuario, api_utilizada=APIUtilizadaChoices.PERPLEXITY,
                prompt_enviado=query, respuesta_recibida=str(e), exitoso=False
            )
            raise e