# Deploy lexprocess.online (Ubuntu 24.04)

Este directorio contiene archivos base para desplegar con Nginx + Gunicorn + systemd + Supervisor + Certbot.

## 1) Ajusta rutas y usuario

Por defecto se usan rutas en `/srv/lexprocess`. Si tu proyecto vive en otra ruta, reemplázala en:

- `deploy/gunicorn.service`
- `deploy/gunicorn.socket`
- `deploy/supervisor-celery.conf`
- `deploy/nginx-lexprocess.conf`

Crea un usuario de sistema, por ejemplo `lexprocess`, con permisos sobre el directorio del proyecto.

## 2) Variables de entorno (backend)

Crea `/etc/lexprocess/lexprocess.env`:

```
DJANGO_SETTINGS_MODULE=lexprocess_backend.settings.prod
DJANGO_SECRET_KEY=REEMPLAZA_ESTA_CLAVE
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=lexprocess.online,www.lexprocess.online
CORS_ALLOWED_ORIGINS=https://lexprocess.online,https://www.lexprocess.online
DB_NAME=lexprocess_db
DB_USER=lexprocess_user
DB_PASSWORD=REEMPLAZA_PASSWORD
DB_HOST=localhost
DB_PORT=5432
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0
CHANNEL_REDIS_URL=redis://localhost:6379/1
```

## 3) Backend (venv + collectstatic)

```
python3 -m venv /srv/lexprocess/lexprocess_backend/venv
/srv/lexprocess/lexprocess_backend/venv/bin/pip install -r /srv/lexprocess/lexprocess_backend/requirements.txt
/srv/lexprocess/lexprocess_backend/venv/bin/python /srv/lexprocess/lexprocess_backend/manage.py migrate
/srv/lexprocess/lexprocess_backend/venv/bin/python /srv/lexprocess/lexprocess_backend/manage.py collectstatic --noinput
```

## 4) Frontend (build)

```
cd /srv/lexprocess/lexprocess-frontend
npm install
PUBLIC_URL=/assets REACT_APP_API_BASE_URL=https://lexprocess.online npm run build
```

## 5) systemd (gunicorn)

```
sudo mkdir -p /run/lexprocess /var/log/lexprocess
sudo cp /srv/lexprocess/deploy/gunicorn.socket /etc/systemd/system/gunicorn-lexprocess.socket
sudo cp /srv/lexprocess/deploy/gunicorn.service /etc/systemd/system/gunicorn-lexprocess.service
sudo systemctl daemon-reload
sudo systemctl enable --now gunicorn-lexprocess.socket
sudo systemctl status gunicorn-lexprocess.service
```

## 6) Supervisor (celery + beat)

```
sudo apt-get install -y supervisor
sudo cp /srv/lexprocess/deploy/supervisor-celery.conf /etc/supervisor/conf.d/lexprocess-celery.conf
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl status
```

## 7) Nginx

```
sudo cp /srv/lexprocess/deploy/nginx-lexprocess.conf /etc/nginx/sites-available/lexprocess
sudo ln -s /etc/nginx/sites-available/lexprocess /etc/nginx/sites-enabled/lexprocess
sudo nginx -t
sudo systemctl reload nginx
```

## 8) Certbot (HTTPS)

```
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d lexprocess.online -d www.lexprocess.online
```

## 9) Verificación rápida

- Backend health: `https://lexprocess.online/api/health/`
- Frontend: `https://lexprocess.online`

## 10) Puertos y conflictos

Usamos socket Unix en `/run/lexprocess/gunicorn.sock` para evitar conflictos de puertos.
Para validar puertos activos en el VPS:

```
ss -tulpn
sudo lsof -i -P -n | grep LISTEN
```

Si ya existe Nginx en el puerto 80/443, agrega este server block como nuevo sitio y evita duplicados en `server_name`.

## 11) Verificación de WebSocket

Prueba el endpoint:

```
wss://lexprocess.online/ws/boletines/?token=<access_jwt>
```
