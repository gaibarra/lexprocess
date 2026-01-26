/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { __setPostHandler, __setGetHandler } from 'axios';
import { nextId, resetIds } from '../testUtils/idGen';
import { resetUniqueKeyLog, assertUniqueKeys } from '../testUtils/assertUniqueKeys';
const buildJWT = (expOffsetSeconds = 300) => {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now()/1000) + expOffsetSeconds }));
  return `${header}.${payload}.sig`;
};
global.fetch = jest.fn((url) => {
  if (url.includes('/api/health')) {
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ database: 'ok', redis: 'ok', app: 'ok' }) });
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
});

// State captured for assertions
let createdCases = [];

beforeEach(() => {
  resetUniqueKeyLog();
  resetIds();
  localStorage.clear();
  createdCases = [];
  __setPostHandler((url, body) => {
    if (url === '/token/') {
      return Promise.resolve({ data: { access: buildJWT(), refresh: 'r1', user: { id: nextId(), username: body.username, first_name:'Demo', profile:{ rol:'ABOGADO'}, permissions:{ is_staff:false, is_superuser:false } } } });
    }
    if (url === '/token/refresh/') {
      return Promise.resolve({ data: { access: buildJWT(600) } });
    }
    if (url === '/casos/') {
      const newCase = { id: createdCases.length + 1, nombre_caso: body.nombre_caso, numero_expediente: body.numero_expediente || null };
      createdCases.unshift(newCase);
      return Promise.resolve({ data: newCase });
    }
    if (url === '/clientes/') {
      // simulate creation of new client
      return Promise.resolve({ data: { id: 99, nombre_completo: body.nombre_completo || 'Nuevo Cliente' } });
    }
    return Promise.resolve({ data: {} });
  });
  __setGetHandler((url) => {
    if (url === '/auth/session/') {
      return Promise.resolve({ data: { user: { id: nextId(), username:'demo', first_name:'Demo', profile:{ rol:'ABOGADO'}, permissions:{ is_staff:false, is_superuser:false } }, metrics: { casos_activos: createdCases.length, plazos_proximos_7d:0, documentos_total:0 } } });
    }
    if (url === '/casos/') {
      return Promise.resolve({ data: { results: createdCases } });
    }
    if (url.startsWith('/casos/') && url.endsWith('/')) {
      const idStr = url.split('/').filter(Boolean).pop();
      const found = createdCases.find(c => String(c.id) === idStr) || null;
      return Promise.resolve({ data: found || { id:idStr, nombre_caso:'Mock', numero_expediente:null } });
    }
    if (url === '/users/me/') {
      return Promise.resolve({ data: { id: nextId(), username:'demo' } });
    }
    if (url.startsWith('/partes-procesales/')) return Promise.resolve({ data: { results: [] } });
    if (url.startsWith('/plazos/')) return Promise.resolve({ data: { results: [] } });
    if (url.startsWith('/documentos/')) return Promise.resolve({ data: { results: [] } });
    if (url.startsWith('/clientes/')) return Promise.resolve({ data: { results: [] } });
    return Promise.resolve({ data: {} });
  });
});

describe('Flujo de creación de caso', () => {
  test('crea un caso y aparece en la lista con toast de éxito', async () => {
    render(<App />);
    await userEvent.type(screen.getByLabelText(/Usuario/i), 'demo');
    await userEvent.type(screen.getByLabelText(/Contraseña/i), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /Iniciar Sesión/i }));

    // Dashboard visible
    expect(await screen.findByText(/Mis Casos/i)).toBeInTheDocument();

  // Abrir modal (hay botón y luego heading con el mismo texto; buscamos el heading)
  await userEvent.click(screen.getByRole('button', { name: /Nuevo Caso/i }));
  // Confirm modal opened via required field label
  expect(await screen.findByPlaceholderText(/Nombre del Caso/i)).toBeInTheDocument();

    // Completar formulario mínimo
  await userEvent.type(screen.getByPlaceholderText(/Nombre del Caso/i), 'Caso Integración');
  await userEvent.type(screen.getByPlaceholderText(/Nº Expediente/i), 'EXP-123');

    await userEvent.click(screen.getByRole('button', { name: /Crear Caso/i }));

    // Toast de éxito
    expect(await screen.findByText(/Caso creado/i)).toBeInTheDocument();

    // Lista actualizada
    await waitFor(() => {
      expect(screen.getByText('Caso Integración')).toBeInTheDocument();
    });
    assertUniqueKeys();
  });
});
