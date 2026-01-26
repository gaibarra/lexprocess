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
  // Usamos una referencia para asegurarnos que la inicialización solo corra una vez
  const initHasRun = useRef(false);

  useEffect(() => {
    // Si ya se ejecutó, no hacemos nada. Esto previene dobles ejecuciones en StrictMode.
    if (initHasRun.current) {
      return;
    }
    initHasRun.current = true;

    // Obtenemos el estado y las acciones IMPERATIVAMENTE usando getState()
    // Esto no crea una suscripción de React y rompe el bucle de renderizado.
    const { isAuthenticated, refreshToken, setAccessToken, logout, setInitialized } = useAuthStore.getState();

    const initializeApp = async () => {
      if (isAuthenticated && refreshToken) {
        try {
          // Intentamos refrescar el token
          const response = await apiClient.post('/token/refresh/', { refresh: refreshToken });
          // Si tiene éxito, actualizamos el store
          setAccessToken(response.data.access);
        } catch (error) {
          // Si falla, cerramos la sesión
          console.error("Sesión inválida, cerrando sesión.", error);
          logout();
        }
      } else {
        // Si no hay sesión, simplemente terminamos la carga
        setInitialized();
      }
    };

    initializeApp();
  }, []); // El array vacío es CRÍTICO para que solo se ejecute una vez.

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