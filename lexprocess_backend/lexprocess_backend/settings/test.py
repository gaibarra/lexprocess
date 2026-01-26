from .dev import *  # noqa

# Celery en modo eager para que las tareas se ejecuten inmediatamente en tests
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Opcional: reducir logging ruido
for lg in ['django', 'celery', 'ia_integration']:
    LOGGING['loggers'][lg]['level'] = 'WARNING'  # type: ignore
