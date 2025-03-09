import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openAI = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Assistant ID
const ASSISTANT_ID = 'asst_JXBmxj6nBTPncEpjwJmtzLTr';

// Set increased function timeout
export const maxDuration = 60; // Set maximum duration to 60 seconds

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
  
  try {
    console.log(`[${requestId}] Processing chat request`);
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

    // Set up streaming response
    const encoder = new TextEncoder();
    
    const stream = new ReadableStream({
      async start(controller) {
        // Create a unique request ID to track this processing
        const processingId = `proc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        console.log(`[${requestId}] Starting stream processing ${processingId}`);
        
        // Flag to track if controller has been closed
        let isClosed = false;
        
        // Function to check if controller can be used
        const canUseController = () => !isClosed;
        
        // Function to safely send a message
        const sendMessage = (type: string, content: any) => {
          if (!canUseController()) {
            console.log(`[${requestId}:${processingId}] Skipping message ${type} - controller already closed`);
            return;
          }
          
          try {
            const message = `${type}:${JSON.stringify(content)}\n`;
            controller.enqueue(encoder.encode(message));
          } catch (err) {
            console.error(`[${requestId}:${processingId}] Error sending message type ${type}:`, err);
            isClosed = true;
          }
        };
        
        // Function to safely close the controller
        const closeController = () => {
          if (canUseController()) {
            try {
              console.log(`[${requestId}:${processingId}] Closing controller gracefully`);
              controller.close();
              isClosed = true;
            } catch (err) {
              console.error(`[${requestId}:${processingId}] Error closing controller:`, err);
              isClosed = true;
            }
          } else {
            console.log(`[${requestId}:${processingId}] Controller already closed, skipping close`);
          }
        };
        
        try {
          console.log(`[${requestId}] Processing run ${run.id} for thread ${threadId}`);
          
          // Send initial message ID
          sendMessage('f', { messageId: `msg-${Date.now()}` });
          
          // Poll for run completion
          const maxAttempts = 60;
          const interval = 1000;
          let attempts = 0;
          let runStatus = await openAI.beta.threads.runs.retrieve(threadId, run.id);
          
          while (attempts < maxAttempts && 
                 runStatus.status !== 'completed' && 
                 runStatus.status !== 'failed' && 
                 runStatus.status !== 'cancelled' && 
                 canUseController()) {
            
            console.log(`Run status: ${runStatus.status} (Attempt ${attempts + 1}/${maxAttempts})`);
            attempts++;
            
            // Handle tool calls
            if (runStatus.status === 'requires_action') {
              console.log("Processing tool calls...");
              
              const toolCalls = runStatus.required_action?.submit_tool_outputs?.tool_calls;
              if (toolCalls && toolCalls.length > 0) {
                const toolOutputs: { tool_call_id: string; output: string }[] = [];
                
                for (const toolCall of toolCalls) {
                  if (!canUseController()) break;
                  
                  if (toolCall.type === 'function') {
                    // Send notification about tool call
                    sendMessage('t', {
                      id: toolCall.id,
                      type: toolCall.type,
                      function: toolCall.function
                    });
                    
                    try {
                      const args = JSON.parse(toolCall.function.arguments || '{}');
                      let output: KeywordMetrics | { error: string } | null = null;
                      
                      // Process tool call based on function name
                      if (toolCall.function.name === 'get_keyword_metrics') {
                        const baseUrl = process.env.NODE_ENV === 'production' 
                          ? process.env.NEXT_PUBLIC_API_BASE_URL || 'https://similarweb-content-seo.netlify.app'  
                          : `http://localhost:${process.env.PORT || 3000}`;
                        
                        console.log(`[${requestId}] Calling keyword metrics API for keyword: "${args.keyword}"`);
                        
                        try {
                          // Before making the API call, check if controller is still usable
                          if (!canUseController()) {
                            console.log(`[${requestId}:${processingId}] Skipping API call - controller already closed`);
                            continue; // Use continue instead of break to move to next tool call
                          }
                          
                          // Create a local copy of the API response
                          let apiResponse: Response | null = null;
                          let responseData = null;
                          
                          try {
                            console.log(`[${requestId}:${processingId}] Starting API call to keyword metrics`);
                            apiResponse = await fetch(`${baseUrl}/api/tools/keyword-metrics`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ keyword: args.keyword })
                            });
                            
                            if (apiResponse && apiResponse.ok) {
                              responseData = await apiResponse.json();
                              console.log(`[${requestId}:${processingId}] Got metrics for "${args.keyword}":`, responseData);
                              output = responseData;
                            } else if (apiResponse) {
                              console.error(`[${requestId}:${processingId}] API error: ${apiResponse.status} ${apiResponse.statusText}`);
                              output = { 
                                keyword: args.keyword,
                                volume: 1000, 
                                difficulty: 50,
                                cpc: 0.5,
                                isFallback: true,
                                error: `API error: ${apiResponse.status}`
                              };
                            }
                          } catch (fetchError) {
                            console.error(`[${requestId}:${processingId}] Fetch error:`, fetchError);
                            output = { 
                              keyword: args.keyword,
                              volume: 1000, 
                              difficulty: 50,
                              cpc: 0.5,
                              isFallback: true,
                              error: fetchError instanceof Error ? fetchError.message : 'Unknown fetch error'
                            };
                          }
                        } catch (apiError: any) {
                          console.error(`[${requestId}] API call failed for keyword "${args.keyword}":`, apiError);
                          
                          // Check controller state before creating fallback output
                          if (!canUseController()) {
                            console.log(`[${requestId}] Skipping fallback output - controller closed`);
                            break;
                          }
                          
                          output = { 
                            keyword: args.keyword,
                            volume: 1000, 
                            difficulty: 50,
                            cpc: 0.5,
                            isFallback: true,
                            error: apiError.message || 'Unknown API error'
                          };
                        }
                      }
                      // Add other function handlers as needed (generate_keywords, etc.)
                      else {
                        if (!canUseController()) {
                          console.log(`[${requestId}] Skipping unknown function handling - controller closed`);
                          break;
                        }
                        output = { error: `Unknown function: ${toolCall.function.name}` };
                      }
                      
                      // Save output for submission to OpenAI
                      if (output) {
                        // First check if controller is still usable before trying to save output
                        if (!canUseController()) {
                          console.log(`[${requestId}:${processingId}] Skipping tool output - controller already closed`);
                          continue; // Skip to next tool call but keep the array intact
                        }

                        // Add tool output for submission to OpenAI
                        try {
                          toolOutputs.push({
                            tool_call_id: toolCall.id,
                            output: JSON.stringify(output)
                          });
                          
                          console.log(`[${requestId}:${processingId}] Added tool output to submission queue`);
                          
                          // Check controller again before sending result to client
                          if (canUseController()) {
                            // Send result to client
                            console.log(`[${requestId}:${processingId}] Sending tool result for ${toolCall.function.name}`);
                            sendMessage('r', {
                              toolCallId: toolCall.id,
                              result: output
                            });
                          } else {
                            console.log(`[${requestId}:${processingId}] Skipped sending result - controller closed`);
                          }
                        } catch (outputError) {
                          console.error(`[${requestId}:${processingId}] Error processing tool output:`, outputError);
                        }
                      }
                    } catch (toolError: any) {
                      console.error(`[${requestId}] Error processing tool call ${toolCall.function.name}:`, toolError);
                      
                      // Check controller state before processing error
                      if (!canUseController()) {
                        console.log(`[${requestId}] Skipping error handling - controller closed`);
                        continue;
                      }
                      
                      // Add error output
                      const errorOutput = {
                        error: toolError.message || 'Unknown tool error'
                      };
                      
                      // Check controller again before adding to outputs
                      if (canUseController()) {
                        toolOutputs.push({
                          tool_call_id: toolCall.id,
                          output: JSON.stringify(errorOutput)
                        });
                        
                        // Send error result to client
                        sendMessage('r', {
                          toolCallId: toolCall.id,
                          result: errorOutput
                        });
                      }
                    }
                  }
                }
                
                // Submit tool outputs to OpenAI
                if (toolOutputs.length > 0) {
                  try {
                    console.log(`[${requestId}:${processingId}] Submitting ${toolOutputs.length} tool outputs to OpenAI`);
                    
                    // The controller might be closed but we can still try to submit the outputs to OpenAI
                    await openAI.beta.threads.runs.submitToolOutputs(threadId, run.id, {
                      tool_outputs: toolOutputs
                    });
                    
                    console.log(`[${requestId}:${processingId}] Tool outputs submitted successfully`);
                  } catch (submitError) {
                    console.error(`[${requestId}:${processingId}] Error submitting tool outputs:`, submitError);
                    
                    // If we can't submit tool outputs, the assistant can't continue
                    if (canUseController()) {
                      sendMessage('3', `Error submitting tool outputs: ${submitError instanceof Error ? submitError.message : 'Unknown error'}`);
                      sendMessage('d', { 
                        finishReason: 'error', 
                        usage: { promptTokens: 0, completionTokens: 0 } 
                      });
                      
                      // We need to close the controller after sending the error
                      closeController();
                      
                      // Skip the rest of the processing
                      return;
                    }
                  }
                }
              }
            }
            
            // Wait before checking again
            await delay(interval);
            
            // Update run status
            if (canUseController()) {
              try {
                runStatus = await openAI.beta.threads.runs.retrieve(threadId, run.id);
              } catch (retrieveError) {
                console.error(`[${requestId}] Error retrieving run status:`, retrieveError);
                break; // Exit the polling loop on errors
              }
            } else {
              console.log(`[${requestId}] Stopping poll loop - controller closed`);
              break;
            }
          }
          
          // Process completed run
          if (canUseController()) {
            if (runStatus.status === 'completed') {
              console.log(`[${requestId}] Run completed, fetching messages`);
              
              try {
                // Get latest messages
                const messages = await openAI.beta.threads.messages.list(threadId);
                const assistantMessages = messages.data
                  .filter(message => message.role === 'assistant')
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                
                if (assistantMessages.length > 0 && canUseController()) {
                  const latestMessage = assistantMessages[0];
                  
                  // Stream message content
                  for (const part of latestMessage.content) {
                    if (part.type === 'text' && canUseController()) {
                      // Stream text in small chunks for realistic effect
                      const text = part.text.value;
                      const chunkSize = 3;
                      
                      for (let i = 0; i < text.length && canUseController(); i += chunkSize) {
                        const chunk = text.slice(i, i + chunkSize);
                        sendMessage('0', chunk);
                        await delay(10);
                      }
                    }
                  }
                  
                  if (canUseController()) {
                    // Send completion message
                    sendMessage('d', { 
                      finishReason: 'stop', 
                      usage: { promptTokens: 0, completionTokens: 0 } 
                    });
                  }
                } else if (canUseController()) {
                  console.log(`[${requestId}] No assistant messages found`);
                  sendMessage('3', 'No assistant response found');
                  sendMessage('d', { 
                    finishReason: 'error', 
                    usage: { promptTokens: 0, completionTokens: 0 } 
                  });
                }
              } catch (messageError: any) {
                console.error(`[${requestId}] Error fetching messages:`, messageError);
                if (canUseController()) {
                  sendMessage('3', `Error fetching messages: ${messageError.message || 'Unknown error'}`);
                  sendMessage('d', { 
                    finishReason: 'error', 
                    usage: { promptTokens: 0, completionTokens: 0 } 
                  });
                }
              }
            } else {
              console.log(`[${requestId}] Run ended with status: ${runStatus.status}`);
              if (canUseController()) {
                sendMessage('3', `Run ended with status: ${runStatus.status}`);
                sendMessage('d', { 
                  finishReason: 'error', 
                  usage: { promptTokens: 0, completionTokens: 0 } 
                });
              }
            }
          }
        } catch (error: any) {
          console.error(`[${requestId}] Error in chat stream:`, error);
          
          if (canUseController()) {
            sendMessage('3', `Error: ${error.message || 'Unknown error'}`);
            sendMessage('d', { 
              finishReason: 'error', 
              usage: { promptTokens: 0, completionTokens: 0 } 
            });
          } else {
            console.log(`[${requestId}] Error occurred but controller already closed, skipping error messages`);
          }
        } finally {
          // Always close controller at the end
          console.log(`[${requestId}] Request complete, cleaning up resources`);
          closeController();
        }
      }
    });
    
    return new Response(stream);
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      { error: "An error occurred during processing" },
      { status: 500 }
    );
  }
} 