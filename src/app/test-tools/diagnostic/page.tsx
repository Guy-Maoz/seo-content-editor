'use client';

import { useState } from 'react';

export default function AssistantDiagnosticPage() {
  const [assistantId, setAssistantId] = useState('asst_JXBmxj6nBTPncEpjwJmtzLTr');
  const [testKeyword, setTestKeyword] = useState('japanese chef knives');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  async function runDiagnostic() {
    setLoading(true);
    setError('');
    setResults(null);
    
    try {
      // Build the query URL with parameters
      const url = `/api/tools/diagnostic?assistant_id=${encodeURIComponent(assistantId)}&keyword=${encodeURIComponent(testKeyword)}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to run diagnostic');
      }
      
      setResults(data);
    } catch (error: any) {
      console.error('Error running diagnostic:', error);
      setError(error.message || 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Assistant Tool Access Diagnostic</h1>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">Assistant ID:</label>
          <input 
            type="text" 
            value={assistantId}
            onChange={(e) => setAssistantId(e.target.value)}
            className="w-full p-2 border rounded"
          />
          <p className="text-xs text-gray-500 mt-1">Default: asst_JXBmxj6nBTPncEpjwJmtzLTr</p>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-2">Test Keyword:</label>
          <input 
            type="text" 
            value={testKeyword}
            onChange={(e) => setTestKeyword(e.target.value)}
            className="w-full p-2 border rounded"
          />
          <p className="text-xs text-gray-500 mt-1">Keyword to test with the tool</p>
        </div>
        
        <div>
          <button
            onClick={runDiagnostic}
            disabled={loading || !assistantId.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
          >
            {loading ? 'Running Diagnostic...' : 'Run Diagnostic'}
          </button>
        </div>
        
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <h3 className="font-medium text-red-800">Error</h3>
            <p className="text-red-700">{error}</p>
          </div>
        )}
        
        {results && (
          <div className="bg-gray-50 p-4 rounded border">
            <h2 className="text-xl font-bold mb-4">Diagnostic Results</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">Assistant Information</h3>
                <div className="ml-4">
                  <p><span className="font-medium">ID:</span> {results.assistant.id}</p>
                  <p><span className="font-medium">Name:</span> {results.assistant.name}</p>
                  <p><span className="font-medium">Model:</span> {results.assistant.model}</p>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium">Tool Access</h3>
                <div className="ml-4">
                  <p>
                    <span className="font-medium">Tool was called:</span>{' '}
                    {results.diagnostic_results.tool_was_called ? (
                      <span className="text-green-600 font-medium">Yes ✓</span>
                    ) : (
                      <span className="text-red-600 font-medium">No ✗</span>
                    )}
                  </p>
                  {results.diagnostic_results.tool_call_id && (
                    <p><span className="font-medium">Tool Call ID:</span> {results.diagnostic_results.tool_call_id}</p>
                  )}
                </div>
              </div>
              
              {results.diagnostic_results.tool_call_result && (
                <div>
                  <h3 className="font-medium">Tool Results for "{testKeyword}"</h3>
                  <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
                    {JSON.stringify(results.diagnostic_results.tool_call_result, null, 2)}
                  </pre>
                </div>
              )}
              
              <div>
                <h3 className="font-medium">Assistant Response</h3>
                <div className="bg-white p-3 border rounded">
                  {results.diagnostic_results.final_response || 'No response from assistant'}
                </div>
              </div>
              
              <div>
                <h3 className="font-medium">Run Status</h3>
                <div className="ml-4">
                  <p>
                    <span className="font-medium">Completed:</span>{' '}
                    {results.diagnostic_results.test_completed ? (
                      <span className="text-green-600 font-medium">Yes ✓</span>
                    ) : (
                      <span className="text-red-600 font-medium">No ✗</span>
                    )}
                  </p>
                  <p><span className="font-medium">Final Status:</span> {results.diagnostic_results.run_status}</p>
                  <p><span className="font-medium">Attempts Made:</span> {results.diagnostic_results.attempts_made}</p>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium">OpenAI Thread Information</h3>
                <div className="ml-4">
                  <p><span className="font-medium">Thread ID:</span> {results.thread_id}</p>
                  <p><span className="font-medium">Run ID:</span> {results.run_id}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 