// src/store/authStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '../api/axios';

const REFRESH_MARGIN_MS = 60 * 1000; // 1 min before expiry

// Conditionally wrap state updates in React's act() during tests
let __testAct = null;
if (process.env.NODE_ENV === 'test') {
  try {
    __testAct = require('react').act;
  } catch (_) {
    try {
      __testAct = require('react-dom/test-utils').act;
    } catch (_) {
      __testAct = null;
    }
  }
}
const runAct = (fn) => { (__testAct ? __testAct(fn) : fn()); };

// Utility: Decodificar y extraer tiempo de expiración del JWT
const getTokenExpiry = (token) => {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp) {
      const nowSec = Date.now() / 1000;
      return payload.exp - nowSec; // segundos hasta expiración
    }
  } catch (e) {
    console.error('[Auth] Error decodificando token:', e);
  }
  return null;
};

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

      // --- MÉTODO CRÍTICO: Actualizar Tokens con Persistencia Garantizada ---
      updateTokens: (accessToken, refreshToken = null) => {
        const newState = {
          accessToken,
          isAuthenticated: true,
          showExpiryModal: false,
          expiryModalCountdown: null,
        };

        // Si viene nuevo refresh token (por rotation), actualizarlo
        if (refreshToken) {
          newState.refreshToken = refreshToken;
          console.log('[Auth] ✅ Tokens actualizados (access + refresh rotado)');
        } else {
          console.log('[Auth] ✅ Access token actualizado');
        }

        // Actualizar estado (esto triggerea persist automáticamente)
        set(newState);

        // Programar próximo refresh basado en expiración del access token
        const expiresIn = getTokenExpiry(accessToken);
        if (expiresIn && expiresIn > 0) {
          get().scheduleRefresh(expiresIn);
        }
      },

      scheduleRefresh: (expiresInSeconds) => {
        const { refreshAccessToken, clearRefreshTimer, clearWarningTimer } = get();
        clearRefreshTimer();
        clearWarningTimer();

        if (!expiresInSeconds || expiresInSeconds <= 0) {
          console.warn('[Auth] ⚠️ Tiempo de expiración inválido, no se programa refresh');
          return;
        }

        // Refresh automático 1 min antes de expirar (o 10s si expira muy pronto)
        const timeoutMs = Math.max((expiresInSeconds * 1000) - REFRESH_MARGIN_MS, 10_000);

        console.log(`[Auth] 🕐 Refresh programado en ${Math.round(timeoutMs / 1000)}s (expira en ${Math.round(expiresInSeconds)}s)`);

        // Programar aviso modal 30s antes de expirar
        const warningMs = (expiresInSeconds * 1000) - 30_000;
        if (warningMs > 0) {
          const warnId = setTimeout(() => {
            const state = get();
            if (!state.showExpiryModal) {
              console.log('[Auth] ⚠️ Mostrando advertencia de expiración');
              runAct(() => set({ showExpiryModal: true, expiryModalCountdown: 30 }));

              // Countdown interno
              let left = 30;
              const interval = setInterval(() => {
                left -= 1;
                if (left <= 0) clearInterval(interval);
                runAct(() => set({ expiryModalCountdown: left }));
              }, 1000);
            }
          }, warningMs);
          set({ warningTimeoutId: warnId });
        }

        const id = setTimeout(() => {
          console.log('[Auth] 🔄 Ejecutando refresh automático programado');
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
          console.warn('[Auth] No se pudo actualizar la sesión:', e);
        }
      },

      updatePreferredJurisdiccion: async (jurisdiccionId) => {
        try {
          const resp = await apiClient.patch('/auth/session/', {
            preferred_jurisdiccion_id: jurisdiccionId,
          });
          const { user, metrics } = resp.data;
          runAct(() => set({ user, sessionMetrics: metrics }));
          return { success: true };
        } catch (e) {
          console.warn('[Auth] No se pudo actualizar la jurisdicción preferida:', e);
          return { success: false, error: 'No se pudo actualizar la jurisdicción preferida.' };
        }
      },

      loadCases: async () => {
        try {
          set({ casesLoading: true, casesError: null });
          const response = await apiClient.get('/casos/');
          const list = response.data.results || response.data;
          runAct(() => set({ cases: Array.isArray(list) ? list : [], casesLoading: false }));
        } catch (err) {
          console.warn('[Auth] No se pudieron cargar los casos:', err);
          runAct(() => set({
            casesError: 'No se pudieron cargar los casos. Inténtelo más tarde.',
            casesLoading: false
          }));
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
          console.log('[Auth] 🔑 Iniciando sesión...');

          const response = await apiClient.post('/token/', { username, password });
          const { access, refresh, user } = response.data;

          // Usar método dedicado para actualizar tokens
          get().updateTokens(access, refresh);

          // Actualizar usuario
          set({ user });

          console.log('[Auth] ✅ Sesión iniciada correctamente');

          // Cargar datos de sesión después del login
          await get().loadAllSessionData();

          set({ isLoading: false });
          return { success: true };
        } catch (error) {
          console.error('[Auth] ❌ Error en el login:', error);

          let message = 'Ocurrió un error al iniciar sesión.';
          if (error?.code === 'ECONNABORTED') {
            message = 'Tiempo de espera agotado. Verifica tu conexión e inténtalo de nuevo.';
          } else if (error?.response?.status === 401) {
            message = 'Credenciales inválidas.';
          } else if (error?.response?.data?.detail) {
            message = error.response.data.detail;
          }

          set({
            accessToken: null,
            refreshToken: null,
            user: null,
            isAuthenticated: false,
            isLoading: false
          });

          return { success: false, error: message };
        }
      },

      refreshAccessToken: async () => {
        const { refreshToken, logout } = get();

        if (!refreshToken) {
          console.warn('[Auth] ⚠️ No hay refresh token disponible');
          return;
        }

        try {
          console.log('[Auth] 🔄 Refrescando access token...');

          const response = await apiClient.post('/token/refresh/', { refresh: refreshToken });
          const newAccess = response.data.access;
          const newRefresh = response.data.refresh; // Puede venir si ROTATE_REFRESH_TOKENS=True

          // Usar método dedicado para actualizar ambos tokens
          get().updateTokens(newAccess, newRefresh);

          console.log('[Auth] ✅ Token refrescado exitosamente');

          // Recargar datos de sesión en segundo plano (sin bloquear)
          get().loadAllSessionData().catch(err => {
            console.warn('[Auth] Error cargando datos tras refresh:', err);
          });

        } catch (error) {
          console.error('[Auth] ❌ Fallo al refrescar token:', error);

          // Determinar si es error de token inválido/expirado o error de red
          if (error?.response?.status === 401) {
            console.log('[Auth] Token inválido o expirado, cerrando sesión');
            logout();
          } else {
            console.warn('[Auth] Error de red/servidor al refrescar, reintentando en 5s...');
            // Reintentar una vez después de 5 segundos
            setTimeout(() => {
              const state = get();
              if (state.refreshToken) {
                console.log('[Auth] 🔄 Reintentando refresh...');
                state.refreshAccessToken();
              }
            }, 5000);
          }
        }
      },

      logout: () => {
        const { refreshToken, clearRefreshTimer, clearWarningTimer } = get();

        console.log('[Auth] 🚪 Cerrando sesión...');

        clearRefreshTimer();
        clearWarningTimer();

        // Invalidar refresh token en backend (best-effort)
        if (refreshToken) {
          apiClient.post('/auth/logout/', { refresh: refreshToken }).catch(err => {
            console.error('[Auth] Error al invalidar token en backend:', err);
          });
        }

        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          sessionMetrics: null,
          cases: [],
          health: null,
          isAuthenticated: false,
          isLoading: false,
          showExpiryModal: false,
          expiryModalCountdown: null,
          warningTimeoutId: null
        });

        console.log('[Auth] ✅ Sesión cerrada');
      },

      setAccessToken: (token) => {
        set({ accessToken: token, isLoading: false, isAuthenticated: true });
      },

      setInitialized: () => {
        set({ isLoading: false });
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        sessionMetrics: state.sessionMetrics
      }),
    }
  )
);