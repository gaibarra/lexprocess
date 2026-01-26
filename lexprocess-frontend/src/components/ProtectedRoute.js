// src/components/ProtectedRoute.js
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const ProtectedRoute = () => {
  // Evitar crear nuevos objetos en cada render (React 19 + useSyncExternalStore warning)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);

  // Mientras el store indica que está cargando (initializeApp no ha terminado),
  // mostramos un loader.
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-gray-500 font-semibold">Verificando sesión...</div>
      </div>
    );
  }

  // Una vez que isLoading es false, tomamos la decisión final.
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;