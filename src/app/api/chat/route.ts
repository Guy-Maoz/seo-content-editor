import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Set a longer timeout for this API route
export const maxDuration = 300; // 5 minutes

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

// Type for OpenAI Run status
type RunStatus = 'queued' | 'in_progress' | 'requires_action' | 'completed' | 'failed' | 'cancelled' | 'expired';

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
    let shouldCancel = false;
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
      if (writerClosed || shouldCancel) {
        console.log(`[${requestId}] Skipping send - writer is ${writerClosed ? 'closed' : 'cancelling'}`);
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
    
    // Cancel run function to avoid duplicating code
    const cancelRun = async () => {
      if (shouldCancel) return; // Avoid duplicate cancellations
      
      shouldCancel = true;
      console.log(`[${requestId}] Cancelling run ${run.id}`);
      
      try {
        // Check run status before attempting to cancel
        try {
          const runDetails = await openAI.beta.threads.runs.retrieve(threadId, run.id);
          
          // Only attempt to cancel if the run is in a cancellable state
          if (['queued', 'in_progress', 'requires_action'].includes(runDetails.status)) {
            await openAI.beta.threads.runs.cancel(threadId, run.id);
            console.log(`[${requestId}] Run cancelled successfully`);
          } else {
            console.log(`[${requestId}] Skipping cancellation for run in '${runDetails.status}' state`);
          }
        } catch (checkError) {
          // If we can't retrieve the run, attempt to cancel anyway
          console.log(`[${requestId}] Couldn't check run status, attempting cancellation:`, checkError);
          await openAI.beta.threads.runs.cancel(threadId, run.id);
        }
      } catch (cancelError) {
        console.error(`[${requestId}] Failed to cancel run:`, cancelError);
      }
    };
    
    // Process the run in the background
    (async () => {
      let shouldCancel = false;
      
      // Set up handler for client disconnection
      try {
        req.signal.addEventListener('abort', async () => {
          console.log(`[${requestId}] Client disconnected, aborting run processing`);
          // Mark flags first to prevent any new operations
          writerClosed = true;
          shouldCancel = true;
          
          // Cancel the run first, then close the writer
          await cancelRun();
          await safeCloseWriter();
        });
      } catch (signalError) {
        console.error(`[${requestId}] Error setting up abort signal listener:`, signalError);
      }
      
      // Track run status outside the try block for use in finally
      let runStatus: any = null;
      
      try {
        // Send initial metadata
        if (!await sendMessage('f', { messageId: `msg-${Date.now()}` })) {
          console.log(`[${requestId}] Failed to send initial message, stream likely closed`);
          return;
        }
        
        // Poll for run status
        let status = await openAI.beta.threads.runs.retrieve(threadId, run.id);
        runStatus = status; // Store for finally block
        
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
                  if (!await sendMessage('t', {
                    id: toolCall.id,
                    type: toolCall.type,
                    function: toolCall.function
                  })) {
                    console.log(`[${requestId}] Failed to send tool call notification, aborting processing`);
                    await cancelRun();
                    break;
                  }
                  
                  let output: any = null;
                  
                  if (fnName === 'get_keyword_metrics') {
                    // Check again before making expensive API calls
                    if (shouldCancel || writerClosed) {
                      console.log(`[${requestId}] Cancelling keyword metrics due to client disconnection`);
                      break;
                    }
                    output = await processKeywordMetrics(args.keyword);
                  } else {
                    output = { error: `Unknown function: ${fnName}` };
                  }
                  
                  // Check again before sending results - client might have disconnected during API call
                  if (shouldCancel || writerClosed) {
                    console.log(`[${requestId}] Client disconnected during tool processing, cancelling`);
                    await cancelRun();
                    break;
                  }
                  
                  // Send result to client
                  const sendSuccess = await sendMessage('r', {
                    toolCallId: toolCall.id,
                    result: output
                  });
                  
                  // Only add to toolOutputs if sending succeeded and we're still connected
                  if (sendSuccess && output && !shouldCancel && !writerClosed) {
                    toolOutputs.push({
                      tool_call_id: toolCall.id,
                      output: JSON.stringify(output)
                    });
                  }
                } catch (toolError: any) {
                  // Check if we should continue processing errors
                  if (shouldCancel || writerClosed) {
                    console.log(`[${requestId}] Skipping error handling due to client disconnection`);
                    break;
                  }
                  
                  console.error(`[${requestId}] Tool processing error:`, toolError);
                  const errorOutput = {
                    error: toolError.message || 'Tool processing error'
                  };
                  
                  // Try to send error to client
                  const sendSuccess = await sendMessage('r', {
                    toolCallId: toolCall.id,
                    result: errorOutput
                  });
                  
                  // Add error to toolOutputs only if we're still connected
                  if (sendSuccess && !shouldCancel && !writerClosed) {
                    toolOutputs.push({
                      tool_call_id: toolCall.id,
                      output: JSON.stringify(errorOutput)
                    });
                  }
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
                  // Check if we're still connected before handling errors
                  if (shouldCancel || writerClosed) {
                    console.log(`[${requestId}] Client disconnected during tool output submission`);
                    await cancelRun();
                    return;
                  }
                  
                  console.error(`[${requestId}] Error submitting tool outputs:`, submitError);
                  await sendMessage('3', `Error submitting tool outputs: ${submitError.message || 'Unknown error'}`);
                  await sendMessage('d', { 
                    finishReason: 'error', 
                    usage: { promptTokens: 0, completionTokens: 0 } 
                  });
                  await safeCloseWriter();
                  return;
                }
              } else if (shouldCancel || writerClosed) {
                // If we have no tool outputs due to disconnection, cancel the run
                console.log(`[${requestId}] No tool outputs to submit due to client disconnection`);
                await cancelRun();
                return;
              }
            }
          }
          
          // Wait before polling again
          await delay(1000);
          attempts++;
          
          // Don't continue polling if client disconnected or stream is closed
          if (shouldCancel || writerClosed) {
            console.log(`[${requestId}] Stopping polling due to client disconnection or closed stream`);
            await cancelRun();
            break;
          }
          
          // Get updated status
          try {
            status = await openAI.beta.threads.runs.retrieve(threadId, run.id);
          } catch (pollError: any) {
            // Check if disconnected before handling error
            if (shouldCancel || writerClosed) {
              console.log(`[${requestId}] Client disconnected during status polling`);
              return;
            }
            
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
        
        // Final status check
        console.log(`[${requestId}] Final run status: ${status.status}`);
        
        // Explicitly cancel any incomplete runs before we finish processing
        if (['queued', 'in_progress', 'requires_action'].includes(status.status) && !shouldCancel) {
          console.log(`[${requestId}] Cancelling incomplete run before closing stream`);
          await cancelRun();
        }
        
        // Handle completion
        if (status.status === 'completed' && !shouldCancel && !writerClosed) {
          console.log(`[${requestId}] Run completed, fetching messages`);
          
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
                if (shouldCancel || writerClosed) {
                  console.log(`[${requestId}] Stopping content streaming due to client disconnection`);
                  break;
                }
                
                if (part.type === 'text') {
                  // Stream in small chunks for a typing effect
                  const text = part.text.value;
                  const chunkSize = 3;
                  
                  for (let i = 0; i < text.length; i += chunkSize) {
                    // Check before each chunk if we should continue
                    if (shouldCancel || writerClosed) {
                      console.log(`[${requestId}] Stopping mid-chunk due to client disconnection`);
                      break;
                    }
                    
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
            // Check if we're still connected before handling errors
            if (shouldCancel || writerClosed) {
              console.log(`[${requestId}] Client disconnected during message fetching`);
              return;
            }
            
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
          }
        } else if (!shouldCancel && !writerClosed) {
          // Handle non-completed status
          const reason = status.status === 'failed' 
            ? `Run failed: ${status.last_error?.message || 'Unknown error'}`
            : `Run ended with status: ${status.status}`;
          
          console.log(`[${requestId}] ${reason}`);
          
          await sendMessage('3', reason);
          await sendMessage('d', { 
            finishReason: 'error', 
            usage: { promptTokens: 0, completionTokens: 0 } 
          });
        }
      } catch (error: any) {
        // Final check before handling the error
        if (shouldCancel || writerClosed) {
          console.log(`[${requestId}] Client disconnected during processing, skipping error handling`);
          return;
        }
        
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
      } finally {
        // Always ensure we close the writer
        if (!writerClosed) {
          await safeCloseWriter();
        }
        
        // Don't try to cancel runs that are already in a terminal state
        if (!shouldCancel && runStatus && 
            ['queued', 'in_progress', 'requires_action'].includes(runStatus.status)) {
          await cancelRun();
        }
      }
    })().catch((backgroundError) => {
      console.error(`[${requestId}] Unhandled error in async process:`, backgroundError);
      // Error is already handled by the async function's try/catch/finally
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