import openai
import time
from django.conf import settings
from ..exceptions import APIKeyMissingError, APIRequestError
from ..models import InteraccionIA, APIUtilizadaChoices

class OpenAIClient:
    """Cliente para interactuar con todas las APIs de OpenAI."""
    def __init__(self, usuario=None, caso=None):
        if not settings.OPENAI_API_KEY:
            raise APIKeyMissingError("OpenAI API key is missing in settings.")
        self.client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        self.usuario = usuario
        self.caso = caso

    def _log(self, api_choice, prompt, response, **extra_data):
        """Helper para registrar la interacción."""
        InteraccionIA.objects.create(
            caso=self.caso,
            usuario=self.usuario,
            api_utilizada=api_choice,
            prompt_enviado=str(prompt),
            respuesta_recibida=str(response),
            **extra_data
        )

    def get_completion(self, messages, model="gpt-3.5-turbo", temperature=0.1, max_tokens=2048):
        """Obtiene una completación simple de la API de Chat."""
        start_time = time.time()
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            duracion_ms = int((time.time() - start_time) * 1000)
            respuesta_texto = response.choices[0].message.content
            
            self._log(APIUtilizadaChoices.OPENAI_GENERAL, messages, respuesta_texto, duracion_ms=duracion_ms)
            return respuesta_texto
        except openai.APIError as e:
            self._log(APIUtilizadaChoices.OPENAI_GENERAL, messages, str(e), exitoso=False)
            raise APIRequestError(f"OpenAI API error: {e}") from e

    # --- Métodos para Assistants API ---

    def upload_file(self, file_path_or_stream, purpose='assistants'):
        """Sube un archivo a OpenAI."""
        try:
            file_object = self.client.files.create(file=file_path_or_stream, purpose=purpose)
            return file_object
        except openai.APIError as e:
            raise APIRequestError(f"OpenAI file upload error: {e}") from e

    def run_assistant_on_thread(self, assistant_id, thread_id, instructions=""):
        """Añade un mensaje, ejecuta el asistente y espera el resultado."""
        start_time = time.time()
        try:
            run = self.client.beta.threads.runs.create(
                thread_id=thread_id,
                assistant_id=assistant_id,
                instructions=instructions,
            )

            # Polling para esperar que el 'run' se complete
            while run.status in ['queued', 'in_progress', 'cancelling']:
                time.sleep(1) # Espera 1 segundo antes de volver a verificar
                run = self.client.beta.threads.runs.retrieve(thread_id=thread_id, run_id=run.id)
            
            duracion_ms = int((time.time() - start_time) * 1000)

            if run.status == 'completed':
                messages = self.client.beta.threads.messages.list(thread_id=thread_id)
                # La respuesta del asistente es el primer mensaje en la lista
                assistant_response = messages.data[0].content[0].text.value
                self._log(
                    APIUtilizadaChoices.OPENAI_ASSISTANT, 
                    f"Run on thread {thread_id}", 
                    assistant_response,
                    referencia_externa_id=run.id,
                    duracion_ms=duracion_ms
                )
                return assistant_response
            else:
                self._log(
                    APIUtilizadaChoices.OPENAI_ASSISTANT,
                    f"Run on thread {thread_id}",
                    run.last_error.message if run.last_error else "Run failed with no error message.",
                    exitoso=False,
                    referencia_externa_id=run.id,
                    duracion_ms=duracion_ms
                )
                raise APIRequestError(f"Run failed with status {run.status}. Error: {run.last_error}")

        except openai.APIError as e:
            self._log(APIUtilizadaChoices.OPENAI_ASSISTANT, f"Run on thread {thread_id}", str(e), exitoso=False)
            raise APIRequestError(f"OpenAI Assistant run error: {e}") from e

    def add_message(self, thread_id, content, file_ids=None):
        """Añade un mensaje a un thread existente."""
        try:
            message = self.client.beta.threads.messages.create(
                thread_id=thread_id,
                role="user",
                content=content,
                file_ids=file_ids or []
            )
            return message
        except openai.APIError as e:
            raise APIRequestError(f"OpenAI add message error: {e}") from e
    
    def get_or_create_thread(self, thread_id=None):
        """Obtiene un thread o crea uno nuevo si no se proporciona ID."""
        if thread_id:
            try:
                return self.client.beta.threads.retrieve(thread_id)
            except openai.NotFoundError:
                pass # El thread no existe, se creará uno nuevo
        
        try:
            thread = self.client.beta.threads.create()
            return thread
        except openai.APIError as e:
            raise APIRequestError(f"OpenAI create thread error: {e}") from e