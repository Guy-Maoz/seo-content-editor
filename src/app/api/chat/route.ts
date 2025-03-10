import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Set a longer timeout for OpenAI API calls
const API_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Create OpenAI client
const openAI = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: API_TIMEOUT
});

// Utility function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Type definitions
interface KeywordMetrics {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
  isFallback?: boolean;
  error?: string;
}

interface StreamChunk {
  type: string;
  content: any;
}

interface ToolOutput {
  tool_call_id: string;
  output: string;
}

// Check for active runs to avoid race conditions
async function checkForActiveRuns(threadId: string, requestId: string): Promise<void> {
  let attempts = 0;
  const maxAttempts = 30;
  const waitTime = 1000;
  
  while (attempts < maxAttempts) {
    try {
      const runs = await openAI.beta.threads.runs.list(threadId);
      const activeRuns = runs.data.filter(run => 
        ['queued', 'in_progress', 'requires_action'].includes(run.status)
      );
      
      if (activeRuns.length === 0) {
        console.log(`[${requestId}] No active runs found on thread`);
        return;
      }
      
      console.log(`[${requestId}] Thread has ${activeRuns.length} active runs, waiting...`);
      await delay(waitTime);
      attempts++;
    } catch (error) {
      console.error(`[${requestId}] Error checking for active runs:`, error);
      throw error;
    }
  }
  
  throw new Error(`Thread has active runs after ${maxAttempts} attempts`);
}

// Main API handler
export async function POST(req: Request) {
  // Generate a unique ID for this request for logging
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  console.log(`[${requestId}] Processing chat request`);
  
  try {
    // Parse request body
    const { messages, threadId: clientThreadId } = await req.json();
    
    // Thread ID management (use client-provided ID or create one)
    let threadId = clientThreadId;
    
    if (!threadId) {
      const thread = await openAI.beta.threads.create();
      threadId = thread.id;
    }
    
    // Check for any active runs to avoid conflicts
    try {
      await checkForActiveRuns(threadId, requestId);
    } catch (error) {
      return NextResponse.json(
        { error: "Thread has active runs. Try again later." },
        { status: 409 }
      );
    }
    
    // Add messages to thread
    for (const message of messages) {
      if (message.role === 'user') {
        await openAI.beta.threads.messages.create(threadId, {
          role: 'user',
          content: message.content
        });
      }
    }
    
    // Function to process keyword metrics
    const processKeywordMetrics = async (keyword: string): Promise<KeywordMetrics> => {
      console.log(`[${requestId}] Processing keyword metrics for "${keyword}"`);
      
      try {
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? process.env.NEXT_PUBLIC_API_BASE_URL || 'https://similarweb-content-seo.netlify.app'  
          : `http://localhost:${process.env.PORT || 3001}`;
        
        // Call keyword metrics API
        const response = await fetch(`${baseUrl}/api/tools/keyword-metrics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword })
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`[${requestId}] Got metrics for "${keyword}":`, data);
          return data;
        } else {
          // Handle API error
          const errorText = await response.text();
          console.error(`[${requestId}] API error:`, errorText);
          return {
            keyword,
            volume: 0,
            difficulty: 0,
            cpc: 0,
            isFallback: true,
            error: `API returned status ${response.status}`
          };
        }
      } catch (error: any) {
        // Handle network error
        console.error(`[${requestId}] Network error:`, error);
        return {
          keyword,
          volume: Math.floor(Math.random() * 10000),  // Fallback random data
          difficulty: Math.floor(Math.random() * 100),
          cpc: parseFloat((Math.random() * 5).toFixed(2)),
          isFallback: true,
          error: error.message || 'Network error'
        };
      }
    };
    
    // Start run
    const run = await openAI.beta.threads.runs.create(threadId, {
      assistant_id: 'asst_JXBmxj6nBTPncEpjwJmtzLTr',
    });
    console.log(`[${requestId}] Starting run processing: ${run.id}`);
    
    // Set up stream components
    const encoder = new TextEncoder();
    const streamController = new TransformStream();
    
    // Create a safe writer wrapper with closure tracking
    let writerClosed = false;
    const writer = streamController.writable.getWriter();
    
    // Queue of messages to send
    const messageQueue: StreamChunk[] = [];
    
    // Add initial message
    messageQueue.push({
      type: 'f',
      content: { messageId: `msg-${Date.now()}` }
    });
    
    // Function to safely send messages through the stream
    const sendMessage = async (type: string, content: any) => {
      if (writerClosed) {
        console.log(`[${requestId}] Skipping send - writer is already closed`);
        return false;
      }
      
      try {
        const message = `${type}:${JSON.stringify(content)}\n`;
        await writer.write(encoder.encode(message));
        return true;
      } catch (error) {
        console.error(`[${requestId}] Error writing message type ${type}:`, error);
        writerClosed = true;
        return false;
      }
    };
    
    // Safe close function that won't throw if already closed
    const safeCloseWriter = async () => {
      if (writerClosed) {
        console.log(`[${requestId}] Writer already marked as closed, skipping close operation`);
        return;
      }
      
      writerClosed = true;
      try {
        // Use a timeout to ensure we don't hang if close is stuck
        const closePromise = writer.close();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Close operation timed out')), 2000)
        );
        
        await Promise.race([closePromise, timeoutPromise]).catch(err => {
          console.log(`[${requestId}] Controlled writer close error:`, err.message);
        });
        
        console.log(`[${requestId}] Stream closed successfully`);
      } catch (closeError) {
        console.log(`[${requestId}] Expected close error (already handled):`, closeError);
      }
    };
    
    // Process the run in the background
    (async () => {
      let shouldCancel = false;
      
      // Set up handler for client disconnection
      try {
        req.signal.addEventListener('abort', () => {
          console.log(`[${requestId}] Client disconnected, aborting run processing`);
          shouldCancel = true;
          writerClosed = true;  // Mark writer as closed on disconnect
          
          // Cancel the run to prevent wasted resources
          try {
            openAI.beta.threads.runs.cancel(threadId, run.id)
              .then(() => console.log(`[${requestId}] Run cancelled successfully`))
              .catch(err => console.error(`[${requestId}] Failed to cancel run:`, err));
          } catch (cancelError) {
            console.error(`[${requestId}] Error during run cancellation:`, cancelError);
          }
        });
      } catch (signalError) {
        console.error(`[${requestId}] Error setting up abort signal listener:`, signalError);
      }
      
      try {
        // Send initial metadata
        if (!await sendMessage('f', { messageId: `msg-${Date.now()}` })) {
          console.log(`[${requestId}] Failed to send initial message, stream likely closed`);
          return;
        }
        
        // Poll for run status
        let status = await openAI.beta.threads.runs.retrieve(threadId, run.id);
        let attempts = 0;
        const maxAttempts = 60;
        
        while (['queued', 'in_progress', 'requires_action'].includes(status.status) && 
               attempts < maxAttempts && 
               !shouldCancel && !writerClosed) {
          console.log(`[${requestId}] Run status: ${status.status} (Attempt ${attempts + 1}/${maxAttempts})`);
          
          // Handle tool calls
          if (status.status === 'requires_action') {
            console.log(`[${requestId}] Processing tool calls...`);
            
            if (status.required_action?.type === 'submit_tool_outputs' && !shouldCancel && !writerClosed) {
              const toolOutputs: ToolOutput[] = [];
              
              // Process each tool call
              for (const toolCall of status.required_action.submit_tool_outputs.tool_calls) {
                // Stop processing if client disconnected or stream is closed
                if (shouldCancel || writerClosed) {
                  console.log(`[${requestId}] Skipping tool call processing due to ${shouldCancel ? 'client disconnection' : 'closed stream'}`);
                  break;
                }
                
                try {
                  const fnName = toolCall.function.name;
                  const args = JSON.parse(toolCall.function.arguments);
                  
                  // Notify client about the tool call
                  await sendMessage('t', {
                    id: toolCall.id,
                    type: toolCall.type,
                    function: toolCall.function
                  });
                  
                  let output: any = null;
                  
                  if (fnName === 'get_keyword_metrics') {
                    output = await processKeywordMetrics(args.keyword);
                  } else {
                    output = { error: `Unknown function: ${fnName}` };
                  }
                  
                  // Send result to client
                  const sendSuccess = await sendMessage('r', {
                    toolCallId: toolCall.id,
                    result: output
                  });
                  
                  // Only add to toolOutputs if sending succeeded
                  if (sendSuccess && output) {
                    toolOutputs.push({
                      tool_call_id: toolCall.id,
                      output: JSON.stringify(output)
                    });
                  }
                } catch (toolError: any) {
                  console.error(`[${requestId}] Tool processing error:`, toolError);
                  const errorOutput = {
                    error: toolError.message || 'Tool processing error'
                  };
                  
                  // Try to send error to client
                  try {
                    await sendMessage('r', {
                      toolCallId: toolCall.id,
                      result: errorOutput
                    });
                  } catch (sendError) {
                    console.error(`[${requestId}] Error sending tool error:`, sendError);
                  }
                  
                  // Add error to toolOutputs
                  toolOutputs.push({
                    tool_call_id: toolCall.id,
                    output: JSON.stringify(errorOutput)
                  });
                }
              }
              
              // Submit tool outputs to OpenAI
              if (toolOutputs.length > 0 && !shouldCancel && !writerClosed) {
                try {
                  console.log(`[${requestId}] Submitting ${toolOutputs.length} tool outputs to OpenAI`);
                  status = await openAI.beta.threads.runs.submitToolOutputs(threadId, run.id, {
                    tool_outputs: toolOutputs
                  });
                  console.log(`[${requestId}] Tool outputs submitted successfully`);
                  
                  // Reset attempts for continued polling
                  attempts = 0;
                  await delay(1000);
                  continue;
                } catch (submitError: any) {
                  console.error(`[${requestId}] Error submitting tool outputs:`, submitError);
                  await sendMessage('3', `Error submitting tool outputs: ${submitError.message || 'Unknown error'}`);
                  await sendMessage('d', { 
                    finishReason: 'error', 
                    usage: { promptTokens: 0, completionTokens: 0 } 
                  });
                  await safeCloseWriter();
                  return;
                }
              }
            }
          }
          
          // Wait before polling again
          await delay(1000);
          attempts++;
          
          // Don't continue polling if client disconnected or stream is closed
          if (shouldCancel || writerClosed) {
            console.log(`[${requestId}] Stopping polling due to ${shouldCancel ? 'client disconnection' : 'closed stream'}`);
            break;
          }
          
          // Get updated status
          try {
            status = await openAI.beta.threads.runs.retrieve(threadId, run.id);
          } catch (pollError: any) {
            console.error(`[${requestId}] Error polling run status:`, pollError);
            try {
              await sendMessage('3', `Error polling run status: ${pollError.message || 'Unknown error'}`);
              await sendMessage('d', { 
                finishReason: 'error', 
                usage: { promptTokens: 0, completionTokens: 0 } 
              });
            } catch (finalError) {
              console.error(`[${requestId}] Error sending final error:`, finalError);
            }
            await safeCloseWriter();
            return;
          }
        }
        
        // Handle completion
        if (status.status === 'completed') {
          console.log(`[${requestId}] Run completed, fetching messages`);
          
          if (!shouldCancel && !writerClosed) {
            try {
              // Get latest messages
              const messages = await openAI.beta.threads.messages.list(threadId);
              const assistantMessages = messages.data
                .filter(message => message.role === 'assistant')
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              
              if (assistantMessages.length > 0 && !shouldCancel && !writerClosed) {
                const latestMessage = assistantMessages[0];
                
                // Stream content
                for (const part of latestMessage.content) {
                  if (shouldCancel || writerClosed) break;
                  
                  if (part.type === 'text') {
                    // Stream in small chunks for a typing effect
                    const text = part.text.value;
                    const chunkSize = 3;
                    
                    for (let i = 0; i < text.length && !shouldCancel && !writerClosed; i += chunkSize) {
                      const chunk = text.slice(i, i + chunkSize);
                      await sendMessage('0', chunk);
                      await delay(10);
                    }
                  }
                }
                
                // Send completion if not cancelled
                if (!shouldCancel && !writerClosed) {
                  await sendMessage('d', { 
                    finishReason: 'stop', 
                    usage: { promptTokens: 0, completionTokens: 0 } 
                  });
                }
              } else if (!shouldCancel && !writerClosed) {
                await sendMessage('3', 'No assistant response found');
                await sendMessage('d', { 
                  finishReason: 'error', 
                  usage: { promptTokens: 0, completionTokens: 0 } 
                });
              }
            } catch (messageError: any) {
              console.error(`[${requestId}] Error fetching messages:`, messageError);
              try {
                await sendMessage('3', `Error fetching messages: ${messageError.message || 'Unknown error'}`);
                await sendMessage('d', { 
                  finishReason: 'error', 
                  usage: { promptTokens: 0, completionTokens: 0 } 
                });
              } catch (finalError) {
                console.error(`[${requestId}] Error sending final error:`, finalError);
              }
              await safeCloseWriter();
            }
          }
        } else {
          // Handle non-completed status
          const reason = status.status === 'failed' 
            ? `Run failed: ${status.last_error?.message || 'Unknown error'}`
            : `Run ended with status: ${status.status}`;
          
          console.log(`[${requestId}] ${reason}`);
          
          try {
            await sendMessage('3', reason);
            await sendMessage('d', { 
              finishReason: 'error', 
              usage: { promptTokens: 0, completionTokens: 0 } 
            });
          } catch (finalError) {
            console.error(`[${requestId}] Error sending final error:`, finalError);
          }
        }
      } catch (error: any) {
        console.error(`[${requestId}] Processing error:`, error);
        try {
          await sendMessage('3', `Error: ${error.message || 'Unknown error'}`);
          await sendMessage('d', { 
            finishReason: 'error', 
            usage: { promptTokens: 0, completionTokens: 0 } 
          });
        } catch (finalError) {
          console.error(`[${requestId}] Error sending final error:`, finalError);
        }
        await safeCloseWriter();
      }
    })().catch((backgroundError) => {
      console.error(`[${requestId}] Unhandled error in async process:`, backgroundError);
      // Don't try to close here, let the finally block handle it
    });
    
    // Return the readable stream
    return new Response(streamController.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });
    
  } catch (error: any) {
    console.error(`[${requestId}] Request processing error:`, error);
    return NextResponse.json(
      { error: "An error occurred during processing" },
      { status: 500 }
    );
  }
} 