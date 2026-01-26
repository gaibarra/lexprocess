/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { useAuthStore } from '../store/authStore';
import { __setPostHandler, __setGetHandler } from 'axios';
import { nextId, resetIds } from '../testUtils/idGen';
import { resetUniqueKeyLog, assertUniqueKeys } from '../testUtils/assertUniqueKeys';

global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ database:'ok', redis:'ok', app:'ok' }) }));

const buildJWT = (claims) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now()/1000) + 300, ...claims }));
  return `${header}.${payload}.signature`;
};

beforeEach(() => {
  resetIds();
  localStorage.clear();
  useAuthStore.getState().logout();
  jest.useFakeTimers();
  resetUniqueKeyLog();
  __setPostHandler((url, body) => {
    if (url === '/token/') return Promise.resolve({ data: { access: buildJWT({ rol:'ABOGADO', despacho_id:'123', is_staff:false }), refresh:'refresh-token', user:{ id: nextId(), username: body.username, profile:{ rol:'ABOGADO', despacho_id:'123'}, permissions:{ is_staff:false, is_superuser:false } } } });
    if (url === '/token/refresh/') return Promise.resolve({ data: { access: buildJWT({ rol:'ABOGADO', despacho_id:'123', is_staff:false }) } });
    return Promise.resolve({ data: {} });
  });
  __setGetHandler((url) => {
    if (url === '/casos/') return Promise.resolve({ data: { results: [] } });
    if (url === '/users/me/') return Promise.resolve({ data: { id: nextId(), username:'demo', profile:{ rol:'ABOGADO', despacho_id:'123'}, permissions:{ is_staff:false, is_superuser:false } } });
    if (url === '/auth/session/') return Promise.resolve({ data: { user:{ id: nextId(), username:'demo', profile:{ rol:'ABOGADO', despacho_id:'123'}, permissions:{ is_staff:false, is_superuser:false } }, metrics:{} } });
    return Promise.resolve({ data: {} });
  });
});

test('rol visible tras login', async () => {
  render(<App />);
  await userEvent.type(screen.getByLabelText(/Usuario/i), 'demo');
  await userEvent.type(screen.getByLabelText(/Contraseña/i), 'secret');
  await userEvent.click(screen.getByRole('button', { name: /Iniciar Sesión/i }));
  expect(await screen.findByText(/Mis Casos/i)).toBeInTheDocument();
  expect(screen.getByText(/ABOGADO/i)).toBeInTheDocument();
  assertUniqueKeys();
});

afterEach(()=>{
  jest.useRealTimers();
});
