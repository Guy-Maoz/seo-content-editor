'use client';

import { createContext, ReactNode, useContext, useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

export type AIOperation = {
  id: string;
  type: 'keyword-generation' | 'content-creation' | 'keyword-analysis' | 'info';
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  message: string;
  detail?: string;
  timestamp: Date;
  progress?: number; // 0-100
};

type AITransparencyContextType = {
  operations: AIOperation[];
  addOperation: (operation: Omit<AIOperation, 'id' | 'timestamp'>) => string;
  updateOperation: (id: string, updates: Partial<AIOperation>) => void;
  updateProgress: (id: string, progress: number) => void;
  completeOperation: (id: string, detail?: string) => void;
  failOperation: (id: string, errorDetail?: string) => void;
  clearOperations: () => void;
};

// Create a default context with empty implementations
const defaultContextValue: AITransparencyContextType = {
  operations: [],
  addOperation: () => '',
  updateOperation: () => {},
  updateProgress: () => {},
  completeOperation: () => {},
  failOperation: () => {},
  clearOperations: () => {}
};

const AITransparencyContext = createContext<AITransparencyContextType>(defaultContextValue);

export const useAITransparency = () => {
  const context = useContext(AITransparencyContext);
  return context;
};

export const AITransparencyProvider = ({ children }: { children: ReactNode }) => {
  const [operations, setOperations] = useState<AIOperation[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Use effect to handle SSR
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Add a new operation and return its ID
  const addOperation = useCallback((operation: Omit<AIOperation, 'id' | 'timestamp'>) => {
    if (!isClient) return ''; // Skip during SSR
    
    const id = uuidv4();
    const newOperation: AIOperation = {
      ...operation,
      id,
      timestamp: new Date()
    };
    
    setOperations(prev => [newOperation, ...prev]);
    return id;
  }, [isClient]);

  // Update an existing operation
  const updateOperation = useCallback((id: string, updates: Partial<AIOperation>) => {
    if (!isClient) return; // Skip during SSR
    
    setOperations(prev => 
      prev.map(op => 
        op.id === id ? { ...op, ...updates } : op
      )
    );
  }, [isClient]);

  // Update the progress of an operation
  const updateProgress = useCallback((id: string, progress: number) => {
    if (!isClient) return; // Skip during SSR
    
    setOperations(prev => 
      prev.map(op => 
        op.id === id ? { ...op, progress: Math.min(100, Math.max(0, progress)) } : op
      )
    );
  }, [isClient]);

  // Mark an operation as completed
  const completeOperation = useCallback((id: string, detail?: string) => {
    if (!isClient) return; // Skip during SSR
    
    setOperations(prev => 
      prev.map(op => 
        op.id === id 
          ? { 
              ...op, 
              status: 'completed', 
              progress: 100, 
              detail: detail || op.detail,
              timestamp: new Date()
            } 
          : op
      )
    );
  }, [isClient]);

  // Mark an operation as failed
  const failOperation = useCallback((id: string, errorDetail?: string) => {
    if (!isClient) return; // Skip during SSR
    
    setOperations(prev => 
      prev.map(op => 
        op.id === id 
          ? { 
              ...op, 
              status: 'failed', 
              detail: errorDetail || op.detail,
              timestamp: new Date()
            } 
          : op
      )
    );
  }, [isClient]);

  // Clear all operations
  const clearOperations = useCallback(() => {
    if (!isClient) return; // Skip during SSR
    
    setOperations([]);
  }, [isClient]);

  const value = {
    operations,
    addOperation,
    updateOperation,
    updateProgress,
    completeOperation,
    failOperation,
    clearOperations
  };

  return (
    <AITransparencyContext.Provider value={value}>
      {children}
    </AITransparencyContext.Provider>
  );
};

export default AITransparencyProvider; 