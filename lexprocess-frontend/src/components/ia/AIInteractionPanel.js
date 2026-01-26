import React, { useState } from 'react';
import apiClient from '../../api/axios';
import alerts from '../../lib/alerts';

function AIInteractionPanel({ caseId }) {
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    const userMessage = { sender: 'user', text: query };
    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    setLoading(true);

    try {
      const response = await apiClient.post(`/casos/${caseId}/consulta-ia/`, { pregunta: query });
      const aiMessage = { sender: 'ai', text: response.data.respuesta };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error con el asistente IA:", error);
      const detail = error.response?.data?.error || 'Lo siento, no pude procesar tu pregunta en este momento.';
      alerts.error('Fallo en el Asistente IA', detail);

      const errorMessage = { sender: 'ai', text: 'Error en la conexión con la IA. Por favor, revisa tu conexión o intenta más tarde.' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg flex flex-col h-[500px]">
      {/* Área de mensajes */}
      <div className="flex-grow p-4 overflow-y-auto">
        {messages.map((msg, index) => (
          <div key={index} className={`mb-4 flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`rounded-lg px-4 py-2 max-w-sm ${msg.sender === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-lg px-4 py-2 bg-gray-200 text-gray-500">
              El asistente está pensando...
            </div>
          </div>
        )}
      </div>

      {/* Input de usuario */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <div className="flex">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pregunta sobre el caso..."
            className="flex-grow border rounded-l-md p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            disabled={loading}
          />
          <button type="submit" className="bg-indigo-600 text-white px-4 rounded-r-md hover:bg-indigo-700 disabled:bg-indigo-300" disabled={loading}>
            Enviar
          </button>
        </div>
      </form>
    </div>
  );
}

export default AIInteractionPanel;