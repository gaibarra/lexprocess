import React, { useState } from 'react';
import apiClient from '../../api/axios';
import alerts from '../../lib/alerts';

const WorkflowStepper = ({ workflow, onUpdate }) => {
  const [sugerencia, setSugerencia] = useState(null);
  const [loadingIA, setLoadingIA] = useState(false);

  const handleToggleHito = async (hito) => {
    try {
      const isCompleting = !hito.completado;

      if (isCompleting) {
        const confirm = await alerts.confirm(
          '¿Hito completado?',
          `¿Confirmas que se ha cumplido la etapa "${hito.etapa_nombre}"? Esto actualizará el flujo del caso.`
        );
        if (!confirm.isConfirmed) return;
      }

      await apiClient.patch(`/workflows/hitos/${hito.id}/`, {
        completado: isCompleting,
        fecha_cumplimiento: isCompleting ? new Date().toISOString() : null
      });

      if (isCompleting) {
        setLoadingIA(true);
        try {
          const resp = await apiClient.get(`/workflows/hitos/${hito.id}/sugerencia_ia/`);
          setSugerencia(resp.data);
          alerts.success('¡Etapa completada!', `Se ha registrado el cumplimiento de ${hito.etapa_nombre}.`);
        } catch (err) {
          console.error("Error obteniendo sugerencia IA", err);
        } finally {
          setLoadingIA(false);
        }
      } else {
        setSugerencia(null);
        alerts.info('Estado actualizado', 'La etapa se ha marcado como pendiente.');
      }
      onUpdate();
    } catch (err) {
      alerts.error('Error', 'No se pudo actualizar el hito.');
    }
  };

  const handleCrearPlazo = async (sug) => {
    try {
      alerts.loading('Agendando...', 'Registrando el vencimiento en tu calendario legal.');
      await apiClient.post('/plazos/', {
        caso_id: workflow.caso,
        titulo: `Vencimiento: ${sug.paso_sugerido}`,
        descripcion: `${sug.explicacion_legal}\n\nFundamento: ${sug.fundamento_legal}`,
        tipo_evento: 'TERMINO_PROCESAL',
        fecha_hora_vencimiento: sug.fecha_vencimiento_calculada + 'T23:59:59Z',
        recordatorio_activo: true,
        dias_antes_recordatorio: 1
      });
      alerts.success('¡Cita agendada!', `El plazo para "${sug.paso_sugerido}" se ha registrado correctamente.`);
      setSugerencia(null);
    } catch (err) {
      alerts.error('Error al agendar', 'No se pudo crear el evento en el calendario.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-bold text-gray-800">Flujo: {workflow.plantilla_nombre}</h4>
        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded-full font-medium">
          Etapa: {workflow.etapa_actual_nombre || 'Inicial'}
        </span>
      </div>

      {sugerencia && (
        <div className="bg-indigo-50 border border-indigo-200 p-4 rounded-lg relative animate-pulse-once">
          <button onClick={() => setSugerencia(null)} className="absolute top-2 right-2 text-indigo-400 hover:text-indigo-600">✕</button>
          <h5 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
            <span>✨ Sugerencia de la IA</span>
          </h5>
          <p className="text-xs text-indigo-800 mt-1">
            Siguiente paso: <strong>{sugerencia.paso_sugerido}</strong>
          </p>
          <p className="text-[10px] text-indigo-700 mt-2 italic">{sugerencia.explicacion_legal}</p>
          {sugerencia.fecha_vencimiento_calculada && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-indigo-900">Plazo detectado: {sugerencia.fecha_vencimiento_calculada}</span>
              <button
                onClick={() => handleCrearPlazo(sugerencia)}
                className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
              >
                Agendar en mi Calendario
              </button>
            </div>
          )}
        </div>
      )}

      {loadingIA && <div className="text-xs text-indigo-600 italic animate-pulse">Consultando al experto procesal...</div>}

      <div className="relative">
        <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        <div className="space-y-6">
          {workflow.hitos?.map((hito, index) => (
            <div key={hito.id} className="relative flex items-start ml-8">
              <div className={`absolute -left-8 mt-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center bg-white z-10 ${hito.completado ? 'border-green-500 text-green-500' : 'border-gray-300 text-gray-300'}`}>
                {hito.completado ? '✓' : index + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h5 className={`text-sm font-medium ${hito.completado ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                    {hito.etapa_nombre}
                  </h5>
                  <button
                    onClick={() => handleToggleHito(hito)}
                    className={`text-[10px] px-2 py-0.5 rounded border ${hito.completado ? 'bg-gray-100 text-gray-600 border-gray-300' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}
                  >
                    {hito.completado ? 'Reabrir' : 'Completar'}
                  </button>
                </div>
                {hito.fecha_cumplimiento && (
                  <p className="text-[10px] text-gray-400">
                    Completado: {new Date(hito.fecha_cumplimiento).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkflowStepper;
