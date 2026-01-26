import React, { useEffect, useState, useCallback } from 'react';
import apiClient from '../../api/axios';
import alerts from '../../lib/alerts';

function ParteListManager({ caseId }) {
  const [partes, setPartes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ nombre: '', rol_en_proceso: '' });
  const [saving, setSaving] = useState(false);

  const fetchPartes = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const resp = await apiClient.get(`/partes-procesales/?caso=${caseId}`);
      const list = resp.data.results || resp.data;
      setPartes(Array.isArray(list) ? list : []);
    } catch (e) { setError('No se pudieron cargar las partes'); }
    finally { setLoading(false); }
  }, [caseId]);

  useEffect(() => { fetchPartes(); }, [fetchPartes]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim() || !form.rol_en_proceso.trim()) return;
    try {
      setSaving(true);
      const resp = await apiClient.post('/partes-procesales/', { ...form, caso_id: caseId });
      setPartes(p => [resp.data, ...p.filter(x => x.id !== resp.data.id)]);
      setForm({ nombre: '', rol_en_proceso: '' });
      alerts.success('Parte añadida', resp.data.nombre);
    } catch (e) {
      alerts.error('Error', 'No se pudo añadir la parte procesal.');
    }
    finally { setSaving(false); }
  };

  const deleteParte = async (parte) => {
    const confirm = await alerts.confirm('¿Eliminar parte?', `¿Estás seguro de que deseas eliminar a "${parte.nombre}"?`);
    if (!confirm.isConfirmed) return;

    try {
      await apiClient.delete(`/partes-procesales/${parte.id}/`);
      setPartes(list => list.filter(p => p.id !== parte.id));
      alerts.success('Parte eliminada');
    } catch (e) {
      alerts.error('Error', 'No se pudo eliminar la parte procesal.');
    }
  };

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ nombre: '', rol_en_proceso: '' });
  const startEdit = (parte) => { setEditingId(parte.id); setEditForm({ nombre: parte.nombre, rol_en_proceso: parte.rol_en_proceso }); };
  const cancelEdit = () => setEditingId(null);
  const saveEdit = async (e) => {
    e.preventDefault();
    try {
      const resp = await apiClient.patch(`/partes-procesales/${editingId}/`, { ...editForm });
      setPartes(list => {
        const updated = list.map(p => p.id === editingId ? resp.data : p);
        const seen = new Set();
        return updated.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
      });
      setEditingId(null);
      alerts.success('Parte actualizada');
    } catch (e) {
      alerts.error('Error', 'No se pudo actualizar la información.');
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4 space-y-4">
      <h4 className="text-md font-medium text-gray-800">Partes Procesales</h4>
      {loading ? <p className="text-sm text-gray-500">Cargando…</p> : (
        partes.length ? (
          <ul className="divide-y text-sm">
            {partes.map((pt, idx) => (
              <li key={`parte-${pt.id}-${idx}`} className="py-2">
                {editingId === pt.id ? (
                  <form onSubmit={saveEdit} className="space-y-1">
                    <input className="w-full border rounded px-2 py-1 text-xs" value={editForm.nombre} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))} required />
                    <input className="w-full border rounded px-2 py-1 text-xs" value={editForm.rol_en_proceso} onChange={e => setEditForm(f => ({ ...f, rol_en_proceso: e.target.value }))} required />
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={cancelEdit} className="text-xs px-2 py-1 rounded border">Cancelar</button>
                      <button type="submit" className="text-xs px-2 py-1 rounded bg-indigo-600 text-white">Guardar</button>
                    </div>
                  </form>
                ) : (
                  <div className="flex justify-between items-center">
                    <div className="truncate">
                      <span className="font-medium">{pt.nombre}</span>
                      <span className="ml-2 text-gray-500">{pt.rol_en_proceso}</span>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button aria-label="Editar" onClick={() => startEdit(pt)} className="text-xs px-2 py-0.5 rounded border bg-white hover:bg-gray-50">✎</button>
                      <button aria-label="Eliminar" onClick={() => deleteParte(pt)} className="text-xs px-2 py-0.5 rounded border bg-red-50 text-red-600 hover:bg-red-100">🗑</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-gray-500">No hay partes registradas.</p>
      )}
      <form onSubmit={handleSubmit} className="space-y-2 border-t pt-3">
        <p className="text-xs font-medium text-gray-600">Añadir Parte</p>
        <input type="text" placeholder="Nombre" value={form.nombre} onChange={(e) => setForm(f => ({ ...f, nombre: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" required />
        <input type="text" placeholder="Rol (Demandante, Demandado…)" value={form.rol_en_proceso} onChange={(e) => setForm(f => ({ ...f, rol_en_proceso: e.target.value }))} className="w-full border rounded px-2 py-1 text-sm" required />
        <button type="submit" disabled={saving} className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Guardando…' : 'Añadir'}</button>
      </form>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default ParteListManager;
