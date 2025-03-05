'use client';

import { useState, useEffect } from 'react';
import { FiSearch, FiLoader } from 'react-icons/fi';

export default function TestSimilarWeb() {
  const [keyword, setKeyword] = useState('digital marketing');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testSimilarWebAPI = async () => {
    if (!keyword.trim()) return;
    
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch(`/api/test-similarweb?keyword=${encodeURIComponent(keyword)}`);
      const data = await response.json();
      
      if (response.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to fetch data from SimilarWeb API');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl mb-4">
            SimilarWeb API Test
          </h1>
          <p className="text-xl text-gray-900 max-w-2xl mx-auto">
            Test the SimilarWeb API integration for keyword metrics
          </p>
        </header>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex gap-4 mb-6">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiSearch className="text-gray-400" />
              </div>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Enter a keyword to test"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                disabled={isLoading}
              />
            </div>
            <button
              onClick={testSimilarWebAPI}
              disabled={isLoading || !keyword.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <FiLoader className="animate-spin mr-2" />
                  Testing...
                </>
              ) : (
                'Test API'
              )}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
              <div className="flex">
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {result && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">API Response:</h2>
              <div className="bg-gray-50 p-4 rounded-md overflow-auto max-h-[500px]">
                <pre className="text-sm text-gray-900 whitespace-pre-wrap">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
} 