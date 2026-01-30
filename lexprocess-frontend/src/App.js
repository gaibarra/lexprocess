// src/App.js
import React, { useEffect, useRef, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import apiClient from './api/axios';

import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/ProtectedRoute';
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const CaseDetailPage = React.lazy(() => import('./pages/CaseDetailPage'));

function App() {
  // Referencia para prevenir doble inicialización en StrictMode
  const initHasRun = useRef(false);

  useEffect(() => {
    if (initHasRun.current) {
      return;
    }
    initHasRun.current = true;

    // Obtener estado y acciones imperativamente (sin suscripción React)
    const { isAuthenticated, refreshToken, updateTokens, logout, setInitialized } = useAuthStore.getState();

    const initializeApp = async () => {
      if (isAuthenticated && refreshToken) {
        try {
          console.log('[App] 🔄 Inicializando con refresh token existente...');

          // Intentar refrescar el access token
          const response = await apiClient.post('/token/refresh/', { refresh: refreshToken });
          const newAccess = response.data.access;
          const newRefresh = response.data.refresh; // Viene si hay token rotation

          // ✅ USAR MÉTODO DEDICADO (maneja rotation + persistencia)
          updateTokens(newAccess, newRefresh);

          console.log('[App] ✅ Sesión restaurada correctamente');

        } catch (error) {
          console.error('[App] ❌ Sesión inválida, cerrando sesión:', error);
          logout();
        } finally {
          setInitialized();
        }
      } else {
        console.log('[App] ℹ️ No hay sesión activa');
        setInitialized();
      }
    };

    initializeApp();
  }, []); // Array vacío crítico para ejecutar solo una vez

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<div className="p-8 text-gray-500">Cargando...</div>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/casos/:id" element={<CaseDetailPage />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;