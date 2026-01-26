from .base import *  # noqa

# Overrides específicas de desarrollo
debug_toolbar = os.getenv('ENABLE_DEBUG_TOOLBAR', 'False') == 'True'
if debug_toolbar:
    INSTALLED_APPS += ['debug_toolbar']  # type: ignore
    MIDDLEWARE.insert(0, 'debug_toolbar.middleware.DebugToolbarMiddleware')  # type: ignore
    INTERNAL_IPS = ['127.0.0.1']

# En dev permitimos todo origen (restringir manualmente si quieres)
CORS_ALLOW_ALL_ORIGINS = True
