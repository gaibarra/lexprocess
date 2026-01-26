// src/api/axios.js
import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const normalizeApiBaseUrl = (value) => {
  if (!value) return '/api/v1';
  const trimmed = value.endsWith('/') ? value.slice(0, -1) : value;
  return trimmed.endsWith('/api/v1') ? trimmed : `${trimmed}/api/v1`;
};

const apiClient = axios.create({
  baseURL: normalizeApiBaseUrl(process.env.REACT_APP_API_BASE_URL),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para añadir el token de autenticación a cada petición
apiClient.interceptors.request.use(
  (config) => {
    const accessToken = useAuthStore.getState().accessToken;
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

let isRefreshing = false;
let pendingQueue = [];

const processQueue = (error, token = null) => {
  pendingQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  pendingQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response && error.response.status === 401) {
      // Si el 401 proviene directamente del endpoint de refresh, cortar y forzar logout
      if (originalRequest?.url && originalRequest.url.includes('/token/refresh/')) {
        try { useAuthStore.getState().logout(); } catch(_) {}
        return Promise.reject(error);
      }
      if (!originalRequest._retry) {
      originalRequest._retry = true;
      const store = useAuthStore.getState();
      const { refreshToken, logout } = store;
      if (!refreshToken) {
        logout();
        return Promise.reject(error);
      }
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = 'Bearer ' + token;
          return apiClient(originalRequest);
        });
      }
      isRefreshing = true;
      try {
        // IMPORTANTE: Antes se usaba axios.post('/token/refresh/') sin baseURL.
        // Eso hace la petición contra el origen del frontend (p.ej. http://localhost:3000/token/refresh/)
        // en lugar del backend (http://127.0.0.1:8000/api/v1/token/refresh/), provocando 404/401 y logout.
        // Construimos explícitamente la URL usando el baseURL configurado en apiClient.
        const baseURL = apiClient.defaults.baseURL || '';
        const normalizedBase = baseURL?.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
        // Si tu backend realmente expone el refresh bajo /auth/token/refresh/ ajusta la línea siguiente:
        const refreshPath = '/token/refresh/'; // Cambiar a '/auth/token/refresh/' si corresponde.
        const resp = await axios.post(normalizedBase + refreshPath, { refresh: refreshToken });
        const newAccess = resp.data.access;
        const maybeNewRefresh = resp.data.refresh; // algunos backends rotan refresh
        const storeAfter = useAuthStore.getState();
        storeAfter.setAccessToken(newAccess);
        if (maybeNewRefresh) {
          // Actualizamos el refreshToken en el store directamente (no hay setter dedicado)
          useAuthStore.setState({ refreshToken: maybeNewRefresh });
        }
        // Re-programar refresh automático calculando exp del nuevo access
        try {
          const payload = JSON.parse(atob(newAccess.split('.')[1]));
          if (payload?.exp) {
            const nowSec = Date.now() / 1000;
            const expiresIn = payload.exp - nowSec;
            if (expiresIn > 0 && storeAfter.scheduleRefresh) {
              storeAfter.scheduleRefresh(expiresIn);
            }
          }
        } catch (_) { /* silenciosamente ignorar fallo de decode */ }
        processQueue(null, newAccess);
        originalRequest.headers.Authorization = 'Bearer ' + newAccess;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        logout();
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
      }
    }
    return Promise.reject(error);
  }
);

// Aquí se podría añadir un interceptor de respuestas para manejar
// el refresco automático de tokens si se desea un comportamiento más avanzado.

export default apiClient;