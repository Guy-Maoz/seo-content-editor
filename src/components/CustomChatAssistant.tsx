'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { FiMessageSquare, FiFeather, FiSend } from 'react-icons/fi';
import { useThreadContext } from '@/contexts/ThreadContext';
import { useAITransparency } from '@/contexts/AITransparencyContext';
import useStreamProxy from './StreamProxy';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface CustomChatAssistantProps {
  isExpanded?: boolean;
}

const CustomChatAssistant: React.FC<CustomChatAssistantProps> = ({ isExpanded = true }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `👋 Hello! I'm your SEO Assistant. I can help you with:

- Generating keyword suggestions for your content
- Creating SEO-optimized content using your selected keywords
- Analyzing content for SEO improvements
- Answering questions about SEO best practices

Just type your question or select a task to get started!`,
    }
  ]);
  const [userInput, setUserInput] = useState('');
  const [currentResponse, setCurrentResponse] = useState('');
  const [isProcessingStream, setIsProcessingStream] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { threadId, isThreadInitialized } = useThreadContext();
  const { addOperation, completeOperation, failOperation } = useAITransparency();
  const streamProxy = useStreamProxy('/api/chat');
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, currentResponse]);
  
  // Wait for thread to be initialized
  useEffect(() => {
    if (threadId && isThreadInitialized) {
      setIsLoading(false);
    } else {
    }
  }, [threadId, isThreadInitialized]);
  
  // Log operations when starting a chat
  useEffect(() => {
    if (threadId) {
      const operationId = addOperation({
        type: 'info',
        status: 'completed',
        message: 'Chat session initialized',
        detail: `Using thread: ${threadId}`,
      });
    }
  }, [threadId, addOperation]);
  
  // Handle sending messages
  const handleSendMessage = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!userInput.trim() || isProcessingStream || !threadId) return;
    
    // Add user message to the UI immediately
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userInput,
    };
    setMessages(prev => [...prev, userMessage]);
    
    // Clear input and prepare for response
    const currentUserInput = userInput;
    setUserInput('');
    setCurrentResponse('');
    setIsProcessingStream(true);
    
    // Log operation
    const operationId = addOperation({
      type: 'info',
      status: 'in-progress',
      message: 'Processing your request',
      detail: 'Connecting to AI...',
      progress: 10,
    });
    
    // Use our custom stream proxy
    streamProxy.streamRequest(
      {
        messages: [{ role: 'user', content: currentUserInput }],
        threadId,
      },
      (data) => {
        // Handle incoming stream data
        if (data.type === '0') {
          // Text content - Clean up the content by removing excessive quotes
          // The content should be raw text, but checking to ensure it's a string
          let cleanContent = typeof data.content === 'string' ? data.content : String(data.content);
          
          // We don't need additional cleanup here - just append the raw text
          setCurrentResponse(prev => prev + cleanContent);
        } else if (data.type === 't') {
          // Tool call - log it
          try {
            if (data.parseError) {
              // Handle unparsed tool call data
              addOperation({
                type: 'info',
                status: 'in-progress',
                message: 'Processing your request',
                detail: 'Using AI tools',
                progress: 40,
              });
            } else if (data.content && data.content.function) {
              completeOperation(operationId, `Using tool: ${data.content.function.name}`);
              try {
                const args = JSON.parse(data.content.function.arguments);
                addOperation({
                  type: 'info',
                  status: 'in-progress',
                  message: `Using ${data.content.function.name}`,
                  detail: args.keyword ? `Looking up data for "${args.keyword}"` : 'Processing information',
                  progress: 40,
                });
              } catch (argError) {
                // If we can't parse the arguments
                addOperation({
                  type: 'info',
                  status: 'in-progress',
                  message: `Using ${data.content.function.name}`,
                  detail: 'Processing data',
                  progress: 40,
                });
              }
            }
          } catch (e) {
            console.warn('Error handling tool call:', e);
            // Add a generic operation if all else fails
            addOperation({
              type: 'info',
              status: 'in-progress',
              message: 'Processing with AI tools',
              detail: 'Working on your request',
              progress: 40,
            });
          }
        } else if (data.type === 'r') {
          // Tool result - log it
          try {
            if (data.parseError) {
              // Handle unparsed tool result
              addOperation({
                type: 'info',
                status: 'completed',
                message: 'Data processed',
                detail: 'Retrieved information successfully',
              });
            } else if (data.content && data.content.result) {
              const result = data.content.result;
              if (result.keyword) {
                addOperation({
                  type: 'info',
                  status: 'completed',
                  message: `Found keyword data`,
                  detail: `${result.keyword}: volume=${result.volume || 'N/A'}, difficulty=${result.difficulty || 'N/A'}, CPC=$${result.cpc || 'N/A'}`,
                });
              } else {
                addOperation({
                  type: 'info',
                  status: 'completed',
                  message: 'Data processed',
                  detail: 'Retrieved information successfully',
                });
              }
            }
          } catch (e) {
            console.warn('Error handling tool result:', e);
          }
        } else if (data.type === 'd') {
          // Completion or error
          try {
            if (data.parseError) {
              // Handle unparsed completion data
              completeOperation(operationId, 'Response completed');
            } else if (data.content) {
              completeOperation(operationId, 
                data.content.finishReason === 'stop' 
                  ? 'Response completed successfully' 
                  : `Response ended: ${data.content.finishReason}`
              );
            } else {
              completeOperation(operationId, 'Response completed');
            }
          } catch (e) {
            console.warn('Error handling completion data:', e);
            completeOperation(operationId, 'Response completed with errors');
          }
        }
      },
      (error) => {
        // Handle stream error
        console.error('Stream error:', error);
        failOperation(operationId, `Error: ${error.message}`);
        setIsProcessingStream(false);
      },
      () => {
        // Handle stream completion
        if (currentResponse) {
          // Clean the response before adding it to messages
          const cleanedResponse = currentResponse
            .replace(/^"|"$/g, '')  // Remove leading/trailing quotes
            .replace(/\\"/g, '"');   // Replace escaped quotes with regular quotes
          
          setMessages(prev => [
            ...prev, 
            { 
              id: `assistant-${Date.now()}`, 
              role: 'assistant', 
              content: cleanedResponse
            }
          ]);
          setCurrentResponse('');
        }
        setIsProcessingStream(false);
      }
    );
  }, [userInput, isProcessingStream, threadId, addOperation, completeOperation, failOperation, streamProxy, currentResponse]);
  
  // Render loading state while thread is initializing
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-3"></div>
        <p className="text-sm text-gray-600">Initializing assistant...</p>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      <div className="mb-4 flex items-center">
        <FiMessageSquare className="text-blue-500 mr-2 text-xl" />
        <h2 className="text-xl font-semibold">SEO Assistant</h2>
        {streamProxy.isStreaming && (
          <span className="ml-2 text-xs text-blue-500 animate-pulse">
            Processing...
          </span>
        )}
        {streamProxy.error && (
          <span className="ml-2 text-xs text-red-500">
            Error: {streamProxy.error}
          </span>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-sm p-4">
        {/* Messages container */}
        <div className="flex flex-col space-y-4">
          {messages.map((message) => (
            <div 
              key={message.id} 
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div 
                className={`max-w-3/4 p-3 rounded-lg ${
                  message.role === 'user' 
                    ? 'bg-blue-100 text-blue-900' 
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <div className="whitespace-pre-wrap">
                  {message.role === 'assistant' 
                    ? message.content.replace(/\\"/g, '"').replace(/\\"([^"]+)\\"/, '"$1"') 
                    : message.content
                  }
                </div>
              </div>
            </div>
          ))}
          
          {/* Currently streaming response */}
          {currentResponse && (
            <div className="flex justify-start">
              <div className="max-w-3/4 p-3 rounded-lg bg-gray-100 text-gray-900">
                <div className="whitespace-pre-wrap">{currentResponse}</div>
              </div>
            </div>
          )}
          
          {/* Loading indicator */}
          {isProcessingStream && !currentResponse && (
            <div className="flex justify-start">
              <div className="max-w-3/4 p-3 rounded-lg bg-gray-100 text-gray-900">
                <div className="flex space-x-2">
                  <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce delay-100"></div>
                  <div className="h-2 w-2 bg-gray-500 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            </div>
          )}
          
          {/* Invisible div for auto-scrolling */}
          <div ref={messagesEndRef}></div>
        </div>
      </div>
      
      {/* Input form */}
      <form onSubmit={handleSendMessage} className="mt-4 flex">
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Ask about SEO, keywords, or content..."
          className="flex-1 p-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isProcessingStream || !threadId}
        />
        <button
          type="submit"
          className={`px-4 py-2 rounded-r-md flex items-center justify-center ${
            isProcessingStream || !userInput.trim()
              ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
          disabled={isProcessingStream || !userInput.trim() || !threadId}
        >
          <FiSend />
        </button>
      </form>
      
      <div className="mt-2 text-xs text-gray-500 flex items-center">
        <FiFeather className="mr-1" />
        <span>Type a message or ask a question about SEO</span>
      </div>
    </div>
  );
};

export default CustomChatAssistant; 