import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openAI = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Assistant ID
const ASSISTANT_ID = 'asst_JXBmxj6nBTPncEpjwJmtzLTr';

// Set increased function timeout
export const maxDuration = 300; // 5 minutes to allow for complex operations

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Keyword metrics interface
interface KeywordMetrics {
  keyword: string;
  volume: number;
  difficulty: number;
  cpc: number;
  isFallback?: boolean;
  error?: string;
}

// Interface for tool outputs to OpenAI
interface ToolOutput {
  tool_call_id: string;
  output: string;
}

// Checks for any active runs on a thread and cancels them if needed
async function checkForActiveRuns(threadId: string, requestId: string): Promise<void> {
  try {
    console.log(`[${requestId}] Checking for active runs on thread ${threadId}`);
    
    // Get active runs for this thread
    const runsList = await openAI.beta.threads.runs.list(threadId);
    
    // Find runs that are in progress
    const activeRuns = runsList.data.filter(run => 
      ['queued', 'in_progress', 'requires_action'].includes(run.status)
    );
    
    if (activeRuns.length > 0) {
      console.log(`[${requestId}] Found ${activeRuns.length} active runs that need to be cancelled`);
      
      // Cancel each active run
      for (const run of activeRuns) {
        try {
          console.log(`[${requestId}] Cancelling run ${run.id}`);
          await openAI.beta.threads.runs.cancel(threadId, run.id);
          console.log(`[${requestId}] Successfully cancelled run ${run.id}`);
          
          // Wait a moment to ensure the cancellation is processed
          await delay(500);
        } catch (cancelError) {
          console.error(`[${requestId}] Error cancelling run ${run.id}:`, cancelError);
          // Continue with other runs even if one fails
        }
      }
      
      // Wait a bit to make sure OpenAI has processed the cancellations
      await delay(1000);
    } else {
      console.log(`[${requestId}] No active runs found on thread`);
    }
  } catch (error) {
    console.error(`[${requestId}] Error checking for active runs:`, error);
    // Don't throw, just continue with the message creation
  }
}

export async function POST(req: Request) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  console.log(`[${requestId}] Processing chat request`);
  
  try {
    const { messages, threadId } = await req.json();
    
    if (!threadId) {
      return NextResponse.json(
        { error: 'Thread ID is required' },
        { status: 400 }
      );
    }

    // Get the latest user message
    const latestUserMessage = messages[messages.length - 1];
    if (latestUserMessage.role !== 'user') {
      return NextResponse.json(
        { error: 'Latest message must be from a user' },
        { status: 400 }
      );
    }

    // Check for and cancel any active runs before adding new messages
    await checkForActiveRuns(threadId, requestId);

    // Add the message to the thread
    await openAI.beta.threads.messages.create(threadId, {
      role: "user",
      content: latestUserMessage.content
    });

    // Create a run in the thread
    const run = await openAI.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID
    });

    // Create a stream for the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Flag to track if stream is closed
        let isStreamClosed = false;
        
        // Handle stream closure - this is crucial for proper resource cleanup
        const handleStreamClosure = () => {
          if (!isStreamClosed) {
            isStreamClosed = true;
            try {
              controller.close();
              console.log(`[${requestId}] Stream successfully closed`);
            } catch (err) {
              console.log(`[${requestId}] Error closing stream: ${err}`);
            }
          }
        };
        
        // Safe send - checks if stream is still open before sending
        const safeSend = (type: string, content: any) => {
          if (isStreamClosed) {
            console.log(`[${requestId}] Skipping message send - stream already closed`);
            return false;
          }
          
          try {
            const message = `${type}:${JSON.stringify(content)}\n`;
            controller.enqueue(encoder.encode(message));
            return true;
          } catch (err) {
            console.error(`[${requestId}] Error sending message: ${err}`);
            // If we catch an error here, the stream may have been aborted by the client
            isStreamClosed = true;
            return false;
          }
        };
        
        try {
          console.log(`[${requestId}] Starting run processing: ${run.id}`);
          
          // Send initial message ID to start the stream
          safeSend('f', { messageId: `msg-${Date.now()}` });
          
          // Polling setup
          const maxAttempts = 60;
          const pollingInterval = 1000;
          let attempts = 0;
          
          // Initial run status
          let runStatus = await openAI.beta.threads.runs.retrieve(threadId, run.id);
          
          // Poll for completion
          while (!isStreamClosed && 
                 attempts < maxAttempts && 
                 !['completed', 'failed', 'cancelled'].includes(runStatus.status)) {
            
            console.log(`[${requestId}] Run status: ${runStatus.status} (Attempt ${attempts + 1}/${maxAttempts})`);
            attempts++;
            
            // Handle tool calls (function calling)
            if (runStatus.status === 'requires_action' && 
                runStatus.required_action?.type === 'submit_tool_outputs' && 
                !isStreamClosed) {
              
              console.log(`[${requestId}] Processing tool calls...`);
              const toolCalls = runStatus.required_action.submit_tool_outputs.tool_calls;
              
              if (toolCalls && toolCalls.length > 0) {
                const toolOutputs: ToolOutput[] = [];
                
                // Process each tool call
                for (const toolCall of toolCalls) {
                  // Skip if the stream was closed while processing
                  if (isStreamClosed) break;
                  
                  if (toolCall.type === 'function') {
                    try {
                      const fnName = toolCall.function.name;
                      const args = JSON.parse(toolCall.function.arguments || '{}');
                      
                      // Notify client about the tool call
                      safeSend('t', {
                        id: toolCall.id,
                        type: toolCall.type,
                        function: toolCall.function
                      });
                      
                      // Process different tool functions
                      let output: any = null;
                      
                      if (fnName === 'get_keyword_metrics') {
                        output = await processKeywordMetrics(args.keyword, requestId);
                      } 
                      else {
                        output = { error: `Unknown function: ${fnName}` };
                      }
                      
                      // Add to outputs collection
                      if (output) {
                        // Only add to toolOutputs if we can still send to the client
                        // This way we don't collect outputs we can't submit
                        if (!isStreamClosed) {
                          try {
                            // Send result to client first
                            if (safeSend('r', {
                              toolCallId: toolCall.id,
                              result: output
                            })) {
                              // Only add to outputs if sending succeeded
                              toolOutputs.push({
                                tool_call_id: toolCall.id,
                                output: JSON.stringify(output)
                              });
                            }
                          } catch (sendError) {
                            console.error(`[${requestId}] Error sending tool result:`, sendError);
                            // Don't add to outputs if we couldn't send
                          }
                        }
                      }
                    } catch (toolError: any) {
                      console.error(`[${requestId}] Tool processing error:`, toolError);
                      
                      if (!isStreamClosed) {
                        // Create error response
                        const errorOutput = {
                          error: toolError.message || 'Tool processing error'
                        };
                        
                        // Add to outputs collection
                        toolOutputs.push({
                          tool_call_id: toolCall.id,
                          output: JSON.stringify(errorOutput)
                        });
                        
                        // Send to client
                        safeSend('r', {
                          toolCallId: toolCall.id,
                          result: errorOutput
                        });
                      }
                    }
                  }
                }
                
                // Submit collected tool outputs back to OpenAI
                if (toolOutputs.length > 0 && !isStreamClosed) {
                  try {
                    console.log(`[${requestId}] Submitting ${toolOutputs.length} tool outputs to OpenAI`);
                    await openAI.beta.threads.runs.submitToolOutputs(threadId, run.id, {
                      tool_outputs: toolOutputs
                    });
                    console.log(`[${requestId}] Tool outputs submitted successfully`);
                  } catch (submitError: any) {
                    console.error(`[${requestId}] Error submitting tool outputs:`, submitError);
                    
                    // Only try to send error if stream is still open
                    if (!isStreamClosed) {
                      try {
                        safeSend('3', `Error: ${submitError.message || 'Unknown error'}`);
                        safeSend('d', { 
                          finishReason: 'error', 
                          usage: { promptTokens: 0, completionTokens: 0 } 
                        });
                      } catch (finalError) {
                        console.error(`[${requestId}] Error sending final error message:`, finalError);
                      } finally {
                        // Always close the stream after an error
                        handleStreamClosure();
                        return;
                      }
                    }
                  }
                }
              }
            }
            
            // Break the loop if stream closed during processing
            if (isStreamClosed) break;
            
            // Wait before checking again
            await delay(pollingInterval);
            
            // Get updated status
            runStatus = await openAI.beta.threads.runs.retrieve(threadId, run.id);
          }
          
          // Handle completed run
          if (!isStreamClosed && runStatus.status === 'completed') {
            console.log(`[${requestId}] Run completed, fetching messages`);
            
            try {
              // Get latest messages
              const messages = await openAI.beta.threads.messages.list(threadId);
              const assistantMessages = messages.data
                .filter(message => message.role === 'assistant')
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              
              if (assistantMessages.length > 0 && !isStreamClosed) {
                const latestMessage = assistantMessages[0];
                
                // Stream content
                for (const part of latestMessage.content) {
                  if (part.type === 'text' && !isStreamClosed) {
                    // Stream in small chunks for a typing effect
                    const text = part.text.value;
                    const chunkSize = 3;
                    
                    for (let i = 0; i < text.length && !isStreamClosed; i += chunkSize) {
                      const chunk = text.slice(i, i + chunkSize);
                      safeSend('0', chunk);
                      await delay(10);
                    }
                  }
                }
                
                // Send completion if stream still open
                if (!isStreamClosed) {
                  safeSend('d', { 
                    finishReason: 'stop', 
                    usage: { promptTokens: 0, completionTokens: 0 } 
                  });
                }
              } else if (!isStreamClosed) {
                safeSend('3', 'No assistant response found');
                safeSend('d', { 
                  finishReason: 'error', 
                  usage: { promptTokens: 0, completionTokens: 0 } 
                });
              }
            } catch (messageError: any) {
              console.error(`[${requestId}] Error processing message:`, messageError);
              
              // Only attempt to send error if stream is still open
              if (!isStreamClosed) {
                try {
                  safeSend('3', `An error occurred: ${messageError.message || 'Unknown error'}`);
                  safeSend('d', { 
                    finishReason: 'error', 
                    usage: { promptTokens: 0, completionTokens: 0 } 
                  });
                } catch (finalError) {
                  console.error(`[${requestId}] Error sending final error message:`, finalError);
                }
              }
            } finally {
              // Always ensure we close the stream when we're done
              handleStreamClosure();
            }
          } else if (!isStreamClosed) {
            // Handle non-completed status
            const reason = runStatus.status === 'failed' 
              ? `Run failed: ${runStatus.last_error?.message || 'Unknown error'}`
              : `Run ended with status: ${runStatus.status}`;
            
            console.log(`[${requestId}] ${reason}`);
            
            safeSend('3', reason);
            safeSend('d', { 
              finishReason: 'error', 
              usage: { promptTokens: 0, completionTokens: 0 } 
            });
          }
        } catch (error: any) {
          console.error(`[${requestId}] Run processing error:`, error);
          
          // Only attempt to send error if stream is still open
          if (!isStreamClosed) {
            try {
              safeSend('3', `An error occurred during processing: ${error.message || 'Unknown error'}`);
              safeSend('d', { 
                finishReason: 'error', 
                usage: { promptTokens: 0, completionTokens: 0 } 
              });
            } catch (finalError) {
              console.error(`[${requestId}] Error sending final error message:`, finalError);
            } finally {
              handleStreamClosure();
            }
          }
        }
      }
    });
    
    return new Response(stream);
    
  } catch (error: any) {
    console.error(`[${requestId}] Request processing error:`, error);
    return NextResponse.json(
      { error: "An error occurred during processing" },
      { status: 500 }
    );
  }
}

// Function to process keyword metrics
async function processKeywordMetrics(keyword: string, requestId: string): Promise<KeywordMetrics> {
  console.log(`[${requestId}] Processing keyword metrics for "${keyword}"`);
  
  try {
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.NEXT_PUBLIC_API_BASE_URL || 'https://similarweb-content-seo.netlify.app'  
      : `http://localhost:${process.env.PORT || 3000}`;
    
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
} 