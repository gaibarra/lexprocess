import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../api/axios';
import alerts from '../../lib/alerts';
import { useAuthStore } from '../../store/authStore';

const BulletinNotificationList = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [defaultOrigins, setDefaultOrigins] = useState([]);
    const [availableOrigins, setAvailableOrigins] = useState([]);
    const [wsStatus, setWsStatus] = useState('disconnected');
    const accessToken = useAuthStore((s) => s.accessToken);
    const wsRef = useRef(null);
    const wsRetryRef = useRef(0);
    const wsTimerRef = useRef(null);
    const notificationIdsRef = useRef(new Set());
    const wsConnectRef = useRef(null);

    const buildWsBaseUrl = () => {
        const envBase = process.env.REACT_APP_WS_BASE_URL || process.env.REACT_APP_API_BASE_URL || window.location.origin;
        const trimmed = envBase.replace(/\/api\/v1\/?$/, '');
        if (trimmed.startsWith('http://')) {
            return `ws://${trimmed.slice(7)}`;
        }
        if (trimmed.startsWith('https://')) {
            return `wss://${trimmed.slice(8)}`;
        }
        return trimmed;
    };

    const resolveOriginLabel = (origin) => {
        const match = availableOrigins.find(item => item.value === origin);
        return match ? match.label : origin;
    };

    const getOriginsLabel = () => {
        if (!defaultOrigins.length) {
            return 'SISE / Sonora / CDMX';
        }
        return [...defaultOrigins]
            .sort((a, b) => resolveOriginLabel(a).localeCompare(resolveOriginLabel(b), 'es'))
            .map(resolveOriginLabel)
            .join(' / ');
    };

    const getAvailableOriginsLabel = () => {
        if (!availableOrigins.length) {
            return 'SISE / Sonora / CDMX';
        }
        return [...availableOrigins]
            .sort((a, b) => a.label.localeCompare(b.label, 'es'))
            .map(origin => origin.label)
            .join(' / ');
    };

    const fetchDefaults = async () => {
        try {
            const resp = await apiClient.get('/boletines/defaults/');
            setDefaultOrigins(resp.data.default_origins || []);
            setAvailableOrigins(resp.data.available_origins || []);
        } catch (err) {
            console.warn('No se pudieron cargar los defaults de boletines', err);
        }
    };

    const fetchNotifications = async () => {
        setLoading(true);
        try {
            const resp = await apiClient.get('/boletines/notificaciones/');
            const list = resp.data.results || resp.data;
            setNotifications(list);
            if (Array.isArray(list)) {
                notificationIdsRef.current = new Set(list.map(item => item.id));
            }
        } catch (err) {
            console.error("Error al cargar notificaciones", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
        fetchDefaults();
    }, []);

    useEffect(() => {
        if (!accessToken) {
            return undefined;
        }
        const connect = () => {
            const wsBase = buildWsBaseUrl();
            const socket = new WebSocket(`${wsBase}/ws/boletines/?token=${accessToken}`);
            wsRef.current = socket;
            setWsStatus('connecting');
            socket.onopen = () => {
                wsRetryRef.current = 0;
                setWsStatus('connected');
            };
            socket.onclose = () => {
                setWsStatus('disconnected');
                wsRetryRef.current += 1;
                const delay = Math.min(30000, 1000 * (2 ** wsRetryRef.current));
                wsTimerRef.current = setTimeout(connect, delay);
            };
            socket.onerror = () => setWsStatus('error');
            socket.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data || '{}');
                    if (payload?.id && !notificationIdsRef.current.has(payload.id)) {
                        alerts.success('Nuevo boletín', payload.caso_nombre || 'Hay una nueva notificación.');
                    }
                } catch (_) {
                    // ignore parse errors
                }
                fetchNotifications();
            };
        };
        wsConnectRef.current = connect;
        connect();
        return () => {
            if (wsTimerRef.current) {
                clearTimeout(wsTimerRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [accessToken]);

    const handleReconnect = () => {
        if (wsTimerRef.current) {
            clearTimeout(wsTimerRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
        }
        wsRetryRef.current = 0;
        if (wsConnectRef.current) {
            wsConnectRef.current();
        }
    };

    const getWsStatusClass = () => {
        if (wsStatus === 'connected') return 'text-green-600';
        if (wsStatus === 'connecting') return 'text-yellow-600';
        if (wsStatus === 'error') return 'text-red-600';
        return 'text-gray-500';
    };

    const getWsStatusLabel = () => {
        if (wsStatus === 'connected') return 'Conectado';
        if (wsStatus === 'connecting') return 'Conectando';
        if (wsStatus === 'error') return 'Error';
        return 'Desconectado';
    };

    const getReconnectLabel = () => {
        if (wsStatus === 'error') return 'Reintentar';
        return 'Reconectar';
    };

    const getReconnectIcon = () => {
        if (wsStatus === 'error') return '⚠️';
        return '🔌';
    };

    const getReconnectClass = () => {
        if (wsStatus === 'error') {
            return 'px-3 py-1 border border-red-300 text-red-600 text-xs rounded hover:bg-red-50';
        }
        return 'px-3 py-1 border border-gray-300 text-gray-600 text-xs rounded hover:bg-gray-100';
    };

    const handleSync = async () => {
        setSyncing(true);
        const originsLabel = getOriginsLabel();
        alerts.loading('Sincronizando Boletines', `Buscando nuevas notificaciones en ${originsLabel}.`);
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
                <h3 className="text-lg font-bold text-gray-800">Monitor de Boletín Judicial ({getOriginsLabel()})</h3>
                <div className="flex items-center gap-3">
                    <span className={`text-xs ${getWsStatusClass()}`}>WS: {getWsStatusLabel()}</span>
                    {wsStatus === 'connecting' && (
                        <span className="inline-flex items-center gap-1 text-xs text-yellow-600">
                            <span className="h-3 w-3 rounded-full border-2 border-yellow-600 border-t-transparent animate-spin" />
                            Reintentando...
                        </span>
                    )}
                    {(wsStatus === 'error' || wsStatus === 'disconnected') && (
                        <button
                            onClick={handleReconnect}
                            className={getReconnectClass()}
                        >
                            <span className="mr-1">{getReconnectIcon()}</span>
                            {getReconnectLabel()}
                        </button>
                    )}
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {syncing ? 'Sincronizando...' : '🔄 Sincronizar Ahora'}
                    </button>
                </div>
            </div>
            <div className="px-6 py-2 text-xs text-gray-500 bg-white border-b border-gray-100">
                Orígenes disponibles: {getAvailableOriginsLabel()}
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
