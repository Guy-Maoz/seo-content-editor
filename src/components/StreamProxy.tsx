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
    // Format is always "type:content", but we need to be careful about the split
    // since the content may contain colons (especially in JSON)
    const colonIndex = part.indexOf(':');
    if (colonIndex === -1) return; // Skip malformed parts
    
    const type = part.substring(0, colonIndex);
    const content = part.substring(colonIndex + 1);
    
    if (!type || !content) return; // Skip empty parts
    
    // Different handling based on chunk type
    if (type === '0') {
      // Type 0 is plain text, not JSON
      // Clean up any quotation marks in the raw text
      let cleanText = content;
      
      // If the content appears to be a JSON string with escaped quotes, clean it up
      if (content.startsWith('"') && content.endsWith('"')) {
        try {
          // Try to parse and clean if it's a JSON string
          cleanText = JSON.parse(content);
        } catch (e) {
          // If it's not valid JSON, just use the original
          cleanText = content;
        }
      }
      
      onData({ type, content: cleanText });
    } else {
      // Other types (f, t, r, d) contain JSON
      try {
        // Some chunks might have escaped JSON, so we need to be careful
        const parsedContent = JSON.parse(content);
        onData({ type, content: parsedContent });
      } catch (e) {
        console.warn(`JSON parse error for type ${type}:`, e);
        // Still try to deliver the raw content
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