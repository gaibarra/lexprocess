import React from 'react';

const RecentDocuments = ({ documents }) => {
    if (!documents || documents.length === 0) {
        return (
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Documentos Recientes</h3>
                <p className="text-gray-500 text-sm">No se han cargado documentos recientemente.</p>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Documentos Recientes</h3>
            <div className="overflow-hidden">
                <ul className="divide-y divide-gray-100">
                    {documents.map((doc) => (
                        <li key={doc.id} className="py-3 hover:bg-gray-50 px-2 rounded-md transition-colors cursor-pointer">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="flex-shrink-0">
                                        <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="C9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{doc.archivo_nombre || 'Documento sin nombre'}</p>
                                        <p className="text-xs text-gray-500 truncate">{doc.caso_nombre}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${doc.estado_procesamiento === 'COMPLETADO' ? 'bg-green-100 text-green-800' :
                                            doc.estado_procesamiento === 'ERROR' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                                        }`}>
                                        {doc.estado_procesamiento}
                                    </span>
                                    <p className="text-[10px] text-gray-400 mt-1">{new Date(doc.fecha_creacion).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default RecentDocuments;
