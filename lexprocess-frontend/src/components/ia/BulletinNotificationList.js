import React, { useState, useEffect } from 'react';
import apiClient from '../../api/axios';
import alerts from '../../lib/alerts';

const BulletinNotificationList = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const resp = await apiClient.get('/boletines/notificaciones/');
            setNotifications(resp.data.results || resp.data);
        } catch (err) {
            console.error("Error al cargar notificaciones", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        alerts.loading('Sincronizando Boletines', 'Buscando nuevas notificaciones en el SISE y Boletines Judiciales.');
        try {
            await apiClient.post('/boletines/notificaciones/sincronizar/');
            alerts.success('Sincronización Iniciada', 'El proceso se está ejecutando en segundo plano. Los resultados aparecerán en breve.');
        } catch (err) {
            alerts.error('Error de Sincronización', 'No se pudo conectar con el monitor de boletines.');
        } finally {
            setSyncing(false);
        }
    };

    const handleApprove = async (notif) => {
        const result = await alerts.confirm(
            'Confirmar acción',
            `¿Deseas aplicar el hito "${notif.sugerencia_workflow_paso}" y archivar esta notificación? esto también agendará los plazos correspondientes.`
        );

        if (result.isConfirmed) {
            try {
                alerts.loading('Aplicando...', 'Se está actualizando el flujo del caso.');
                await apiClient.patch(`/boletines/notificaciones/${notif.id}/`, { revisado: true });
                await fetchNotifications();
                alerts.success('¡Hecho!', `Se ha actualizado el estado de ${notif.caso_nombre}.`);
            } catch (err) {
                alerts.error('Error', 'No se pudo procesar la sugerencia.');
            }
        }
    };

    return (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-bold text-gray-800">Monitor de Boletín Judicial (SISE / CDMX)</h3>
                <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                    {syncing ? 'Sincronizando...' : '🔄 Sincronizar Ahora'}
                </button>
            </div>
            <div className="divide-y divide-gray-200">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Cargando notificaciones...</div>
                ) : notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No hay notificaciones nuevas pendientes.</div>
                ) : (
                    notifications.map(notif => (
                        <div key={notif.id} className={`p-6 hover:bg-gray-50 transition-colors ${notif.revisado ? 'opacity-60' : ''}`}>
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-bold px-2 py-1 bg-blue-100 text-blue-700 rounded uppercase tracking-wider">
                                    {notif.origen_display}
                                </span>
                                <span className="text-xs text-gray-400 font-mono">
                                    {notif.fecha_publicacion}
                                </span>
                            </div>
                            <p className="text-sm font-bold text-indigo-900 mb-1">{notif.caso_nombre}</p>
                            <p className="text-sm text-gray-700 italic border-l-4 border-gray-200 pl-4 py-1">
                                "{notif.resumen_acuerdo}"
                            </p>

                            {notif.sugerencia_workflow_paso && !notif.revisado && (
                                <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                                    <h5 className="text-xs font-bold text-green-800 flex items-center gap-1 mb-1">
                                        ✨ Análisis IA: Sugerido marcar "{notif.sugerencia_workflow_paso}"
                                    </h5>
                                    <p className="text-[11px] text-green-700">{notif.explicacion_ia}</p>
                                    <div className="mt-3 flex gap-2">
                                        <button
                                            onClick={() => handleApprove(notif)}
                                            className="px-3 py-1 bg-green-600 text-white text-[10px] font-bold rounded hover:bg-green-700"
                                        >
                                            Aprobar y Agendar Plazo
                                        </button>
                                        <button
                                            onClick={() => apiClient.patch(`/boletines/notificaciones/${notif.id}/`, { revisado: true }).then(fetchNotifications)}
                                            className="px-3 py-1 border border-gray-300 text-gray-600 text-[10px] rounded hover:bg-gray-100"
                                        >
                                            Ignorar
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default BulletinNotificationList;
