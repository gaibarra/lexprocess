// src/pages/CaseDetailPage.js
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient from '../api/axios';
import { useAuthStore } from '../store/authStore';

import DocumentManager from '../components/documentos/DocumentManager';
import AIInteractionPanel from '../components/ia/AIInteractionPanel';
import ParteListManager from '../components/partes/ParteListManager';
import PlazoListManager from '../components/plazos/PlazoListManager';
import WorkflowSelector from '../components/casos/WorkflowSelector';
import WorkflowStepper from '../components/casos/WorkflowStepper';

const AppLayout = ({ children }) => { /* ... (código del AppLayout de DashboardPage) ... */
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login'); };
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm"><div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"><div className="flex justify-between h-16"><div className="flex-shrink-0 flex items-center"><Link to="/"><h1 className="text-xl font-bold text-blue-600">LexProcess IA</h1></Link></div><div className="flex items-center"><span className="text-gray-600 mr-4">Bienvenido, {user?.first_name || user?.username}</span><button onClick={handleLogout} className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded text-sm">Cerrar Sesión</button></div></div></div></nav>
      <main>{children}</main>
    </div>
  );
};
const DetailItem = ({ label, value }) => (<div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6"><dt className="text-sm font-medium text-gray-500">{label}</dt><dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{value || 'N/A'}</dd></div>);

function CaseDetailPage() {
  const { id } = useParams();
  const [caso, setCaso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchCaso = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await apiClient.get(`/casos/${id}/`);
        setCaso(response.data);
      } catch (err) {
        setError('No se pudo cargar el caso.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchCaso();
  }, [id]);

  const refreshWorkflow = async () => {
    try {
      const response = await apiClient.get(`/casos/${id}/`);
      setCaso(response.data);
    } catch (err) {
      console.error("Error refreshing case workflow", err);
    }
  };

  if (loading) return <AppLayout><div className="p-8 text-center">Cargando...</div></AppLayout>;
  if (error) return <AppLayout><div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8"><Link to="/" className="text-sm text-indigo-600 hover:text-indigo-800">← Volver</Link><div className="p-8 text-center text-red-600 bg-red-50 rounded-lg mt-4">{error}</div></div></AppLayout>;
  if (!caso) return <AppLayout><div className="p-8 text-center">No se encontró el caso.</div></AppLayout>;

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Link to="/" className="text-sm text-indigo-600 hover:text-indigo-800 mb-4 inline-block">← Volver a Mis Casos</Link>
        <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-8">
          <div className="px-4 py-5 sm:px-6"><h3 className="text-lg leading-6 font-medium text-gray-900">{caso.nombre_caso}</h3><p className="mt-1 max-w-2xl text-sm text-gray-500">Expediente: {caso.numero_expediente || 'No especificado'}</p></div>
          <div className="border-t border-gray-200 px-4 py-5 sm:p-0"><dl className="sm:divide-y sm:divide-gray-200"><DetailItem label="Cliente" value={caso.cliente?.nombre_completo} /><DetailItem label="Abogado Asignado" value={`${caso.abogado_asignado?.first_name || ''} ${caso.abogado_asignado?.last_name || ''}`.trim() || 'No asignado'} /><DetailItem label="Estado" value={<span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${caso.estado_caso === 'ACTIVO' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{caso.estado_caso_display}</span>} /><DetailItem label="Juzgado / Tribunal" value={caso.juzgado_tribunal} /></dl></div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <section className="xl:col-span-1"><h3 className="text-xl font-semibold mb-4 text-gray-800">Documentos</h3><DocumentManager caseId={id} /></section>
          <section className="xl:col-span-1 space-y-8">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Flujo Procesal</h3>
            <div className="bg-white p-6 shadow rounded-lg border border-gray-100">
              {caso.workflow ? (
                <WorkflowStepper workflow={caso.workflow} onUpdate={refreshWorkflow} />
              ) : (
                <WorkflowSelector casoId={id} onWorkflowCreated={refreshWorkflow} />
              )}
            </div>
            <ParteListManager caseId={id} />
            <PlazoListManager caseId={id} />
          </section>
          <section className="xl:col-span-1"><h3 className="text-xl font-semibold mb-4 text-gray-800">Asistente IA</h3><AIInteractionPanel caseId={id} /></section>
        </div>
      </div>
    </AppLayout>
  );
}
export default CaseDetailPage;