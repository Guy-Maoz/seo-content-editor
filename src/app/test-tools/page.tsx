'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function TestToolsPage() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!query.trim()) return;
    
    setLoading(true);
    setResponse('');
    
    try {
      const res = await fetch('/.netlify/functions/tools-handler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });
      
      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }
      
      const data = await res.json();
      setResponse(data.answer || JSON.stringify(data, null, 2));
    } catch (error: any) {
      console.error('Error calling assistant tool:', error);
      setResponse(`Error: ${error.message || 'Unknown error occurred'}`);
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">SEO Assistant with Keyword Metrics Tool</h1>
      
      <div className="flex justify-between items-center mb-4">
        <Link href="/test-tools/diagnostic" className="text-blue-600 hover:underline">
          Check Tool Access Diagnostics →
        </Link>
        <Link href="/" className="text-blue-600 hover:underline">
          ← Back to Main App
        </Link>
      </div>
      
      <div className="mb-8">
        <p className="mb-4">
          Ask the assistant about keyword metrics or SEO advice. The assistant can look up search volume, 
          difficulty, and CPC for keywords using the Similarweb API.
        </p>
        
        <div className="bg-blue-50 p-4 rounded-md mb-4">
          <h2 className="text-lg font-semibold mb-2">Example queries:</h2>
          <ul className="list-disc pl-6">
            <li>"What is the search volume for 'best running shoes'?"</li>
            <li>"Compare the metrics for 'digital marketing' and 'online marketing'"</li>
            <li>"Which has higher search volume: 'content marketing' or 'social media marketing'?"</li>
            <li>"What keywords would be good for an article about coffee brewing methods?"</li>
          </ul>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="mb-4">
          <label htmlFor="query" className="block text-sm font-medium mb-2">Your question:</label>
          <textarea 
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-md"
            rows={4}
            placeholder="Ask about keyword metrics or SEO advice..."
          />
        </div>
        
        <button 
          type="submit" 
          disabled={loading || !query.trim()}
          className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Processing...' : 'Submit'}
        </button>
      </form>
      
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">This may take 20-30 seconds...</p>
        </div>
      )}
      
      {response && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-3">Assistant Response:</h2>
          <div className="bg-gray-50 p-4 rounded-md whitespace-pre-wrap">{response}</div>
        </div>
      )}
    </div>
  );
} 