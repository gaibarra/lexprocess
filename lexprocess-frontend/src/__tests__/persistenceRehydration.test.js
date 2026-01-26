/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { __setPostHandler, __setGetHandler } from 'axios';
import { nextId, resetIds } from '../testUtils/idGen';
import { resetUniqueKeyLog, assertUniqueKeys } from '../testUtils/assertUniqueKeys';

const buildJWT = (expOffsetSeconds=120) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now()/1000) + expOffsetSeconds }));
  return `${header}.${payload}.sig`;
};

global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ database: 'ok', redis: 'ok', app: 'ok' }) }));

beforeEach(()=>{
  resetIds();
  localStorage.clear();
  jest.useFakeTimers();
  resetUniqueKeyLog();
  __setPostHandler((url, body) => {
    if (url === '/token/') return Promise.resolve({ data: { access: buildJWT(), refresh: 'refresh-persist', user:{ id: nextId(), username: body.username, profile:{ rol:'ABOGADO'}, permissions:{ is_staff:false, is_superuser:false } } } });
    if (url === '/token/refresh/') return Promise.resolve({ data: { access: buildJWT() } });
    return Promise.resolve({ data: {} });
  });
  __setGetHandler((url)=>{
    if (url === '/auth/session/') return Promise.resolve({ data: { user:{ id: nextId(), username:'demo', profile:{ rol:'ABOGADO'}, permissions:{ is_staff:false, is_superuser:false } }, metrics:{ documentos_total:5, casos_total:2, casos_activos:2, plazos_proximos_7d:1 } } });
    if (url === '/casos/') return Promise.resolve({ data: { results: [] } });
    if (url === '/users/me/') return Promise.resolve({ data: { id: nextId(), username:'demo' } });
    return Promise.resolve({ data: {} });
  });
});

afterEach(()=>{ jest.useRealTimers(); });

test('rehidratación del store mantiene sesión tras recarga simulada', async () => {
  // Primer render y login
  const { unmount } = render(<App />);
  await userEvent.type(screen.getByLabelText(/Usuario/i), 'demo');
  await userEvent.type(screen.getByLabelText(/Contraseña/i), 'secret');
  await userEvent.click(screen.getByRole('button', { name: /Iniciar Sesión/i }));
  expect(await screen.findByText(/Mis Casos/i)).toBeInTheDocument();
  // Ver rol
  expect(await screen.findByText(/ABOGADO/)).toBeInTheDocument();
  assertUniqueKeys();
  // Unmount simula cerrar la app (persist queda en localStorage)
  unmount();

  // Nuevo set de handlers para segunda carga (sin volver a llamar /token/)
  __setPostHandler((url) => {
    if (url === '/token/refresh/') return Promise.resolve({ data: { access: buildJWT() } });
    return Promise.resolve({ data: {} });
  });

  render(<App />);
  // Debe rehidratar y mostrar dashboard sin pedir credenciales de nuevo
  expect(await screen.findByText(/Mis Casos/i)).toBeInTheDocument();
  expect(await screen.findByText(/ABOGADO/)).toBeInTheDocument();
  assertUniqueKeys();
});
