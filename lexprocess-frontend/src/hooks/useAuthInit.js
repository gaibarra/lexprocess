// src/hooks/useAuthInit.js - CORRECTO
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

const useAuthInit = () => {
  // Obtenemos las funciones y el estado que necesitamos del store
  const { isAuthenticated, refreshToken, refreshAccessToken, setLoading } = useAuthStore(
    (state) => ({
      isAuthenticated: state.isAuthenticated,
      refreshToken: state.refreshToken,
      refreshAccessToken: state.refreshAccessToken,
      setLoading: state.setLoading,
    })
  );

  useEffect(() => {
    // Esta lógica se ejecutará UNA SOLA VEZ cuando la app se monte por primera vez
    if (isAuthenticated && refreshToken) {
      refreshAccessToken();
    } else {
      // Si no hay sesión que verificar, simplemente terminamos el estado de carga
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // El array vacío asegura que solo se ejecute una vez

  // Este hook no devuelve nada
};

export default useAuthInit;