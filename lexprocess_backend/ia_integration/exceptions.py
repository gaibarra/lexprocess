class IAIntegrationError(Exception):
    """Excepción base para errores en la integración con APIs de IA."""
    pass

class APIKeyMissingError(IAIntegrationError):
    """Lanzada cuando una API key requerida no está configurada."""
    pass

class APIRequestError(IAIntegrationError):
    """Lanzada cuando una petición a la API falla por razones de la API (ej. 4xx, 5xx)."""
    pass