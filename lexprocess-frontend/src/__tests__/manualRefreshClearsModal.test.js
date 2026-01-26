/** @jest-environment jsdom */
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { useAuthStore } from '../store/authStore';
import { __setPostHandler, __setGetHandler } from 'axios';
import { nextId, resetIds } from '../testUtils/idGen';
import { resetUniqueKeyLog, assertUniqueKeys } from '../testUtils/assertUniqueKeys';

// Utilidad para construir JWT con expiración controlada
const buildJWT = (expOffsetSeconds) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now()/1000) + expOffsetSeconds }));
  return `${header}.${payload}.sig`;
};

global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ database: 'ok', redis: 'ok', app: 'ok' }) }));

beforeEach(() => {
  resetIds();
  localStorage.clear();
  useAuthStore.getState().logout();
  jest.useFakeTimers();
  resetUniqueKeyLog();
  __setPostHandler((url, body) => {
  // Usamos un token que expira en 35s para que el warning (exp-30s => 5s) ocurra ANTES del refresh automático (mínimo 10s)
  if (url === '/token/') return Promise.resolve({ data: { access: buildJWT(35), refresh: 'refresh-demo', user: { id: nextId(), username: body.username, profile:{ rol:'ABOGADO'}, permissions:{ is_staff:false, is_superuser:false } } } });
    if (url === '/token/refresh/') return Promise.resolve({ data: { access: buildJWT(120) } });
    if (url === '/auth/logout/') return Promise.resolve({ data: { detail:'ok' } });
    return Promise.resolve({ data: {} });
  });
  __setGetHandler((url)=>{
    if (url === '/casos/') return Promise.resolve({ data: { results: [] } });
    if (url === '/auth/session/') return Promise.resolve({ data: { user:{ id: nextId(), username:'demo', profile:{ rol:'ABOGADO'}, permissions:{ is_staff:false, is_superuser:false } }, metrics:{ documentos_total:0, casos_total:0, casos_activos:0, plazos_proximos_7d:0 } } });
    if (url === '/users/me/') return Promise.resolve({ data: { id: nextId(), username:'demo'} });
    return Promise.resolve({ data: {} });
  });
});

afterEach(()=>{
  jest.useRealTimers();
});

test('refresh manual exitoso cierra el modal de expiración', async () => {
  render(<App />);
  await userEvent.type(screen.getByLabelText(/Usuario/i), 'demo');
  await userEvent.type(screen.getByLabelText(/Contraseña/i), 'secret');
  await userEvent.click(screen.getByRole('button', { name: /Iniciar Sesión/i }));
  expect(await screen.findByText(/Mis Casos/i)).toBeInTheDocument();

  // Avanzar tiempo hasta que aparezca el modal (35s token => warning a 5s, refresh automático programado a 10s)
  await act(async ()=> { jest.advanceTimersByTime(5_200); });
  expect(await screen.findByText(/Sesión a punto de expirar/i)).toBeInTheDocument();

  // Disparar refresh manual usando la acción del store
  await act(async () => { await useAuthStore.getState().refreshAccessToken(); });
  // Tras el refresh modal debe desaparecer
  await act(async () => { await Promise.resolve(); });
  expect(screen.queryByText(/Sesión a punto de expirar/i)).toBeNull();
  assertUniqueKeys();
});
