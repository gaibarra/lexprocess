/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { __setPostHandler, __setGetHandler, __setPatchHandler, __setDeleteHandler } from 'axios';
import { nextId, resetIds } from '../testUtils/idGen';
import { assertUniqueKeys, resetUniqueKeyLog } from '../testUtils/assertUniqueKeys';

const buildJWT = (expOffsetSeconds=600) => {
  const header = btoa(JSON.stringify({ alg:'HS256', typ:'JWT'}));
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now()/1000) + expOffsetSeconds }));
  return `${header}.${payload}.sig`;
};

global.fetch = jest.fn(()=> Promise.resolve({ ok:true, json:()=> Promise.resolve({ database:'ok', redis:'ok', app:'ok' }) }));

let casos = [{ id: nextId(), nombre_caso:'Caso Partes', numero_expediente:null }];
let partes = [];

beforeEach(()=>{
  resetUniqueKeyLog();
  resetIds();
  localStorage.clear();
  partes = [];
  __setPostHandler((url, body)=>{
    if (url === '/token/') return Promise.resolve({ data: { access: buildJWT(), refresh:'r1', user: { id: nextId(), username: body.username, profile:{ rol:'ABOGADO'}, permissions:{ is_staff:false, is_superuser:false } } } });
    if (url === '/partes-procesales/') {
      const nueva = { id: nextId(), nombre: body.nombre, rol_en_proceso: body.rol_en_proceso };
      partes.unshift(nueva);
      return Promise.resolve({ data: nueva });
    }
    return Promise.resolve({ data: {} });
  });
  __setGetHandler((url)=>{
    if (url === '/auth/session/') return Promise.resolve({ data: { user:{ id: nextId(), username:'demo', profile:{ rol:'ABOGADO'}, permissions:{ is_staff:false, is_superuser:false } }, metrics:{ casos_activos:1, plazos_proximos_7d:0, documentos_total:0 } } });
    if (url === '/casos/') return Promise.resolve({ data: { results: casos } });
    if (url.startsWith('/partes-procesales/')) return Promise.resolve({ data: { results: partes } });
    if (url === '/users/me/') return Promise.resolve({ data: { id: nextId(), username:'demo' } });
    if (url.startsWith('/plazos/')) return Promise.resolve({ data: { results: [] } });
    if (url.startsWith('/documentos/')) return Promise.resolve({ data: { results: [] } });
    return Promise.resolve({ data:{} });
  });
  __setPatchHandler((fnUrl, body)=>{
    const id = parseInt(fnUrl.split('/').filter(Boolean).pop(),10);
    const idx = partes.findIndex(p=> p.id === id);
    if (idx>=0) {
      partes[idx] = { ...partes[idx], ...body };
      return Promise.resolve({ data: partes[idx] });
    }
    return Promise.resolve({ data: {} });
  });
  __setDeleteHandler((fnUrl)=>{
    const id = parseInt(fnUrl.split('/').filter(Boolean).pop(),10);
    partes = partes.filter(p=> p.id !== id);
    return Promise.resolve({ data: {} });
  });
});

describe('CRUD de Partes Procesales', () => {
  test('crear, editar y eliminar una parte', async () => {
    render(<App />);

    await userEvent.type(screen.getByLabelText(/Usuario/i), 'demo');
    await userEvent.type(screen.getByLabelText(/Contraseña/i), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /Iniciar Sesión/i }));

    const caseLink = await screen.findByText('Caso Partes');
    await userEvent.click(caseLink);

    // Crear
    const nombreInput = await screen.findByPlaceholderText('Nombre');
    const rolInput = screen.getByPlaceholderText(/Rol/);
    await userEvent.type(nombreInput, 'Empresa XYZ');
    await userEvent.type(rolInput, 'Demandante');
    await userEvent.click(screen.getByRole('button', { name: 'Añadir' }));

  const ocurrencias = await screen.findAllByText('Empresa XYZ');
  assertUniqueKeys();
  expect(ocurrencias.length).toBeGreaterThan(0);

    // Editar
    const editBtn = screen.getAllByRole('button', { name: 'Editar' })[0];
    await userEvent.click(editBtn);
    const editNombre = screen.getAllByDisplayValue('Empresa XYZ')[0];
    await userEvent.clear(editNombre);
    await userEvent.type(editNombre, 'Empresa Editada');
  const guardarButtons = screen.getAllByRole('button', { name: 'Guardar' });
  await userEvent.click(guardarButtons[0]);

  const editedMatches = await screen.findAllByText('Empresa Editada');
  expect(editedMatches.length).toBeGreaterThan(0);

    // Eliminar
    const deleteBtn = screen.getAllByRole('button', { name: 'Eliminar' })[0];
    const originalConfirm = window.confirm; window.confirm = () => true;
    await userEvent.click(deleteBtn);
    window.confirm = originalConfirm;

    await waitFor(()=> {
      expect(screen.queryByText('Empresa Editada')).not.toBeInTheDocument();
    });
  });
});
