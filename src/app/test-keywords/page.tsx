'use client';

import { useState } from 'react';

export default function TestKeywords() {
  const [topic, setTopic] = useState('digital marketing');
  const [keywords, setKeywords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchKeywords = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ topic }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      setKeywords(data.keywords || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Test Keywords API</h1>
      
      <div className="mb-4">
        <label className="block mb-2">Topic:</label>
        <div className="flex">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="border p-2 mr-2 flex-grow"
          />
          <button
            onClick={fetchKeywords}
            disabled={loading}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            {loading ? 'Loading...' : 'Get Keywords'}
          </button>
        </div>
      </div>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      {keywords.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Keywords:</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border">
              <thead>
                <tr>
                  <th className="border p-2">Keyword</th>
                  <th className="border p-2">Volume</th>
                  <th className="border p-2">Difficulty</th>
                  <th className="border p-2">CPC</th>
                  <th className="border p-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {keywords.map((keyword, index) => (
                  <tr key={index} className={keyword.source === 'similarweb' ? 'bg-green-100' : ''}>
                    <td className="border p-2">{keyword.keyword}</td>
                    <td className="border p-2">{keyword.volume?.toLocaleString()}</td>
                    <td className="border p-2">{keyword.difficulty}</td>
                    <td className="border p-2">${keyword.cpc?.toFixed(2)}</td>
                    <td className="border p-2">{keyword.source || 'unknown'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4">
            <h3 className="font-semibold">Summary:</h3>
            <p>Total keywords: {keywords.length}</p>
            <p>Keywords with SimilarWeb data: {keywords.filter(k => k.source === 'similarweb').length}</p>
            <p>Keywords with OpenAI estimates: {keywords.filter(k => k.source === 'openai').length}</p>
            <p>Keywords with errors: {keywords.filter(k => k.source === 'openai_error').length}</p>
          </div>
        </div>
      )}
    </div>
  );
} 