import React, { useState, useEffect } from 'react';
import apiClient from '../../api/axios';
import alerts from '../../lib/alerts';

const CalculadoraTerminos = () => {
  const [fechaNotificacion, setFechaNotificacion] = useState('');
  const [diasTermino, setDiasTermino] = useState('');
  const [jurisdiccion, setJurisdiccion] = useState('Federal');
  const [desdeDiaSiguiente, setDesdeDiaSiguiente] = useState(true);
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [jurisdicciones, setJurisdicciones] = useState([]);

  useEffect(() => {
    const fetchJurisdicciones = async () => {
      try {
        const resp = await apiClient.get('/calendario/jurisdicciones/');
        setJurisdicciones(resp.data.results || resp.data);
      } catch (err) {
        console.error("Error cargando jurisdicciones", err);
      }
    };
    fetchJurisdicciones();
  }, []);

  const handleCalcular = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResultado(null);
    try {
      const resp = await apiClient.post('/calendario/calcular-vencimiento/', {
        fecha_notificacion: fechaNotificacion,
        dias_termino: diasTermino,
        jurisdiccion_nombre: jurisdiccion,
        desde_dia_siguiente: desdeDiaSiguiente
      });
      setResultado(resp.data);
    } catch (err) {
      alerts.error('Error de cálculo', err.response?.data?.error || "No se pudo calcular el vencimiento procesal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
        <span className="mr-2">⚖️</span> Calculadora de Términos (México)
      </h3>
      <form onSubmit={handleCalcular} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha de Notificación</label>
            <input
              type="date"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              value={fechaNotificacion}
              onChange={(e) => setFechaNotificacion(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Días de Término</label>
            <input
              type="number"
              required
              min="1"
              placeholder="Ej. 3, 5, 8, 15"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              value={diasTermino}
              onChange={(e) => setDiasTermino(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Jurisdicción</label>
            <select
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              value={jurisdiccion}
              onChange={(e) => setJurisdiccion(e.target.value)}
            >
              <option value="Federal">Federal (PJF)</option>
              {jurisdicciones.filter(j => j.nombre !== 'Federal').map(j => (
                <option key={j.id} value={j.nombre}>{j.nombre}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center pt-6">
            <input
              type="checkbox"
              id="desde_dia_siguiente"
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              checked={desdeDiaSiguiente}
              onChange={(e) => setDesdeDiaSiguiente(e.target.checked)}
            />
            <label htmlFor="desde_dia_siguiente" className="ml-2 block text-sm text-gray-900">
              Contar desde día hábil siguiente
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Calculando...' : 'Calcular Vencimiento'}
        </button>
      </form>


      {resultado && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">El término vence el:</p>
          <p className="text-2xl font-bold text-green-900">
            {new Date(resultado.fecha_vencimiento).toLocaleDateString('es-MX', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
          <p className="text-xs text-green-600 mt-2">
            * Sujeto a cambios por suspensiones extraordinarias.
          </p>
        </div>
      )}
    </div>
  );
};

export default CalculadoraTerminos;
