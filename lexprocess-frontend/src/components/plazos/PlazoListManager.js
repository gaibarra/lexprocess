import React, { useEffect, useState, useCallback } from 'react';
import apiClient from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import alerts from '../../lib/alerts';

function PlazoListManager({ caseId }) {
  const [plazos, setPlazos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ titulo: '', fecha_hora_vencimiento: '', tipo_evento: 'PLAZO_PROCESAL', descripcion: '' });
  const [saving, setSaving] = useState(false);
  const refreshSessionMetrics = useAuthStore(s => s.refreshSessionMetrics);

  const fetchPlazos = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const resp = await apiClient.get(`/plazos/?caso=${caseId}`);
      const list = resp.data.results || resp.data;
      setPlazos(Array.isArray(list) ? list : []);
    } catch (e) { setError('No se pudieron cargar los plazos'); }
    finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchPlazos(); }, [fetchPlazos]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.fecha_hora_vencimiento) return;
    const dt = new Date(form.fecha_hora_vencimiento).getTime();
    if (isNaN(dt) || dt <= Date.now()) {
      alerts.warning('Fecha inválida', 'La fecha/hora del plazo debe ser un momento futuro.');
      return;
    }
    try {
      setSaving(true);
      const resp = await apiClient.post('/plazos/', { ...form, caso_id: caseId });
      setPlazos(p => [resp.data, ...p]);
      setForm({ titulo: '', fecha_hora_vencimiento: '', tipo_evento: 'PLAZO_PROCESAL', descripcion: '' });
      alerts.success('Plazo agendado', resp.data.titulo);
      refreshSessionMetrics();
    } catch (e) {
      alerts.error('Error', 'No se pudo crear el plazo procesal.');
    }
    finally { setSaving(false); }
  };

  const toggleCompletado = async (plazo) => {
    try {
      const resp = await apiClient.patch(`/plazos/${plazo.id}/`, { completado: !plazo.completado });
      setPlazos(list => list.map(p => p.id === plazo.id ? resp.data : p));
      alerts.success('Estado actualizado', resp.data.completado ? 'Plazo marcado como realizado' : 'Plazo marcado como pendiente');
      refreshSessionMetrics();
    } catch (e) { /* noop */ }
  };

  const deletePlazo = async (plazo) => {
    const confirm = await alerts.confirm('¿Eliminar plazo?', `¿Estás seguro de que deseas eliminar el plazo "${plazo.titulo}"?`);
    if (!confirm.isConfirmed) return;

    try {
      await apiClient.delete(`/plazos/${plazo.id}/`);
      setPlazos(list => list.filter(p => p.id !== plazo.id));
      alerts.success('Plazo eliminado');
      refreshSessionMetrics();
    } catch (e) {
      alerts.error('Error', 'No se pudo eliminar el plazo.');
    }
  };

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ titulo: '', fecha_hora_vencimiento: '', tipo_evento: 'PLAZO_PROCESAL', descripcion: '' });
  const startEdit = (plazo) => { setEditingId(plazo.id); setEditForm({ titulo: plazo.titulo, fecha_hora_vencimiento: plazo.fecha_hora_vencimiento.slice(0, 16), tipo_evento: plazo.tipo_evento, descripcion: plazo.descripcion || '' }); };
  const cancelEdit = () => { setEditingId(null); };
  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      const resp = await apiClient.patch(`/plazos/${editingId}/`, { ...editForm });
      setPlazos(list => list.map(p => p.id === editingId ? resp.data : p));
      setEditingId(null);
      alerts.success('Plazo actualizado');
      refreshSessionMetrics();
    } catch (e) {
      alerts.error('Error', 'No se pudo actualizar el plazo.');
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4 space-y-4">
      <h4 className="text-md font-medium text-gray-800">Plazos / Agenda</h4>
      {loading ? <p className="text-sm text-gray-500">Cargando…</p> : (
        plazos.length ? (
          <ul className="divide-y text-sm">
            {plazos.map((pl, idx) => (
              <li key={`plazo-${pl.id}-${idx}`} className="py-2 flex flex-col gap-1 border-b last:border-b-0">
                {editingId === pl.id ? (
                  <form onSubmit={saveEdit} className="space-y-2" data-testid={`plazo-edit-form-${pl.id}`}>
                    <input className="w-full border rounded px-2 py-1 text-xs" value={editForm.titulo} onChange={e => setEditForm(f => ({ ...f, titulo: e.target.value }))} required />
                    <input type="datetime-local" placeholder="Fecha y hora" className="w-full border rounded px-2 py-1 text-xs" value={editForm.fecha_hora_vencimiento} onChange={e => setEditForm(f => ({ ...f, fecha_hora_vencimiento: e.target.value }))} required />
                    <select className="w-full border rounded px-2 py-1 text-xs" value={editForm.tipo_evento} onChange={e => setEditForm(f => ({ ...f, tipo_evento: e.target.value }))}>
                      <option value="PLAZO_PROCESAL">Plazo Procesal</option>
                      <option value="AUDIENCIA">Audiencia</option>
                      <option value="REUNION_CLIENTE">Reunión con Cliente</option>
                      <option value="TAREA_INTERNA">Tarea Interna</option>
                      <option value="OTRO">Otro</option>
                    </select>
                    <textarea rows={2} className="w-full border rounded px-2 py-1 text-xs" value={editForm.descripcion} onChange={e => setEditForm(f => ({ ...f, descripcion: e.target.value }))} />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={cancelEdit} className="text-xs px-2 py-1 rounded border">Cancelar</button>
                      <button type="submit" className="text-xs px-2 py-1 rounded bg-indigo-600 text-white">Guardar</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{pl.titulo}</p>
                      <p className="text-[11px] text-gray-500">Vence: {new Date(pl.fecha_hora_vencimiento).toLocaleString()}</p>
                    </div>
                    <div className="flex gap-1">
                      <button aria-label="Editar" onClick={() => startEdit(pl)} className="text-xs px-2 py-0.5 rounded border bg-white hover:bg-gray-50">✎</button>
                      <button aria-label="Completar" onClick={() => toggleCompletado(pl)} className={`text-xs px-2 py-0.5 rounded border ${pl.completado ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>{pl.completado ? '✓' : '⏳'}</button>
                      <button aria-label="Eliminar" onClick={() => deletePlazo(pl)} className="text-xs px-2 py-0.5 rounded border bg-red-50 text-red-600 hover:bg-red-100">🗑</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-gray-500">No hay plazos registrados.</p>
      )}
      <form onSubmit={handleSubmit} className="space-y-2 border-t pt-3" data-testid="plazo-new-form">
        <p className="text-xs font-medium text-gray-600">Nuevo Plazo</p>
        <input type="text" placeholder="Título" value={form.titulo} onChange={(e) => setForm(f => ({ ...f, titulo: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" required />
        <input type="datetime-local" placeholder="Fecha y hora" value={form.fecha_hora_vencimiento} onChange={(e) => setForm(f => ({ ...f, fecha_hora_vencimiento: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" required />
        <select value={form.tipo_evento} onChange={(e) => setForm(f => ({ ...f, tipo_evento: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm">
          <option value="PLAZO_PROCESAL">Plazo Procesal</option>
          <option value="AUDIENCIA">Audiencia</option>
          <option value="REUNION_CLIENTE">Reunión con Cliente</option>
          <option value="TAREA_INTERNA">Tarea Interna</option>
          <option value="OTRO">Otro</option>
        </select>
        <textarea placeholder="Descripción (opcional)" value={form.descripcion} onChange={(e) => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={2} className="w-full border rounded px-2 py-1 text-sm" />
        <button type="submit" disabled={saving} className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Añadir Plazo'}</button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default PlazoListManager;
