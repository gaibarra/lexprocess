import React from 'react';
import { Link } from 'react-router-dom';

function CaseList({ casos, loading, error }) {
  if (loading) return <p className="p-4 text-gray-500">Cargando casos...</p>;
  if (error) return <p className="p-4 text-red-600">{error}</p>;
  if (!casos || casos.length === 0) return <p className="p-4 text-gray-500">No se encontraron casos.</p>;

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <ul className="divide-y divide-gray-200">
        {casos.map((caso, idx) => (
          <li key={`caso-${caso.id}-${idx}`} className="hover:bg-gray-50">
            <Link to={`/casos/${caso.id}`} className="block px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-indigo-600 truncate">{caso.nombre_caso}</p>
                <div className="ml-2 flex-shrink-0 flex"><p className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${caso.estado_caso === 'ACTIVO' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{caso.estado_caso_display}</p></div>
              </div>
              <div className="mt-2 sm:flex sm:justify-between"><div className="sm:flex"><p className="flex items-center text-sm text-gray-500">Exp: {caso.numero_expediente || 'N/A'}</p><p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">Abogado: {`${caso.abogado_asignado?.first_name || ''} ${caso.abogado_asignado?.last_name || ''}`.trim() || 'No asignado'}</p></div></div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
export default CaseList;