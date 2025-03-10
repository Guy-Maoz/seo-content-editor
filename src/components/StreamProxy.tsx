'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom streaming proxy to maintain connection to streaming APIs
 * Addresses client disconnect issues with Next.js and assistant-ui
 */
export default function useStreamProxy(apiEndpoint: string) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const keepAliveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cleanup function for aborting streams and clearing intervals
  const cleanup = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (keepAliveIntervalRef.current) {
      clearInterval(keepAliveIntervalRef.current);
      keepAliveIntervalRef.current = null;
    }
    
    setIsStreaming(false);
  }, []);
  
  // Clean up on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);
  
  // Stream data from the API with enhanced error handling and keep-alive pings
  const streamRequest = useCallback(async (body: any, onData: (data: any) => void, onError: (err: any) => void, onComplete: () => void) => {
    try {
      cleanup(); // Ensure any existing connections are cleaned up
      
      setIsStreaming(true);
      setError(null);
      
      // Create a new AbortController for this request
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;
      
      // Ping mechanism to keep connection alive
      keepAliveIntervalRef.current = setInterval(() => {
        // Send a small no-op ping to prevent connection timeouts
        if (isStreaming && navigator.onLine) {
          // Simple ping to keep connection alive
          fetch('/api/ping', { 
            method: 'GET',
            cache: 'no-store',
            keepalive: true
          }).catch(e => console.log('Ping error (non-critical):', e)); 
        }
      }, 20000); // Send ping every 20 seconds
      
      // Make the actual streaming request
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal,
        // These are critical for maintaining connections
        cache: 'no-store',
        keepalive: true,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      if (!response.body) {
        throw new Error('Response body is null');
      }
      
      // Handle the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let partialChunk = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          // Handle any remaining data in partialChunk
          if (partialChunk.trim()) {
            try {
              const parts = partialChunk.split('\n');
              for (const part of parts) {
                if (part.trim()) {
                  processStreamPart(part, onData);
                }
              }
            } catch (e) {
              console.warn('Error processing final chunk:', e);
            }
          }
          break;
        }
        
        // Decode the chunk and combine with any previous partial chunk
        const chunk = decoder.decode(value, { stream: true });
        const fullChunk = partialChunk + chunk;
        
        // Split by newline and process each complete message
        const parts = fullChunk.split('\n');
        
        // Keep the last part as it might be incomplete
        partialChunk = parts.pop() || '';
        
        // Process all complete messages
        for (const part of parts) {
          if (part.trim()) {
            try {
              processStreamPart(part, onData);
            } catch (e) {
              console.warn('Error processing chunk:', e);
            }
          }
        }
      }
      
      onComplete();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Stream aborted');
      } else {
        console.error('Stream error:', err);
        setError(err.message || 'Unknown error');
        onError(err);
      }
    } finally {
      cleanup();
    }
  }, [apiEndpoint, cleanup, isStreaming]);
  
  // Helper function to process each part of the stream correctly
  const processStreamPart = (part: string, onData: (data: any) => void) => {
    const [type, content] = part.split(':', 2);
    
    if (!type || content === undefined) return; // Skip malformed parts
    
    // Different handling based on chunk type
    if (type === '0') {
      // Type 0 is raw text, not JSON
      onData({ type, content });
    } else {
      // Other types (f, t, r, d) contain JSON
      try {
        onData({ type, content: JSON.parse(content) });
      } catch (e) {
        console.warn(`JSON parse error for type ${type}:`, e);
        // For non-text chunks, still try to deliver the content as-is if JSON parsing fails
        onData({ type, content, parseError: true });
      }
    }
  };
  
  return {
    streamRequest,
    isStreaming,
    error,
    abort: cleanup,
  };
} 