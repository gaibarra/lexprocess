import React from 'react';

const UpcomingDeadlines = ({ deadlines }) => {
    if (!deadlines || deadlines.length === 0) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Próximos Plazos</h3>
                <p className="text-gray-500 text-sm">No hay plazos pendientes para los próximos 7 días.</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Próximos Plazos</h3>
            <div className="space-y-4">
                {deadlines.map((plazo) => {
                    const fecha = new Date(plazo.fecha_hora_vencimiento);
                    const hoy = new Date();
                    const esHoy = fecha.toDateString() === hoy.toDateString();

                    return (
                        <div key={plazo.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-md transition-colors">
                            <div className={`mt-1 h-3 w-3 rounded-full flex-shrink-0 ${esHoy ? 'bg-red-500 animate-pulse' : 'bg-blue-400'}`}></div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{plazo.titulo}</p>
                                <div className="flex justify-between items-center mt-1">
                                    <p className="text-xs text-gray-500 truncate">{plazo.caso_nombre}</p>
                                    <p className={`text-xs font-semibold ${esHoy ? 'text-red-600' : 'text-gray-700'}`}>
                                        {fecha.toLocaleDateString()} {fecha.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default UpcomingDeadlines;
