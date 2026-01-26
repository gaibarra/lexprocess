import React, { useState, useEffect } from 'react';
import apiClient from '../../api/axios';
import alerts from '../../lib/alerts';

const WorkflowSelector = ({ casoId, onWorkflowCreated }) => {
  const [plantillas, setPlantillas] = useState([]);
  const [selectedPlantilla, setSelectedPlantilla] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPlantillas = async () => {
      try {
        const resp = await apiClient.get('/workflows/plantillas/');
        setPlantillas(resp.data.results || resp.data);
      } catch (err) {
        console.error("Error cargando plantillas", err);
      }
    };
    fetchPlantillas();
  }, []);

  const handleCreate = async () => {
    if (!selectedPlantilla) return;

    const plantillaName = plantillas.find(p => p.id === selectedPlantilla)?.nombre;
    const confirm = await alerts.confirm(
      '¿Asignar este flujo?',
      `Se inicializarán todos los hitos procesales para un "${plantillaName}".`
    );

    if (confirm.isConfirmed) {
      setLoading(true);
      alerts.loading('Asignando flujo...', 'Configurando las etapas procesales para el caso.');
      try {
        const resp = await apiClient.post('/workflows/instancias/', {
          caso: casoId,
          plantilla: selectedPlantilla
        });
        alerts.success('¡Flujo asignado!', `El flujo procesal "${plantillaName}" se ha activado.`);
        onWorkflowCreated(resp.data);
      } catch (err) {
        alerts.error('Error', err.response?.data?.error || "No se pudo asignar el flujo.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300">
      <h4 className="text-sm font-semibold text-gray-700 mb-2">Asignar Flujo Procesal</h4>
      <div className="flex gap-2">
        <select
          className="flex-1 rounded-md border-gray-300 text-sm"
          value={selectedPlantilla}
          onChange={(e) => setSelectedPlantilla(e.target.value)}
        >
          <option value="">Selecciona un tipo de juicio...</option>
          {plantillas.map(p => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        <button
          onClick={handleCreate}
          disabled={!selectedPlantilla || loading}
          className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Asignando...' : 'Asignar'}
        </button>
      </div>
    </div>
  );
};

export default WorkflowSelector;
