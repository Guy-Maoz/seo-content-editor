'use client';

import { createContext, ReactNode, useContext, useState, useEffect } from 'react';

interface ThreadContextType {
  threadId: string | null;
  setThreadId: (threadId: string) => void;
  isThreadInitialized: boolean;
}

const defaultContextValue: ThreadContextType = {
  threadId: null,
  setThreadId: () => {},
  isThreadInitialized: false
};

const ThreadContext = createContext<ThreadContextType>(defaultContextValue);

export const useThreadContext = () => {
  return useContext(ThreadContext);
};

export const ThreadProvider = ({ children }: { children: ReactNode }) => {
  const [threadId, setThreadIdState] = useState<string | null>(null);
  const [isThreadInitialized, setIsThreadInitialized] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Handle SSR
  useEffect(() => {
    console.log('[ThreadContext] useEffect - initial setup triggered');
    setIsClient(true);
    
    // Try to load thread ID from localStorage
    try {
      const storedThreadId = localStorage.getItem('seoAssistantThreadId');
      console.log('[ThreadContext] localStorage check - threadId found:', !!storedThreadId);
      
      if (storedThreadId) {
        console.log('[ThreadContext] Using existing threadId:', storedThreadId.substring(0, 8) + '...');
        setThreadIdState(storedThreadId);
        setIsThreadInitialized(true);
      } else {
        console.log('[ThreadContext] No threadId found, initializing new thread');
        // Initialize a new thread if none exists
        initializeThread();
      }
    } catch (error) {
      console.error('[ThreadContext] Error accessing localStorage:', error);
      initializeThread();
    }
  }, []);

  const initializeThread = async () => {
    console.log('[ThreadContext] initializeThread - starting thread creation');
    try {
      // Create a new thread via API
      console.log('[ThreadContext] Calling /api/thread/create endpoint');
      const response = await fetch('/api/thread/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create thread: ${response.status}`);
      }
      
      const data = await response.json();
      const newThreadId = data.threadId;
      console.log('[ThreadContext] Thread created successfully:', newThreadId.substring(0, 8) + '...');
      
      // Store thread ID in localStorage
      try {
        localStorage.setItem('seoAssistantThreadId', newThreadId);
        console.log('[ThreadContext] ThreadId saved to localStorage');
      } catch (error) {
        console.error('[ThreadContext] Failed to save threadId to localStorage:', error);
      }
      
      setThreadIdState(newThreadId);
      setIsThreadInitialized(true);
      console.log('[ThreadContext] Thread initialization complete');
    } catch (error) {
      console.error('[ThreadContext] Failed to initialize thread:', error);
    }
  };

  const setThreadId = (id: string) => {
    if (!id) return;
    
    console.log('[ThreadContext] setThreadId called with:', id.substring(0, 8) + '...');
    // Update thread ID in state and localStorage
    try {
      localStorage.setItem('seoAssistantThreadId', id);
      console.log('[ThreadContext] ThreadId updated in localStorage');
    } catch (error) {
      console.error('[ThreadContext] Failed to update threadId in localStorage:', error);
    }
    
    setThreadIdState(id);
    setIsThreadInitialized(true);
    console.log('[ThreadContext] Thread initialized via setThreadId');
  };

  console.log('[ThreadContext] Current state:', { 
    threadId: threadId ? `${threadId.substring(0, 8)}...` : null, 
    isClient, 
    isThreadInitialized,
    isClientAndInitialized: isClient && isThreadInitialized
  });

  return (
    <ThreadContext.Provider value={{ 
      threadId, 
      setThreadId,
      isThreadInitialized: isClient && isThreadInitialized
    }}>
      {children}
    </ThreadContext.Provider>
  );
};

export default ThreadProvider; 