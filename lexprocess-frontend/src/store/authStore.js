// src/store/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '../api/axios';

const REFRESH_MARGIN_MS = 60 * 1000; // 1 min before expiry
// Conditionally wrap state updates in React's act() during tests to silence warnings
// without pulling act into the production bundle. We avoid importing from 'react'
// (not exported) and instead require from 'react-dom/test-utils' only when NODE_ENV=test.
let __testAct = null;
if (process.env.NODE_ENV === 'test') {
  try {
    // Prefer the official export from react (React 19+)
    // eslint-disable-next-line global-require
    __testAct = require('react').act;
  } catch (_) {
    try {
      // Fallback for older versions (should not be needed now)
      // eslint-disable-next-line global-require, import/no-extraneous-dependencies
      __testAct = require('react-dom/test-utils').act;
    } catch (_) {
      __testAct = null;
    }
  }
}
const runAct = (fn) => { (__testAct ? __testAct(fn) : fn()); };

export const useAuthStore = create(
  persist(
    (set, get) => ({
      // --- ESTADO ---
      accessToken: null,
      refreshToken: null,
      user: null,
      sessionMetrics: null,
  cases: [],
  casesLoading: false,
  casesError: null,
  health: null,
  healthLoading: false,
      isAuthenticated: false,
      isLoading: true,
      refreshTimeoutId: null,
      showExpiryModal: false,
      expiryModalCountdown: null,
  warningTimeoutId: null,

  scheduleRefresh: (expiresInSeconds) => {
        const { refreshAccessToken, clearRefreshTimer, clearWarningTimer } = get();
        clearRefreshTimer();
        clearWarningTimer();
        if (!expiresInSeconds || expiresInSeconds <= 0) return;
        const timeoutMs = Math.max((expiresInSeconds * 1000) - REFRESH_MARGIN_MS, 10_000);
        // Programar aviso modal 30s antes de expirar si no se logra refrescar
        const warningMs = (expiresInSeconds * 1000) - 30_000;
        if (warningMs > 0) {
          const warnId = setTimeout(() => {
            const state = get();
            if (!state.showExpiryModal) {
              runAct(() => set({ showExpiryModal: true, expiryModalCountdown: 30 }));
              // Countdown interno
              let left = 30;
              const interval = setInterval(() => {
                left -= 1;
                if (left <= 0) {
                  clearInterval(interval);
                }
                runAct(() => set({ expiryModalCountdown: left }));
              }, 1000);
            }
          }, warningMs);
          set({ warningTimeoutId: warnId });
        }
        const id = setTimeout(() => {
          refreshAccessToken();
        }, timeoutMs);
        set({ refreshTimeoutId: id });
      },
      clearRefreshTimer: () => {
        const { refreshTimeoutId } = get();
        if (refreshTimeoutId) {
          clearTimeout(refreshTimeoutId);
          set({ refreshTimeoutId: null });
        }
      },
      clearWarningTimer: () => {
        const { warningTimeoutId } = get();
        if (warningTimeoutId) {
          clearTimeout(warningTimeoutId);
          set({ warningTimeoutId: null });
        }
      },

      // Fetch fresh user profile
    fetchCurrentUser: async () => {
        try {
          const resp = await apiClient.get('/auth/session/');
          const { user, metrics } = resp.data;
      runAct(() => set({ user, sessionMetrics: metrics }));
        } catch (e) {
          console.warn('No se pudo actualizar la sesión:', e);
        }
      },

    loadCases: async () => {
        try {
      set({ casesLoading: true, casesError: null });
          const response = await apiClient.get('/casos/');
          const list = response.data.results || response.data;
      runAct(() => set({ cases: Array.isArray(list) ? list : [], casesLoading: false }));
        } catch (err) {
          console.warn('No se pudieron cargar los casos:', err);
      runAct(() => set({ casesError: 'No se pudieron cargar los casos. Inténtelo más tarde.', casesLoading: false }));
        }
      },

  loadHealth: async () => {
        try {
          set({ healthLoading: true });
          const base = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/?api\/v1\/?$/, '');
          const resp = await fetch(base + '/api/health/');
          if (resp.ok) {
            const data = await resp.json();
    runAct(() => set({ health: data }));
          }
        } catch (_) { /* noop */ }
        finally {
      set({ healthLoading: false });
        }
      },

      loadAllSessionData: async () => {
        // Ejecuta las cargas clave en paralelo
        await Promise.allSettled([
          get().fetchCurrentUser(),
          get().loadCases(),
          get().loadHealth()
        ]);
      },

      refreshSessionMetrics: async () => {
        await get().fetchCurrentUser();
      },

    login: async (username, password) => {
        try {
      set({ isLoading: true });
      const response = await apiClient.post('/token/', { username, password });
      const { access, refresh, user } = response.data;
          let expiresIn = null;
          try {
            const payload = JSON.parse(atob(access.split('.')[1]));
            if (payload.exp) {
              const nowSec = Date.now() / 1000;
              expiresIn = payload.exp - nowSec;
            }
          } catch (_) {}
      set({ accessToken: access, refreshToken: refresh, user, isAuthenticated: true });
      if (expiresIn) get().scheduleRefresh(expiresIn);
      // Cargar datos de sesión (usuario+metrics, casos, health)
      await get().loadAllSessionData();
      set({ isLoading: false });
          return { success: true };
        } catch (error) {
          console.error('Error en el login:', error);
          set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false, isLoading: false });
          return { success: false, error: 'Credenciales inválidas.' };
        }
      },

  refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) return;
        try {
          const response = await apiClient.post('/token/refresh/', { refresh: refreshToken });
          const access = response.data.access;
          const newRefresh = response.data.refresh || refreshToken; // si ROTATE_REFRESH_TOKENS True, backend puede devolver nuevo refresh
          let expiresIn = null;
          try {
            const payload = JSON.parse(atob(access.split('.')[1]));
            if (payload.exp) {
              const nowSec = Date.now() / 1000;
              expiresIn = payload.exp - nowSec;
            }
          } catch (_) {}
          // Al refrescar exitosamente se limpia cualquier modal de expiración existente
          runAct(() => set({ accessToken: access, refreshToken: newRefresh, isAuthenticated: true, showExpiryModal: false, expiryModalCountdown: null }));
          if (expiresIn) get().scheduleRefresh(expiresIn);
          await get().loadAllSessionData();
        } catch (error) {
          console.warn('Fallo al refrescar token, cerrando sesión.', error);
          get().logout();
        }
      },

      logout: () => {
        const { refreshToken, clearRefreshTimer, clearWarningTimer } = get();
        clearRefreshTimer();
        clearWarningTimer();
        if (refreshToken) {
          apiClient.post('/auth/logout/', { refresh: refreshToken }).catch(err => {
            console.error('Fallo en el logout del backend.', err);
          });
        }
        set({ accessToken: null, refreshToken: null, user: null, sessionMetrics: null, cases: [], health: null, isAuthenticated: false, isLoading: false, showExpiryModal: false, expiryModalCountdown: null, warningTimeoutId: null });
      },

  setAccessToken: (token) => { set({ accessToken: token, isLoading: false, isAuthenticated: true }); },
  setInitialized: () => { set({ isLoading: false }); },
  setLoading: (loading) => { set({ isLoading: loading }); },
    }),
    {
      name: 'auth-storage',
  partialize: (state) => ({ refreshToken: state.refreshToken, user: state.user, isAuthenticated: state.isAuthenticated, sessionMetrics: state.sessionMetrics }),
    }
  )
);