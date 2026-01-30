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

### Endpoints de Autenticación:
- `POST /api/v1/token/` - Login (credenciales → {access, refresh, user})
- `POST /api/v1/token/refresh/` - Refresh (refresh → {access, refresh})
- `POST /api/v1/auth/logout/` - Logout (refresh token en body para blacklist)

### Configuración JWT Optimizada:
```python
ACCESS_TOKEN_LIFETIME: 30 minutos   # Tiempo de vida del access token
REFRESH_TOKEN_LIFETIME: 7 días      # Tiempo de vida del refresh token
ROTATE_REFRESH_TOKENS: True         # Genera nuevo refresh en cada renovación
BLACKLIST_AFTER_ROTATION: True      # Invalida refresh anterior
```

### Flujo de Autenticación en el Frontend:

1. **Login**: Al iniciar sesión se guarda `access`, `refresh` y `user` en el store persistente (localStorage).

2. **Token Rotation**: Con `ROTATE_REFRESH_TOKENS=True`, cada vez que se refresca el access token, el backend devuelve:
   - Nuevo `access` token (30 min de vida)
   - Nuevo `refresh` token (7 días de vida)
   - El `refresh` anterior se invalida automáticamente

3. **Persistencia Garantizada**: El método `updateTokens()` en el store:
   - Actualiza ambos tokens atómicamente
   - Triggerea el middleware de persistencia automáticamente
   - Programa el próximo refresh automático
   - Limpia timers de advertencia

4. **Refresh Automático**: Se programa ~1 minuto antes de que expire el access token.
   - Si el refresh falla (401): logout automático
   - Si hay error de red: reintento después de 5 segundos

5. **Interceptor Axios**: Detecta 401 automáticamente:
   - Pone peticiones en cola mientras refresca
   - Usa `updateTokens()` para persistir nuevos tokens
   - Reintenta la petición original automáticamente
   - Si refresh falla, ejecuta logout

6. **Logout**: Invalida el refresh token en backend (blacklist) y limpia todo el estado local.

7. **Inicialización de App**: Si hay `refreshToken` en localStorage:
   - Intenta refresh inmediato al cargar la app
   - Usa `updateTokens()` para manejar rotation correctamente
   - Si falla, ejecuta logout automático

### Logging de Autenticación:
Todos los eventos de autenticación se loggean con prefijo `[Auth]` o `[Axios]` para facilitar debugging:
- 🔑 Login iniciado
- ✅ Operaciones exitosas
- ⚠️ Advertencias
- ❌ Errores
- 🔄 Refresh de tokens
- 🕐 Timers programados
- 🚪 Logout

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

