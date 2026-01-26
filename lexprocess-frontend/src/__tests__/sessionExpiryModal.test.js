/** @jest-environment jsdom */
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { useAuthStore } from '../store/authStore';
import { __setPostHandler, __setGetHandler } from 'axios';
import { nextId, resetIds } from '../testUtils/idGen';
import { resetUniqueKeyLog, assertUniqueKeys } from '../testUtils/assertUniqueKeys';

const buildJWT = (expOffsetSeconds) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now()/1000) + expOffsetSeconds }));
  return `${header}.${payload}.sig`;
};

beforeEach(() => {
  resetIds();
  localStorage.clear();
  useAuthStore.getState().logout();
  jest.useFakeTimers();
  resetUniqueKeyLog();
  __setPostHandler((url, body) => {
    if (url === '/token/') return Promise.resolve({ data: { access: buildJWT(35), refresh:'refresh-demo', user:{ id: nextId(), username: body.username, profile:{ rol:'ABOGADO' }, permissions:{ is_staff:false, is_superuser:false } } } });
    if (url === '/token/refresh/') return Promise.resolve({ data: { access: buildJWT(60) } });
    if (url === '/auth/logout/') return Promise.resolve({ data: { detail:'ok' } });
    return Promise.resolve({ data: {} });
  });
  __setGetHandler((url) => {
    if (url === '/casos/') return Promise.resolve({ data: { results: [] } });
    if (url === '/auth/session/') return Promise.resolve({ data: { user:{ id: nextId(), username:'demo', profile:{ rol:'ABOGADO'}, permissions:{ is_staff:false, is_superuser:false } }, metrics:{ documentos_total:0, casos_total:0, casos_activos:0, plazos_proximos_7d:0 } } });
    if (url === '/users/me/') return Promise.resolve({ data: { id: nextId(), username:'demo' } });
    return Promise.resolve({ data: {} });
  });
});

afterEach(()=>{
  jest.useRealTimers();
});

// Mock global fetch para health endpoint
global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ database: 'ok', redis: 'ok', app: 'ok' }) }));

/**
 * Escenario: token de 35s =>
 *  - scheduleRefresh: refrescará en 10s (mínimo)
 *  - modal de advertencia aparece a los 5s (35s - 30s)
 */

describe('Modal de expiración de sesión', () => {
  // timers fake se activan en beforeAll ya definido abajo

  test('aparece modal ~5s después del login y countdown decrece', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/Usuario/i), 'demo');
    await userEvent.type(screen.getByLabelText(/Contraseña/i), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /Iniciar Sesión/i }));

    // Dashboard visible
    expect(await screen.findByText(/Mis Casos/i)).toBeInTheDocument();

    // Avanzamos 3s -> aún NO debería mostrarse (margen por redondeos de exp)
  await act(async () => { jest.advanceTimersByTime(3000); });
    await waitFor(() => expect(screen.queryByText(/Sesión a punto de expirar/i)).toBeNull());

    // Avanzamos 2.5s más (total 5.5s) -> modal aparece
  await act(async () => { jest.advanceTimersByTime(2500); });
    expect(await screen.findByText(/Sesión a punto de expirar/i)).toBeInTheDocument();
    const initialCountdown = screen.getByText(/Restante:/i).textContent;

    // Avanzar 3000 ms y verificar que ha bajado el contador (de ~30s a ~27s)
  await act(async () => { jest.advanceTimersByTime(3000); });
  const afterCountdown = screen.getByText(/Restante:/i).textContent;
  const initialNum = parseInt(initialCountdown.match(/(\d+)s/)[1],10);
  const afterNum = parseInt(afterCountdown.match(/(\d+)s/)[1],10);
  expect(afterNum).toBeLessThan(initialNum);
  assertUniqueKeys();
  });

  test('botón Cerrar ahora ejecuta logout', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/Usuario/i), 'demo');
    await userEvent.type(screen.getByLabelText(/Contraseña/i), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /Iniciar Sesión/i }));
    expect(await screen.findByText(/Mis Casos/i)).toBeInTheDocument();

    // Forzar aparición de modal
  await act(async () => { jest.advanceTimersByTime(6000); });
    expect(await screen.findByText(/Sesión a punto de expirar/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Cerrar ahora/i }));
    // Debe volver a formulario de login
    expect(await screen.findByText(/Iniciar Sesión/i)).toBeInTheDocument();
  assertUniqueKeys();
  });
});
