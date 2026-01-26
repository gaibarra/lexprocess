/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { __setPostHandler, __setGetHandler } from 'axios';
import { resetUniqueKeyLog, assertUniqueKeys } from '../testUtils/assertUniqueKeys';
import { nextId, resetIds } from '../testUtils/idGen';

const buildJWT = (expOffsetSeconds=120) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now()/1000) + expOffsetSeconds }));
  return `${header}.${payload}.sig`;
};

global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ database: 'ok', redis: 'ok', app: 'ok' }) }));

beforeEach(()=>{
  resetUniqueKeyLog();
  resetIds();
  localStorage.clear();
  __setPostHandler((url, body)=>{
    if (url === '/token/') return Promise.resolve({ data: { access: buildJWT(), refresh:'refresh-metrics', user:{ id: nextId(), username: body.username, profile:{ rol:'ABOGADO'}, permissions:{ is_staff:false, is_superuser:false } } } });
    if (url === '/token/refresh/') return Promise.resolve({ data: { access: buildJWT() } });
    return Promise.resolve({ data: {} });
  });
  __setGetHandler((url)=>{
    if (url === '/auth/session/') return Promise.resolve({ data: { user:{ id: nextId(), username:'demo', profile:{ rol:'ABOGADO'}, permissions:{ is_staff:false, is_superuser:false } }, metrics:{ documentos_total:12, casos_total:4, casos_activos:3, plazos_proximos_7d:2 } } });
    if (url === '/casos/') return Promise.resolve({ data: { results: [ {id: nextId()},{id: nextId()},{id: nextId()},{id: nextId()} ] } });
    if (url === '/users/me/') return Promise.resolve({ data: { id: nextId(), username:'demo'} });
    return Promise.resolve({ data: {} });
  });
});

test('renderiza métricas de sesión y conteo de casos', async () => {
  render(<App />);
  await userEvent.type(screen.getByLabelText(/Usuario/i), 'demo');
  await userEvent.type(screen.getByLabelText(/Contraseña/i), 'secret');
  await userEvent.click(screen.getByRole('button', { name: /Iniciar Sesión/i }));

  expect(await screen.findByText(/Mis Casos/i)).toBeInTheDocument();
  // Métricas: buscamos los números directamente tras carga
  expect(screen.getByText('12')).toBeInTheDocument(); // docs
  expect(screen.getByText('3')).toBeInTheDocument();  // activos
  expect(screen.getByText('2')).toBeInTheDocument();  // plazos 7d
  assertUniqueKeys();
});
