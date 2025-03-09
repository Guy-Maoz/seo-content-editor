'use client';

import React, { useEffect, useState } from 'react';
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import { FiMessageSquare, FiFeather } from 'react-icons/fi';
import { useThreadContext } from '@/contexts/ThreadContext';
import { useAITransparency } from '@/contexts/AITransparencyContext';

interface ChatAssistantProps {
  isExpanded?: boolean;
}

const ChatAssistant: React.FC<ChatAssistantProps> = ({ isExpanded = true }) => {
  console.log('[ChatAssistant] Component rendering');
  const [isLoading, setIsLoading] = useState(true);
  const { threadId, isThreadInitialized } = useThreadContext();
  const { addOperation, completeOperation, failOperation } = useAITransparency();

  console.log('[ChatAssistant] Initial state:', { 
    threadId: threadId ? threadId.substring(0, 8) + '...' : null, 
    isThreadInitialized,
    isLoading 
  });

  // Wait for thread to be initialized
  useEffect(() => {
    console.log('[ChatAssistant] useEffect fired - thread state changed:', { 
      threadId: threadId ? threadId.substring(0, 8) + '...' : null, 
      isThreadInitialized 
    });
    
    if (threadId && isThreadInitialized) {
      console.log('[ChatAssistant] Thread is initialized, setting isLoading=false');
      setIsLoading(false);
    } else {
      console.log('[ChatAssistant] Still waiting for thread initialization');
    }
  }, [threadId, isThreadInitialized]);
  
  // Log operations when starting a chat
  useEffect(() => {
    console.log('[ChatAssistant] threadId effect triggered:', !!threadId);
    if (threadId) {
      console.log('[ChatAssistant] Adding chat initialization operation');
      const operationId = addOperation({
        type: 'info',
        status: 'completed',
        message: 'Chat session initialized',
        detail: `Using thread: ${threadId}`,
      });
      console.log('[ChatAssistant] Operation added:', operationId);
    }
  }, [threadId, addOperation]);

  console.log('[ChatAssistant] Creating runtime with threadId:', threadId ? `${threadId.substring(0, 8)}...` : null);
  
  // Create a custom runtime that includes the threadId in the request body
  const runtime = useChatRuntime({
    api: "/api/chat",
    body: {
      threadId
    },
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: `👋 Hello! I'm your SEO Assistant. I can help you with:

- Generating keyword suggestions for your content
- Creating SEO-optimized content using your selected keywords
- Analyzing content for SEO improvements
- Answering questions about SEO best practices

Just type your question or select a task to get started!`,
      },
    ],
    onResponse: (response) => {
      // Log the response for debugging
      console.log('[ChatAssistant] Chat response received', response.status);
      
      // Log operation for the response
      if (response.ok) {
        const operationId = addOperation({
          type: 'info',
          status: 'in-progress',
          message: 'Processing your request',
          detail: 'The AI is generating a response...',
          progress: 30
        });
        
        // Update operation after a delay to simulate progress
        setTimeout(() => {
          completeOperation(operationId, 'Response processed successfully');
        }, 2000);
      } else {
        // Log error if response is not OK
        addOperation({
          type: 'info',
          status: 'failed',
          message: 'Error processing request',
          detail: `HTTP error: ${response.status}`,
        });
      }
    }
  });

  console.log('[ChatAssistant] Runtime created, current loading state:', isLoading);

  if (isLoading) {
    console.log('[ChatAssistant] Rendering loading state');
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-3"></div>
        <p className="text-sm text-gray-600">Initializing assistant...</p>
      </div>
    );
  }

  console.log('[ChatAssistant] Rendering Thread component');
  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center">
        <FiMessageSquare className="text-blue-500 mr-2 text-xl" />
        <h2 className="text-xl font-semibold">SEO Assistant</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm">
        <AssistantRuntimeProvider runtime={runtime}>
          <Thread />
        </AssistantRuntimeProvider>
      </div>
      
      <div className="mt-2 text-xs text-gray-500 flex items-center">
        <FiFeather className="mr-1" />
        <span>Type a message or ask a question about SEO</span>
      </div>
    </div>
  );
};

export default ChatAssistant; 