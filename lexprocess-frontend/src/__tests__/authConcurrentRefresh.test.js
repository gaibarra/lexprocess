/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { useAuthStore } from '../store/authStore';
import { __setPostHandler, __setGetHandler } from 'axios';
import { nextId, resetIds } from '../testUtils/idGen';
import { resetUniqueKeyLog, assertUniqueKeys } from '../testUtils/assertUniqueKeys';

let refreshCalls = 0;
const buildJWT = (expOffsetSeconds = 60) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now()/1000) + expOffsetSeconds }));
  return `${header}.${payload}.signature`;
};

global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ database: 'ok', redis: 'ok', app: 'ok' }) }));

beforeEach(() => {
  resetIds();
  refreshCalls = 0;
  localStorage.clear();
  useAuthStore.getState().logout();
  resetUniqueKeyLog();
  __setPostHandler((url, body) => {
    if (url === '/token/') {
      return Promise.resolve({ data: { access: buildJWT(120), refresh: 'refresh-token-demo', user: { id: nextId(), username: body.username, profile:{ rol:'ABOGADO' }, permissions:{ is_staff:false, is_superuser:false } } } });
    }
    if (url === '/token/refresh/') {
      refreshCalls += 1;
      return Promise.resolve({ data: { access: buildJWT(120) } });
    }
    if (url === '/protected/') {
      return Promise.reject({ response: { status: 401 }, config: { _retry: false } });
    }
    if (url === '/auth/logout/') return Promise.resolve({ data: { detail: 'ok' } });
    return Promise.resolve({ data: {} });
  });
  __setGetHandler((url) => {
    if (url === '/casos/') return Promise.resolve({ data: { results: [] } });
    if (url === '/users/me/') return Promise.resolve({ data: { id: nextId(), username:'demo', profile:{ rol:'ABOGADO' }, permissions:{ is_staff:false, is_superuser:false } } });
    if (url === '/auth/session/') return Promise.resolve({ data: { user:{ id: nextId(), username:'demo', profile:{ rol:'ABOGADO' }, permissions:{ is_staff:false, is_superuser:false } }, metrics:{} } });
    return Promise.resolve({ data: {} });
  });
});

test('solo un refresh real mientras otras peticiones esperan', async () => {
  render(<App />);
  await userEvent.type(screen.getByLabelText(/Usuario/i), 'demo');
  await userEvent.type(screen.getByLabelText(/Contraseña/i), 'secret');
  await userEvent.click(screen.getByRole('button', { name: /Iniciar Sesión/i }));
  expect(await screen.findByText(/Mis Casos/i)).toBeInTheDocument();

  const axiosClient = require('../api/axios').default || require('../api/axios');
  const reqs = [1,2,3].map(()=> axiosClient.post('/protected/', {}));
  await Promise.allSettled(reqs);
  expect(refreshCalls).toBe(1);
  assertUniqueKeys();
});
