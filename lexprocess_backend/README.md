# LexProcess Backend

## Esquema de Settings

Se ha refactorizado la configuración en un paquete modular:

```
lexprocess_backend/settings/
	base.py   -> Configuración compartida
	dev.py    -> Overrides para desarrollo (DEBUG, CORS abierto)
	prod.py   -> Overrides para producción (seguridad, CORS restringido)
```

Entradas principales:
- Variable de entorno `DJANGO_SETTINGS_MODULE` debe apuntar a:
	- Desarrollo: `lexprocess_backend.settings.dev`
	- Producción: `lexprocess_backend.settings.prod`

`manage.py` usa `dev` por defecto. `wsgi.py` y `asgi.py` usan `prod` por defecto.

## Variables de Entorno Clave

| Variable | Descripción | Obligatoria en prod |
|----------|-------------|---------------------|
| DJANGO_SECRET_KEY | Clave secreta Django | Sí |
| DJANGO_DEBUG | "False" en producción | Sí |
| DJANGO_ALLOWED_HOSTS | Lista separada por comas | Sí |
| CORS_ALLOWED_ORIGINS | Orígenes permitidos en prod | Sí |
| DB_NAME / DB_USER / DB_PASSWORD / DB_HOST / DB_PORT | Postgres | Sí |
| CELERY_BROKER_URL / CELERY_RESULT_BACKEND | Redis u otro broker | Sí |
| DEFAULT_BOLETIN_ORIGINS | Orígenes por defecto (CSV) | No |
| EMAIL_HOST_USER / EMAIL_HOST_PASSWORD | Gmail SMTP (App Password) | Sí (si email) |
| EMAIL_HOST / EMAIL_PORT / EMAIL_USE_TLS | SMTP config | Sí (si email) |
| DEFAULT_FROM_EMAIL | Remitente | No |
| CHANNEL_REDIS_URL | Redis para WebSocket | No (usa memoria en dev) |
| OPENAI_API_KEY / DEEPSEEK_API_KEY / PERPLEXITY_API_KEY | Integraciones IA | Según funcionalidad |

## CORS en Producción

En `prod.py` se fuerza:
```
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = <leer de entorno>
```
Definir `CORS_ALLOWED_ORIGINS` por ejemplo:
```
https://app.lexprocess.com,https://admin.lexprocess.com
```

## Seguridad Producción
- `DEBUG = False`
- SSL redirect y HSTS activos
- Cookies seguras (`SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`)
- Ajustar `SECURE_HSTS_SECONDS` (p.ej. 31536000 tras validar)

## Logging
Configurado logger root y específicos (`django`, `celery`, `ia_integration`) con formato verbose. Ajustar niveles vía entorno si se desea.

## Endpoint de Salud
- `GET /api/health/` devuelve estado `database`, `redis`, `app`. 200 si todo OK, 503 si algo falla.

## Boletines Judiciales (Default)
Configura los orígenes por defecto con la variable `DEFAULT_BOLETIN_ORIGINS` (lista separada por comas).
Ejemplo en `.env`:
```
DEFAULT_BOLETIN_ORIGINS=SISE,SONORA
```
Endpoint para UI:
- `GET /api/v1/boletines/defaults/` devuelve `default_origins` y `available_origins`.

## Despacho personal (modo abogado solo)
Si un usuario no tiene despacho, se crea uno personal automáticamente. Para backfill:
```
./venv/bin/python lexprocess_backend/manage.py create_personal_despachos
```

## Notificaciones por Correo (Gmail SMTP)
Usa una App Password de Gmail y define en `.env`:
```
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=tu_correo@gmail.com
EMAIL_HOST_PASSWORD=tu_app_password
DEFAULT_FROM_EMAIL=LexProcess <tu_correo@gmail.com>
```

## Notificaciones en Tiempo Real (WebSocket)
- Endpoint WS: `ws(s)://<host>/ws/boletines/?token=<access_jwt>`
- Redis opcional para Channels: `CHANNEL_REDIS_URL=redis://localhost:6379/1`

## Tareas de Extracción
La tarea Celery `extract_text_from_document` ahora soporta: `.pdf`, `.docx`, `.txt`.

Para tests, considerar activar ejecución eager de Celery:
```
CELERY_TASK_ALWAYS_EAGER=True
CELERY_TASK_EAGER_PROPAGATES=True
```
en un archivo de settings de test dedicado si se añade.

## Frontend / Backend Alineación de Autenticación

El frontend (React + Zustand) consume los endpoints JWT expuestos por Django REST + SimpleJWT:

Endpoints:
- `POST /api/v1/token/` (credenciales -> {access, refresh, user})
- `POST /api/v1/token/refresh/` (refresh -> {access})
- `POST /api/v1/auth/logout/` (refresh token en body para blacklist)

Flujo en el frontend:
1. Al iniciar sesión se guarda `access`, `refresh` y `user` en el store persistente.
2. Se decodifica el `access` para calcular exp y programar un refresco silencioso ~1 minuto antes de expirar.
3. Interceptor de respuestas Axios reintenta 401 automáticamente realizando un refresh único (cola de peticiones mientras refresca).
4. Si el refresh falla, se ejecuta `logout()` que invalida el refresh en backend (best-effort) y limpia el store.
5. En el montaje de la App, si hay `refreshToken` se intenta un refresh inicial; si no, se marca la app como inicializada para que `ProtectedRoute` decida la navegación.

Configurar la variable `REACT_APP_API_BASE_URL` en `.env` del frontend (ver `.env.example`).

## Página Principal (Dashboard)

La página principal ahora muestra:
- Métrica rápida de número de casos cargados.
- Estado de salud (database / redis) consumiendo `GET /api/health/`.
- Lista de casos paginados (usa `results` si existe, o array directo si la paginación se modifica).

A futuro: añadir widgets de documentos recientes, plazos próximos y resumen IA.

## Próximos Pasos Sugeridos
- Añadir OpenAPI schema (drf-spectacular)
- Añadir throttling DRF y rate limit a endpoints IA
- Configurar almacenamiento S3 para `MEDIA_ROOT`
