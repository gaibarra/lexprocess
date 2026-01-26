/**
 * @jest-environment jsdom
 */
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { useAuthStore } from '../store/authStore';
import { __setPostHandler, __setGetHandler } from 'axios';
import { resetUniqueKeyLog, assertUniqueKeys } from '../testUtils/assertUniqueKeys';
import { nextId, resetIds } from '../testUtils/idGen';

// Mock fetch for /api/health and other direct fetches
global.fetch = jest.fn((url) => {
  if (url.includes('/api/health')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ database: 'ok', redis: 'ok', app: 'ok' }) });
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
});

const buildJWT = (expOffsetSeconds = 120) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now()/1000) + expOffsetSeconds }));
  return `${header}.${payload}.signature`;
};

beforeEach(() => {
  resetUniqueKeyLog();
  resetIds();
  // limpiar persistencia entre tests
  localStorage.clear();
  jest.useFakeTimers();
  __setPostHandler((url, body) => {
    if (url === '/token/') {
      return Promise.resolve({ data: { access: buildJWT(), refresh: 'refresh-token-demo', user: { id: nextId(), username: body.username, first_name: 'Test', profile: { rol: 'ABOGADO' }, permissions: { is_staff: false, is_superuser: false } } } });
    }
    if (url === '/token/refresh/') {
      return Promise.resolve({ data: { access: buildJWT(300) } });
    }
    if (url === '/auth/logout/') {
      return Promise.resolve({ data: { detail: 'ok' } });
    }
    return Promise.resolve({ data: {} });
  });
  __setGetHandler((url) => {
    if (url === '/casos/') return Promise.resolve({ data: { results: [] } });
    if (url === '/users/me/') return Promise.resolve({ data: { id: nextId(), username: 'demo', first_name: 'Test', profile: { rol: 'ABOGADO' }, permissions: { is_staff: false, is_superuser: false } } });
    if (url === '/auth/session/') return Promise.resolve({ data: { user:{ id: nextId(), username:'demo', first_name:'Test', profile:{ rol:'ABOGADO' }, permissions:{ is_staff:false, is_superuser:false } }, metrics:{ casos_activos:0, plazos_proximos_7d:0, documentos_total:0 } } });
    return Promise.resolve({ data: {} });
  });
});

describe('Flujo de autenticación', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
  });

  test('login y refresco silencioso', async () => {
    render(<App />);

    // Navega a login si protegido
    expect(await screen.findByText(/Iniciar Sesión/i)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Usuario/i), 'demo');
    await userEvent.type(screen.getByLabelText(/Contraseña/i), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /Iniciar Sesión/i }));

    // Dashboard visible
    expect(await screen.findByText(/Mis Casos/i)).toBeInTheDocument();

    // Simular paso de tiempo para ejecutar refresh programado
    await act(async () => {
      jest.advanceTimersByTime(90 * 1000); // 90s
    });

  // Usuario todavía autenticado
    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
  assertUniqueKeys();
  });
});

afterEach(()=>{
  jest.useRealTimers();
});
