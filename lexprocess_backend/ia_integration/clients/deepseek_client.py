from .base_client import BaseAPIClient
from ..models import APIUtilizadaChoices
import time

class DeepseekClient(BaseAPIClient):
    def __init__(self, usuario=None, caso=None):
        super().__init__('DEEPSEEK_API_KEY', 'Deepseek', 'https://api.deepseek.com/v1')
        self.usuario = usuario
        self.caso = caso

    def generate_text(self, messages, model="deepseek-chat"):
        """Genera texto usando la API de Deepseek."""
        payload = {
            "model": model,
            "messages": messages,
            "stream": False # Para recibir la respuesta completa de una vez
        }
        
        start_time = time.time()
        try:
            response_json = self._post('/chat/completions', payload)
            duracion_ms = int((time.time() - start_time) * 1000)
            respuesta_texto = response_json['choices'][0]['message']['content']

            self._log_interaction(
                caso=self.caso, usuario=self.usuario, api_utilizada=APIUtilizadaChoices.DEEPSEEK,
                prompt_enviado=str(messages), respuesta_recibida=respuesta_texto, duracion_ms=duracion_ms
            )
            return respuesta_texto
        except Exception as e:
            self._log_interaction(
                caso=self.caso, usuario=self.usuario, api_utilizada=APIUtilizadaChoices.DEEPSEEK,
                prompt_enviado=str(messages), respuesta_recibida=str(e), exitoso=False
            )
            raise e