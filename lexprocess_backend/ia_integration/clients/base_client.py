import requests
import time
from django.conf import settings
from ..exceptions import APIKeyMissingError, APIRequestError
from ..models import InteraccionIA, APIUtilizadaChoices

class BaseAPIClient:
    """Cliente base para APIs que usan requests estándar."""
    def __init__(self, api_key_setting_name, api_name, base_url):
        self.api_key = getattr(settings, api_key_setting_name, None)
        if not self.api_key:
            raise APIKeyMissingError(f"API key for {api_name} is missing in settings.")
        self.base_url = base_url
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _post(self, endpoint, payload):
        url = f"{self.base_url}{endpoint}"
        try:
            response = requests.post(url, headers=self.headers, json=payload)
            response.raise_for_status()  # Lanza HTTPError para códigos 4xx/5xx
            return response.json()
        except requests.exceptions.RequestException as e:
            raise APIRequestError(f"Failed to make POST request to {url}: {e}") from e

    def _log_interaction(self, **kwargs):
        """Helper para crear una entrada en el modelo InteraccionIA."""
        # Se espera que los argumentos coincidan con los campos del modelo
        InteraccionIA.objects.create(**kwargs)