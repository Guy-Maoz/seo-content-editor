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
    setIsClient(true);
    
    // Try to load thread ID from localStorage
    const storedThreadId = localStorage.getItem('seoAssistantThreadId');
    if (storedThreadId) {
      setThreadIdState(storedThreadId);
    } else {
      // Initialize a new thread if none exists
      initializeThread();
    }
  }, []);

  const initializeThread = async () => {
    try {
      // Create a new thread via API
      const response = await fetch('/api/thread/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to create thread: ${response.status}`);
      }
      
      const { threadId } = await response.json();
      
      // Store thread ID in localStorage
      localStorage.setItem('seoAssistantThreadId', threadId);
      setThreadIdState(threadId);
      setIsThreadInitialized(true);
    } catch (error) {
      console.error('Failed to initialize thread:', error);
    }
  };

  const setThreadId = (id: string) => {
    if (!id) return;
    
    // Update thread ID in state and localStorage
    localStorage.setItem('seoAssistantThreadId', id);
    setThreadIdState(id);
    setIsThreadInitialized(true);
  };

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