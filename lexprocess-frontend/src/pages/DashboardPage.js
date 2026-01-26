// src/pages/DashboardPage.js
import React, { useEffect, useState } from 'react';
import CaseList from '../components/casos/CaseList';
import NewCaseModal from '../components/casos/NewCaseModal';
import CalculadoraTerminos from '../components/ui/CalculadoraTerminos';
import UpcomingDeadlines from '../components/dashboard/UpcomingDeadlines';
import RecentDocuments from '../components/dashboard/RecentDocuments';
import BulletinNotificationList from '../components/ia/BulletinNotificationList';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

const AppLayout = ({ children, remainingStr }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold text-blue-600">LexProcess IA</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">{user?.first_name || user?.username}</span>
              {user?.profile?.rol && <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">{user.profile.rol}</span>}
              <span className="text-xs text-gray-500 font-mono">Sesión: {remainingStr}</span>
              <button onClick={handleLogout} className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded text-sm">Cerrar Sesión</button>
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
};

function DashboardPage() {
  const casos = useAuthStore((s) => s.cases);
  const casesLoading = useAuthStore((s) => s.casesLoading);
  const casesError = useAuthStore((s) => s.casesError);
  const health = useAuthStore((s) => s.health);

  const sessionMetrics = useAuthStore((s) => s.sessionMetrics);
  const showExpiryModal = useAuthStore((s) => s.showExpiryModal);
  const expiryModalCountdown = useAuthStore((s) => s.expiryModalCountdown);
  const doLogout = useAuthStore((s) => s.logout);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [expSeconds, setExpSeconds] = useState(null);
  useEffect(() => { if (accessToken) { try { const payload = JSON.parse(atob(accessToken.split('.')[1])); if (payload.exp) setExpSeconds(payload.exp); } catch (_) { } } }, [accessToken]);
  const [now, setNow] = useState(Date.now() / 1000);
  useEffect(() => { const id = setInterval(() => setNow(Date.now() / 1000), 1000); return () => clearInterval(id); }, []);
  const remaining = expSeconds ? Math.max(0, Math.floor(expSeconds - now)) : null;
  const remainingStr = remaining !== null ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : '---';

  const [showNewCase, setShowNewCase] = useState(false);
  return (
    <AppLayout remainingStr={remainingStr}>
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 space-y-6">
        {remaining !== null && remaining < 60 && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded" role="alert">
            <p className="font-semibold">Tu sesión expira pronto</p>
            <p>Se renovará automáticamente si es posible. Guarda tu trabajo.</p>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded shadow"><p className="text-xs text-gray-500">Casos</p><p className="text-2xl font-semibold">{casesLoading ? '…' : casos.length}</p></div>
          <div className="bg-white p-4 rounded shadow"><p className="text-xs text-gray-500">Activos</p><p className="text-xl font-semibold">{sessionMetrics?.casos_activos ?? '—'}</p></div>
          <div className="bg-white p-4 rounded shadow"><p className="text-xs text-gray-500">Plazos 7d</p><p className="text-xl font-semibold">{sessionMetrics?.plazos_proximos_7d ?? '—'}</p></div>
          <div className="bg-white p-4 rounded shadow"><p className="text-xs text-gray-500">Docs</p><p className="text-xl font-semibold">{sessionMetrics?.documentos_total ?? '—'}</p></div>
          <div className="bg-white p-4 rounded shadow"><p className="text-xs text-gray-500">DB</p><p className={`text-sm font-medium ${health?.database === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{health?.database || '...'}</p></div>
          <div className="bg-white p-4 rounded shadow"><p className="text-xs text-gray-500">Redis</p><p className={`text-sm font-medium ${health?.redis === 'ok' ? 'text-green-600' : 'text-red-600'}`}>{health?.redis || '...'}</p></div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UpcomingDeadlines deadlines={sessionMetrics?.widgets?.plazos_proximos} />
          <RecentDocuments documents={sessionMetrics?.widgets?.documentos_recientes} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <CalculadoraTerminos />
          </div>
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-semibold text-gray-900">Mis Casos</h2><button onClick={() => setShowNewCase(true)} className="inline-flex items-center px-4 py-2 rounded bg-indigo-600 text-white text-sm font-medium shadow hover:bg-indigo-700">Nuevo Caso</button></div>
            <CaseList casos={casos} loading={casesLoading} error={casesError} />
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Notificaciones de Boletines</h3>
          <BulletinNotificationList />
        </div>
      </div>
      {showNewCase && <NewCaseModal open={showNewCase} onClose={() => setShowNewCase(false)} />}
      {showExpiryModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Sesión a punto de expirar</h3>
            <p className="text-sm text-gray-600">Intentaremos renovarla automáticamente. Si falla, deberás volver a iniciar sesión.</p>
            <p className="text-sm font-mono text-gray-500">Restante: {expiryModalCountdown ?? '—'}s</p>
            <div className="flex justify-end gap-2">
              <button onClick={doLogout} className="text-sm px-3 py-2 rounded bg-red-500 text-white hover:bg-red-600">Cerrar ahora</button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

export default DashboardPage;