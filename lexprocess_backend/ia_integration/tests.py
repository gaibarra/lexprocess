# ia_integration/tests.py
import pytest
import json
from unittest.mock import patch
from django.contrib.auth.models import User
from .services import clasificar_documento, generar_borrador_escrito, investigar_jurisprudencia_actualizada
from .exceptions import APIRequestError
from casos.models import Caso
from despachos.models import Despacho

@pytest.fixture
def test_user():
    """Fixture para crear un usuario de prueba."""
    return User.objects.create_user(username='testuser', password='password')

@pytest.mark.django_db
@patch('ia_integration.services.OpenAIClient')
def test_clasificar_documento_exitoso(MockOpenAIClient, test_user):
    """Prueba el flujo exitoso de clasificación de documentos."""
    # Setup
    mock_response_dict = {
        "tipo_documento": "SENTENCIA",
        "fecha_documento": "2024-01-15",
        "resumen_breve": "Fallo a favor del demandante."
    }
    mock_instance = MockOpenAIClient.return_value
    mock_instance.get_completion.return_value = json.dumps(mock_response_dict)
    
    texto_documento = "En la ciudad de..., a 15 de enero de 2024, se dicta sentencia..."
    
    # Execute
    resultado = clasificar_documento(texto_documento=texto_documento, usuario=test_user)
    
    # Assert
    assert "error" not in resultado
    assert resultado["tipo_documento"] == "SENTENCIA"
    mock_instance.get_completion.assert_called_once()

@pytest.mark.django_db
@patch('ia_integration.services.DeepseekClient')
def test_generar_borrador_escrito_exitoso(MockDeepseekClient, test_user):
    """Prueba el flujo exitoso de generación de borradores."""
    # Setup
    mock_instance = MockDeepseekClient.return_value
    mock_instance.generate_text.return_value = "AL JUZGADO..."
    
    despacho = Despacho.objects.create(nombre="Test Despacho")
    caso = Caso.objects.create(despacho=despacho, nombre_caso="Caso de Prueba")
    prompt = "Generar un escrito de trámite."

    # Execute
    resultado = generar_borrador_escrito(prompt_contextual=prompt, usuario=test_user, caso=caso)
    
    # Assert
    assert resultado == "AL JUZGADO..."
    mock_instance.generate_text.assert_called_once()

@pytest.mark.django_db
@patch('ia_integration.services.PerplexityClient')
def test_investigar_jurisprudencia_falla_api(MockPerplexityClient, test_user):
    """Prueba el manejo de errores al investigar jurisprudencia."""
    # Setup
    mock_instance = MockPerplexityClient.return_value
    mock_instance.research.side_effect = APIRequestError("Perplexity API limit reached")
    
    # Execute
    resultado = investigar_jurisprudencia_actualizada(pregunta="¿Qué es el litisconsorcio?", usuario=test_user)
    
    # Assert
    assert "Error durante la investigación" in resultado
    assert "Perplexity API limit reached" in resultado