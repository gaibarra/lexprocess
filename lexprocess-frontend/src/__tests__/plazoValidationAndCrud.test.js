/** @jest-environment jsdom */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

let casos = [{ id: nextId(), nombre_caso:'Caso Demo', numero_expediente:null }];
let plazos = [];

beforeEach(()=>{
  resetUniqueKeyLog();
  resetIds();
  localStorage.clear();
  plazos = [];
  __setPostHandler((url, body)=>{
    if (url === '/token/') return Promise.resolve({ data: { access: buildJWT(), refresh:'r1', user: { id: nextId(), username: body.username, profile:{ rol:'ABOGADO'}, permissions:{ is_staff:false, is_superuser:false } } } });
    if (url === '/plazos/') {
      const nuevo = { id: nextId(), titulo: body.titulo, fecha_hora_vencimiento: body.fecha_hora_vencimiento+':00Z', tipo_evento: body.tipo_evento, descripcion: body.descripcion || '', completado:false };
      plazos.unshift(nuevo);
      return Promise.resolve({ data: nuevo });
    }
    return Promise.resolve({ data: {} });
  });
  __setGetHandler((url)=>{
    if (url === '/auth/session/') return Promise.resolve({ data: { user:{ id: nextId(), username:'demo', profile:{ rol:'ABOGADO'}, permissions:{ is_staff:false, is_superuser:false } }, metrics:{ casos_activos:1, plazos_proximos_7d: plazos.length, documentos_total:0 } } });
    if (url === '/casos/') return Promise.resolve({ data: { results: casos } });
    if (url.startsWith('/plazos/')) return Promise.resolve({ data: { results: plazos } });
    if (url === '/users/me/') return Promise.resolve({ data: { id: nextId(), username:'demo' } });
    if (url.startsWith('/partes-procesales/')) return Promise.resolve({ data: { results: [] } });
    if (url.startsWith('/documentos/')) return Promise.resolve({ data: { results: [] } });
    return Promise.resolve({ data:{} });
  });
  __setPatchHandler((fnUrl, body)=>{
    const id = parseInt(fnUrl.split('/').filter(Boolean).pop(),10);
    const idx = plazos.findIndex(p=> p.id === id);
    if (idx>=0) {
      plazos[idx] = { ...plazos[idx], ...body };
      return Promise.resolve({ data: plazos[idx] });
    }
    return Promise.resolve({ data: {} });
  });
  __setDeleteHandler((fnUrl)=>{
    const id = parseInt(fnUrl.split('/').filter(Boolean).pop(),10);
    plazos = plazos.filter(p=> p.id !== id);
    return Promise.resolve({ data: {} });
  });
});

describe('Validación y CRUD de Plazos', () => {
  test('rechaza fecha pasada y permite creación, edición y borrado', async () => {
    render(<App />);

    await userEvent.type(screen.getByLabelText(/Usuario/i), 'demo');
    await userEvent.type(screen.getByLabelText(/Contraseña/i), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /Iniciar Sesión/i }));

    // Ir a detalle del caso
    const caseLink = await screen.findByText('Caso Demo');
    await userEvent.click(caseLink);

    // Añadir plazo con fecha pasada
    const tituloInput = await screen.findByPlaceholderText('Título');
  const dateInput = await screen.findByPlaceholderText('Fecha y hora');

  await userEvent.type(tituloInput, 'Plazo Pasado');
    // Set past date (1 hour ago) in local datetime format
    const pastDate = new Date(Date.now() - 3600*1000);
    const pad = n=> String(n).padStart(2,'0');
    const pastLocal = `${pastDate.getFullYear()}-${pad(pastDate.getMonth()+1)}-${pad(pastDate.getDate())}T${pad(pastDate.getHours())}:${pad(pastDate.getMinutes())}`;
  fireEvent.change(dateInput, { target: { value: pastLocal } });
    await userEvent.click(screen.getByRole('button', { name: /Añadir Plazo/i }));

  // Toast/alert de validación (warning)
  const warningToast = await screen.findByTestId('toast-warning');
  expect(warningToast).toHaveTextContent(/Fecha inválida|Selecciona una fecha futura/i);

    // Limpiar campos y crear válido
    // Reset form by clearing inputs
    tituloInput.value = '';
    await userEvent.clear(tituloInput);
    await userEvent.type(tituloInput, 'Plazo Futuro');
    const futureDate = new Date(Date.now() + 24*3600*1000);
    const futureLocal = `${futureDate.getFullYear()}-${pad(futureDate.getMonth()+1)}-${pad(futureDate.getDate())}T${pad(futureDate.getHours())}:${pad(futureDate.getMinutes())}`;
  fireEvent.change(dateInput, { target: { value: futureLocal } });
    await userEvent.click(screen.getByRole('button', { name: /Añadir Plazo/i }));

  const futuros = await screen.findAllByText('Plazo Futuro');
  assertUniqueKeys();
  expect(futuros.length).toBeGreaterThan(0);

    // Editar
  const editBtn = screen.getAllByRole('button', { name: 'Editar' })[0];
  await userEvent.click(editBtn);
  const editTitleInput = screen.getAllByDisplayValue('Plazo Futuro')[0];
  editTitleInput.value = '';
  await userEvent.type(editTitleInput, 'Plazo Editado');
  const guardarBtn = screen.getAllByRole('button', { name: 'Guardar' })[0];
  await userEvent.click(guardarBtn);
  const edited = await screen.findAllByText('Plazo Editado');
  expect(edited.length).toBeGreaterThan(0);

    // Eliminar
    const deleteBtn = screen.getAllByRole('button', { name: 'Eliminar' })[0];
    // confirm dialog: mock confirm to true
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    await userEvent.click(deleteBtn);
    window.confirm = originalConfirm;

    await waitFor(() => {
      expect(screen.queryByText('Plazo Editado')).not.toBeInTheDocument();
    });
  });
});
