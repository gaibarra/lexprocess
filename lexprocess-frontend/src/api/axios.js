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
  timeout: 10000,
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
      // Si el 401 proviene del endpoint de refresh, logout inmediato
      if (originalRequest?.url && originalRequest.url.includes('/token/refresh/')) {
        console.error('[Axios] ❌ Refresh token inválido/expirado');
        try {
          useAuthStore.getState().logout();
        } catch (_) { }
        return Promise.reject(error);
      }

      // Evitar loops de retry
      if (!originalRequest._retry) {
        originalRequest._retry = true;
        const store = useAuthStore.getState();
        const { refreshToken, logout, updateTokens } = store;

        if (!refreshToken) {
          console.warn('[Axios] ⚠️ No hay refresh token, cerrando sesión');
          logout();
          return Promise.reject(error);
        }

        // Manejar cola de peticiones mientras se refresca
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
          console.log('[Axios] 🔄 Intentando refrescar token (401 detectado)');

          // Hacer la petición de refresh
          const baseURL = apiClient.defaults.baseURL || '';
          const normalizedBase = baseURL?.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
          const refreshPath = '/token/refresh/';

          const resp = await axios.post(normalizedBase + refreshPath, { refresh: refreshToken });
          const newAccess = resp.data.access;
          const newRefresh = resp.data.refresh; // Viene si ROTATE_REFRESH_TOKENS=True

          // ✅ USAR MÉTODO DEDICADO DEL STORE
          updateTokens(newAccess, newRefresh);

          console.log('[Axios] ✅ Token refrescado por interceptor');

          // Procesar cola de peticiones pendientes
          processQueue(null, newAccess);

          // Reintentar petición original
          originalRequest.headers.Authorization = 'Bearer ' + newAccess;
          return apiClient(originalRequest);

        } catch (refreshErr) {
          console.error('[Axios] ❌ Fallo al refrescar token en interceptor:', refreshErr);

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

export default apiClient;