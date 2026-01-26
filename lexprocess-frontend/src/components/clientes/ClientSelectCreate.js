import React, { useEffect, useState, useCallback } from 'react';
import apiClient from '../../api/axios';

// Selector de clientes con opción de crear uno nuevo inline
function ClientSelectCreate({ value, onChange, currentDespachoId }) {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  // Eliminamos despacho del formulario de cliente; si backend lo requiere lo inyectaremos desde el padre (currentDespachoId)
  const [newClient, setNewClient] = useState({ nombre_completo: '', email: '', telefono: '' });
  const [error, setError] = useState(null);

  // Ensure we never keep duplicate IDs (prevents React key warnings if list refetched or new inserted twice)
  const dedupById = (list) => Array.from(new Map(list.map(c => [c.id, c])).values());

  const fetchClientes = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const resp = await apiClient.get('/clientes/');
      const list = resp.data.results || resp.data; // soporta paginación DRF o lista directa
      setClientes(Array.isArray(list) ? dedupById(list) : []);
      if (process.env.NODE_ENV !== 'production') {
        // Log de campos disponibles para inferir nombres correctos esperados por el backend
        if (Array.isArray(list) && list.length > 0) {
          // eslint-disable-next-line no-console
          console.debug('[Clientes] Ejemplo de objeto recibido:', list[0]);
        }
      }
    } catch (e) { setError('No se pudieron cargar clientes'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchClientes(); }, [fetchClientes]);

  const handleCreate = async () => {
    if (!newClient.nombre_completo.trim() || creating) return;
  // despacho ya no es parte del formulario del cliente aquí
    // Si el email ya existe reutilizamos el cliente y evitamos duplicados
    if (newClient.email) {
      const existing = clientes.find(c => c.email && c.email.toLowerCase() === newClient.email.toLowerCase());
      if (existing) {
        onChange(existing.id);
        setNewClient({ nombre_completo: '', email: '', telefono: '' });
        return;
      }
    }
    try {
      setCreating(true); setError(null);
      const payload = currentDespachoId ? { ...newClient, despacho_id: currentDespachoId } : newClient;
      const resp = await apiClient.post('/clientes/', payload);
      setClientes((prev) => dedupById([resp.data, ...prev]));
      onChange(resp.data.id);
      setNewClient({ nombre_completo: '', email: '', telefono: '' });
    } catch (e) {
      // Mostrar detalle de validación si viene del backend
      if (e?.response?.data) {
        try {
          const data = e.response.data;
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.warn('[Crear Cliente] Error 400 payload:', data);
          }
          const msg = typeof data === 'string' ? data :
            Object.entries(data).map(([k,v]) => `${k}: ${Array.isArray(v)?v.join(', '):v}`).join(' | ');
          setError(`Error al crear el cliente: ${msg}`);
        } catch(_) {
          setError('Error al crear el cliente');
        }
      } else {
        setError('Error al crear el cliente');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Cliente</label>
      {loading ? <p className="text-xs text-gray-500">Cargando clientes…</p> : (
        <select
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
          value={value || ''}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">— Sin cliente —</option>
          {clientes.map((c, idx) => <option key={`cliente-${c.id}-${idx}`} value={c.id}>{c.nombre_completo}</option>)}
        </select>
      )}
      <details className="border rounded p-2 bg-gray-50">
        <summary className="cursor-pointer text-sm font-medium text-indigo-600">Crear nuevo cliente</summary>
        <div className="mt-2 space-y-2">
          <input
            type="text"
            placeholder="Nombre completo"
            className="w-full border rounded px-2 py-1 text-sm"
            value={newClient.nombre_completo}
            onChange={(e)=> setNewClient(p=>({...p, nombre_completo: e.target.value}))}
          />
          {/* El despacho se selecciona ahora a nivel de Caso; si se necesita enviar, el padre lo pasa como currentDespachoId */}
          <input
            type="email"
            placeholder="Email (opcional)"
            className="w-full border rounded px-2 py-1 text-sm"
            value={newClient.email}
            onChange={(e)=> setNewClient(p=>({...p, email: e.target.value}))}
          />
          <input
            type="text"
            placeholder="Teléfono (opcional)"
            className="w-full border rounded px-2 py-1 text-sm"
            value={newClient.telefono}
            onChange={(e)=> setNewClient(p=>({...p, telefono: e.target.value}))}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="inline-flex items-center px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {creating ? 'Creando…' : 'Guardar Cliente'}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </details>
      {error && !creating && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default ClientSelectCreate;
