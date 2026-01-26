// src/components/documentos/DocumentManager.js

import React, { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from '../../api/axios';
import { useAuthStore } from '../../store/authStore';
import alerts from '../../lib/alerts';

function DocumentManager({ caseId }) {
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const fileInputRef = useRef();

  const fetchDocumentos = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/documentos/?caso_id=${caseId}`);
      setDocumentos(response.data.results);
    } catch (error) {
      console.error("Error al cargar documentos:", error);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchDocumentos();
  }, [fetchDocumentos]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const refreshSessionMetrics = useAuthStore(s => s.refreshSessionMetrics);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      alerts.warning('Archivo requerido', 'Por favor selecciona un archivo antes de intentar subirlo.');
      return;
    }

    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('caso_id', caseId);
    formData.append('nombre_documento', file.name);

    setUploading(true);
    alerts.loading('Subiendo documento...', `Estamos guardando "${file.name}" en el servidor.`);

    try {
      await apiClient.post('/documentos/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      fetchDocumentos();
      alerts.success('¡Subida exitosa!', `El documento "${file.name}" se cargó correctamente y está en cola para procesamiento IA.`);
      refreshSessionMetrics();
    } catch (error) {
      console.error("Error al subir el archivo:", error);
      const detail = error.response?.data?.archivo || 'No se pudo completar la carga del archivo.';
      alerts.error('Error en la carga', detail);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-4">
      {/* Formulario de subida */}
      <form onSubmit={handleUpload} className="mb-4 pb-4 border-b">
        <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700">
          Subir nuevo documento
        </label>
        <div className="mt-1 flex items-center">
          <input
            id="file-upload"
            type="file"
            onChange={handleFileChange}
            ref={fileInputRef}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
            disabled={uploading}
          />
          <button
            type="submit"
            className="ml-3 inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:bg-indigo-300"
            disabled={uploading}
          >
            {uploading ? 'Subiendo...' : 'Subir'}
          </button>
        </div>
      </form>

      {/* Lista de documentos */}
      <h4 className="text-md font-medium text-gray-800 mb-2">Documentos Existentes</h4>
      {loading ? (
        <p>Cargando...</p>
      ) : (
        <ul>
          {documentos.length > 0 ? (
            documentos.map((doc, idx) => (
              <li key={`doc-${doc.id}-${idx}`} className="text-sm py-1 flex justify-between items-center">
                <span>- {doc.nombre_documento}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${doc.processing_status === 'PROCESADO' ? 'bg-green-100 text-green-800' :
                  doc.processing_status === 'ERROR' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                  {doc.processing_status}
                </span>
              </li>
            ))
          ) : (
            <li className="text-sm text-gray-500">No hay documentos en este caso.</li>
          )}
        </ul>
      )}
    </div>
  );
}

export default DocumentManager;