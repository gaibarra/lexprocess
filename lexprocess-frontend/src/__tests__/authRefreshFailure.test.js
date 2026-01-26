/** @jest-environment jsdom */
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { useAuthStore } from '../store/authStore';
import { __setPostHandler, __setGetHandler } from 'axios';
import { nextId, resetIds } from '../testUtils/idGen';
import { resetUniqueKeyLog, assertUniqueKeys } from '../testUtils/assertUniqueKeys';

global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ database: 'ok', redis: 'ok', app: 'ok' }) }));

const buildJWT = (expOffsetSeconds = 60) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now()/1000) + expOffsetSeconds }));
  return `${header}.${payload}.signature`;
};

beforeEach(() => {
  resetIds();
  localStorage.clear();
  useAuthStore.getState().logout();
  jest.useFakeTimers();
  resetUniqueKeyLog();
  let failRefresh = true;
  __setPostHandler((url, body) => {
    if (url === '/token/') {
      failRefresh = true;
      return Promise.resolve({ data: { access: buildJWT(30), refresh: 'refresh-token-demo', user: { id: nextId(), username: body.username, profile: { rol: 'ABOGADO' }, permissions: { is_staff: false, is_superuser: false } } } });
    }
    if (url === '/token/refresh/') {
  if (failRefresh) return Promise.reject({ response: { status: 401 }, config: { _retry: false, url:'/token/refresh/' } });
      return Promise.resolve({ data: { access: buildJWT(30) } });
    }
    if (url === '/auth/logout/') return Promise.resolve({ data: { detail: 'ok' } });
    return Promise.resolve({ data: {} });
  });
  __setGetHandler((url) => {
    if (url === '/casos/') return Promise.resolve({ data: { results: [] } });
    if (url === '/users/me/') return Promise.resolve({ data: { id: nextId(), username: 'demo', profile: { rol: 'ABOGADO' }, permissions: { is_staff: false, is_superuser: false } } });
    if (url === '/auth/session/') return Promise.resolve({ data: { user:{ id: nextId(), username:'demo' }, metrics:{} } });
    return Promise.resolve({ data: {} });
  });
});

test('logout tras fallo de refresh', async () => {
  render(<App />);
  await userEvent.type(screen.getByLabelText(/Usuario/i), 'demo');
  await userEvent.type(screen.getByLabelText(/Contraseña/i), 'secret');
  await userEvent.click(screen.getByRole('button', { name: /Iniciar Sesión/i }));
  expect(await screen.findByText(/Mis Casos/i)).toBeInTheDocument();

  // Avanzar tiempo para que ocurra intento de refresh (30s token - 60s margin => se agenda a 10s min)
  await act(async () => { jest.advanceTimersByTime(12_000); });
  // Permitir que se resuelvan microtareas/promesas del flujo de refresh
  await act(async () => { await Promise.resolve(); });
  await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(false), { timeout: 2000 });
  expect(await screen.findByText(/Iniciar Sesión/i)).toBeInTheDocument();
  assertUniqueKeys();
});

afterEach(()=>{
  jest.useRealTimers();
});
