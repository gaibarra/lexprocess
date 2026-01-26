import React, { useState } from 'react';
import apiClient from '../../api/axios';
import ClientSelectCreate from '../clientes/ClientSelectCreate';
import { useAuthStore } from '../../store/authStore';
import alerts from '../../lib/alerts';

function NewCaseModal({ open, onClose }) {
  const loadCases = useAuthStore(s => s.loadCases);
  const [form, setForm] = useState({ nombre_caso: '', numero_expediente: '', cliente_id: null, juzgado_tribunal: '', tipo_proceso: 'OTRO', descripcion_breve: '', rol_cliente: '', despacho_id: '' });
  const [despachos, setDespachos] = useState([]);
  const [despachosLoading, setDespachosLoading] = useState(false);
  const [despachosError, setDespachosError] = useState(null);
  React.useEffect(() => {
    const loadDespachos = async () => {
      try {
        setDespachosLoading(true); setDespachosError(null);
        const resp = await apiClient.get('/despachos/');
        const list = resp.data.results || resp.data;
        setDespachos(Array.isArray(list) ? list : []);
      } catch (e) { setDespachosError('No se pudieron cargar despachos'); }
      finally { setDespachosLoading(false); }
    };
    loadDespachos();
  }, []);
  const [submitting, setSubmitting] = useState(false);
  const refreshSessionMetrics = useAuthStore(s => s.refreshSessionMetrics);

  if (!open) return null;

  const handleChange = (e) => { const { name, value } = e.target; setForm(f => ({ ...f, [name]: value })); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre_caso.trim()) return;

    // Alerta de carga
    alerts.loading('Creando expediente...', 'Estamos registrando la información en el sistema.');

    try {
      setSubmitting(true);
      const { rol_cliente, despacho_id, ...rest } = form;
      const payload = { ...rest, cliente_id: form.cliente_id || null, despacho_id: despacho_id || null };
      const resp = await apiClient.post('/casos/', payload);
      const created = resp.data;

      // Crear parte inicial si aplica
      if (form.cliente_id && form.rol_cliente.trim()) {
        try {
          const cResp = await apiClient.get(`/clientes/${form.cliente_id}/`);
          const clienteNombre = cResp.data?.nombre_completo || cResp.data?.nombre || 'Cliente';
          await apiClient.post('/partes-procesales/', { caso_id: created.id, nombre: clienteNombre, rol_en_proceso: form.rol_cliente });
        } catch (parteErr) {
          console.warn('No se pudo crear la parte inicial:', parteErr);
        }
      }

      await loadCases();
      refreshSessionMetrics();

      onClose();
      setForm({ nombre_caso: '', numero_expediente: '', cliente_id: null, juzgado_tribunal: '', tipo_proceso: 'OTRO', descripcion_breve: '', rol_cliente: '', despacho_id: '' });

      alerts.success('¡Caso creado!', `El expediente ${created.numero_expediente || created.nombre_caso} ha sido registrado.`);

    } catch (e) {
      let friendlyTitle = 'Error al crear el caso';
      let friendlyText = 'Ocurrió un problema inesperado al intentar guardar el expediente.';
      let footer = null;

      if (e?.response) {
        const { status, data } = e.response;
        if (typeof data === 'object') {
          friendlyText = 'Por favor verifica los siguientes campos:';
          footer = `<ul style="text-align: left; font-size: 0.8em; color: #ef4444;">${Object.entries(data).map(([k, v]) => `<li><b>${k}:</b> ${Array.isArray(v) ? v.join(', ') : v}</li>`).join('')}</ul>`;
        } else {
          friendlyText = data || `Error del servidor (Código ${status})`;
        }
      }

      alerts.error(friendlyTitle, friendlyText, footer);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Nuevo Caso</h3>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label htmlFor="nombre_caso" className="block text-sm font-medium text-gray-700">Nombre del Caso *</label>
            <input id="nombre_caso" name="nombre_caso" placeholder="Nombre del Caso" value={form.nombre_caso} onChange={handleChange} required className="mt-1 w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="numero_expediente" className="block text-sm font-medium text-gray-700">Nº Expediente</label>
              <input id="numero_expediente" name="numero_expediente" placeholder="Nº Expediente" value={form.numero_expediente} onChange={handleChange} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Juzgado / Tribunal</label>
              <input name="juzgado_tribunal" value={form.juzgado_tribunal} onChange={handleChange} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tipo de Proceso</label>
            <select name="tipo_proceso" value={form.tipo_proceso} onChange={handleChange} className="mt-1 w-full border rounded px-3 py-2 text-sm">
              <option value="CIVIL">Civil</option>
              <option value="PENAL">Penal</option>
              <option value="LABORAL">Laboral</option>
              <option value="ADMINISTRATIVO">Administrativo</option>
              <option value="MERCANTIL">Mercantil</option>
              <option value="FAMILIAR">Familiar</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Despacho</label>
            {despachosLoading ? <p className="text-xs text-gray-500 mt-1">Cargando despachos…</p> : (
              <select
                name="despacho_id"
                value={form.despacho_id}
                onChange={handleChange}
                className="mt-1 w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">— Sin despacho —</option>
                {despachos.map(d => <option key={d.id} value={d.id}>{d.nombre || d.nombre_fantasia || d.razon_social || `Despacho ${d.id}`}</option>)}
              </select>
            )}
            {despachosError && <p className="text-xs text-red-600 mt-1">{despachosError}</p>}
          </div>
          <ClientSelectCreate value={form.cliente_id} currentDespachoId={form.despacho_id} onChange={(val) => setForm(f => ({ ...f, cliente_id: val }))} />
          <div>
            <label className="block text-sm font-medium text-gray-700">Descripción Breve</label>
            <textarea name="descripcion_breve" value={form.descripcion_breve} onChange={handleChange} rows={3} className="mt-1 w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Rol de Nuestro Cliente (Demandante / Demandado / Otro)</label>
            <input name="rol_cliente" value={form.rol_cliente} onChange={handleChange} placeholder="Ej: Demandante" className="mt-1 w-full border rounded px-3 py-2 text-sm" />
            <p className="mt-1 text-[11px] text-gray-500">Este rol aún no se guarda en backend; sirve para lógica futura de estrategia.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded border text-sm">Cancelar</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">{submitting ? 'Creando…' : 'Crear Caso'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewCaseModal;
