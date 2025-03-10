import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openAI = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Assistant ID
const ASSISTANT_ID = 'asst_JXBmxj6nBTPncEpjwJmtzLTr';

// Set increased function timeout
export const maxDuration = 300; // Set maximum duration to 5 minutes for complex operations

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

    // Create a new Transform Stream for the response
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Function to send a message part with the writer
    const sendMessage = async (type: string, content: any) => {
      try {
        const message = `${type}:${JSON.stringify(content)}\n`;
        await writer.write(encoder.encode(message));
      } catch (err) {
        console.error(`[${requestId}] Error writing message type ${type}:`, err);
      }
    };

    // Process the chat in a separate async task to avoid blocking
    (async () => {
      try {
        console.log(`[${requestId}] Processing run ${run.id} for thread ${threadId}`);
        
        // Send initial message ID
        await sendMessage('f', { messageId: `msg-${Date.now()}` });
        
        // Poll for run completion
        const maxAttempts = 60;
        const interval = 1000;
        let attempts = 0;
        let runStatus = await openAI.beta.threads.runs.retrieve(threadId, run.id);
        
        while (attempts < maxAttempts && 
              runStatus.status !== 'completed' && 
              runStatus.status !== 'failed' && 
              runStatus.status !== 'cancelled') {
          
          console.log(`[${requestId}] Run status: ${runStatus.status} (Attempt ${attempts + 1}/${maxAttempts})`);
          attempts++;
          
          // Handle tool calls
          if (runStatus.status === 'requires_action') {
            console.log(`[${requestId}] Processing tool calls...`);
            
            const toolCalls = runStatus.required_action?.submit_tool_outputs?.tool_calls;
            if (toolCalls && toolCalls.length > 0) {
              // Collect all tool outputs
              const toolOutputs: Array<{ tool_call_id: string; output: string }> = [];
              
              // Process each tool call
              for (const toolCall of toolCalls) {
                if (toolCall.type === 'function') {
                  // Notify about tool processing
                  await sendMessage('t', {
                    id: toolCall.id,
                    type: toolCall.type,
                    function: toolCall.function
                  });
                  
                  try {
                    const args = JSON.parse(toolCall.function.arguments || '{}');
                    let output: any = null;
                    
                    // Process different tool functions
                    if (toolCall.function.name === 'get_keyword_metrics') {
                      console.log(`[${requestId}] Processing keyword metrics for "${args.keyword}"`);
                      
                      try {
                        const baseUrl = process.env.NODE_ENV === 'production' 
                          ? process.env.NEXT_PUBLIC_API_BASE_URL || 'https://similarweb-content-seo.netlify.app'  
                          : `http://localhost:${process.env.PORT || 3000}`;
                        
                        // Call keyword metrics API
                        const response = await fetch(`${baseUrl}/api/tools/keyword-metrics`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ keyword: args.keyword })
                        });
                        
                        if (response.ok) {
                          output = await response.json();
                          console.log(`[${requestId}] Got metrics for "${args.keyword}":`, output);
                        } else {
                          console.log(`[${requestId}] API error ${response.status}: ${response.statusText}`);
                          output = {
                            keyword: args.keyword,
                            volume: 1000, 
                            difficulty: 50,
                            cpc: 0.5,
                            isFallback: true,
                            error: `API error: ${response.status}`
                          } as KeywordMetrics;
                        }
                      } catch (apiError: any) {
                        console.error(`[${requestId}] API call error:`, apiError);
                        output = {
                          keyword: args.keyword,
                          volume: 1000, 
                          difficulty: 50,
                          cpc: 0.5,
                          isFallback: true,
                          error: apiError.message || 'Unknown API error'
                        } as KeywordMetrics;
                      }
                    } 
                    // Add handlers for other function types as needed
                    else {
                      output = {
                        error: `Unknown function: ${toolCall.function.name}`
                      };
                    }
                    
                    // Add to output collection and send result
                    if (output) {
                      toolOutputs.push({
                        tool_call_id: toolCall.id,
                        output: JSON.stringify(output)
                      });
                      
                      await sendMessage('r', {
                        toolCallId: toolCall.id,
                        result: output
                      });
                    }
                  } catch (toolError: any) {
                    console.error(`[${requestId}] Tool processing error:`, toolError);
                    
                    // Add error output
                    const errorOutput = {
                      error: toolError.message || 'Tool processing error'
                    };
                    
                    toolOutputs.push({
                      tool_call_id: toolCall.id,
                      output: JSON.stringify(errorOutput)
                    });
                    
                    await sendMessage('r', {
                      toolCallId: toolCall.id,
                      result: errorOutput
                    });
                  }
                }
              }
              
              // Submit all tool outputs
              if (toolOutputs.length > 0) {
                try {
                  console.log(`[${requestId}] Submitting ${toolOutputs.length} tool outputs`);
                  await openAI.beta.threads.runs.submitToolOutputs(threadId, run.id, {
                    tool_outputs: toolOutputs
                  });
                  console.log(`[${requestId}] Tool outputs submitted successfully`);
                } catch (submitError: any) {
                  console.error(`[${requestId}] Error submitting tool outputs:`, submitError);
                  await sendMessage('3', `Error submitting tool outputs: ${submitError.message}`);
                  await sendMessage('d', { 
                    finishReason: 'error', 
                    usage: { promptTokens: 0, completionTokens: 0 } 
                  });
                  
                  await writer.close();
                  return;
                }
              }
            }
          }
          
          // Wait before checking again
          await delay(interval);
          
          // Update run status
          runStatus = await openAI.beta.threads.runs.retrieve(threadId, run.id);
        }
        
        // Process completed run
        if (runStatus.status === 'completed') {
          console.log(`[${requestId}] Run completed, fetching messages`);
          
          try {
            // Get latest messages
            const messages = await openAI.beta.threads.messages.list(threadId);
            const assistantMessages = messages.data
              .filter(message => message.role === 'assistant')
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            
            if (assistantMessages.length > 0) {
              const latestMessage = assistantMessages[0];
              
              // Stream message content
              for (const part of latestMessage.content) {
                if (part.type === 'text') {
                  const text = part.text.value;
                  const chunkSize = 3;
                  
                  for (let i = 0; i < text.length; i += chunkSize) {
                    const chunk = text.slice(i, i + chunkSize);
                    await sendMessage('0', chunk);
                    await delay(10);
                  }
                }
              }
              
              // Send completion message
              await sendMessage('d', { 
                finishReason: 'stop', 
                usage: { promptTokens: 0, completionTokens: 0 } 
              });
            } else {
              await sendMessage('3', 'No assistant response found');
              await sendMessage('d', { 
                finishReason: 'error', 
                usage: { promptTokens: 0, completionTokens: 0 } 
              });
            }
          } catch (messageError: any) {
            console.error(`[${requestId}] Error fetching messages:`, messageError);
            await sendMessage('3', `Error fetching messages: ${messageError.message}`);
            await sendMessage('d', { 
              finishReason: 'error', 
              usage: { promptTokens: 0, completionTokens: 0 } 
            });
          }
        } else {
          console.log(`[${requestId}] Run ended with status: ${runStatus.status}`);
          await sendMessage('3', `Run ended with status: ${runStatus.status}`);
          await sendMessage('d', { 
            finishReason: 'error', 
            usage: { promptTokens: 0, completionTokens: 0 } 
          });
        }
      } catch (error: any) {
        console.error(`[${requestId}] Error in chat stream:`, error);
        await sendMessage('3', `Error: ${error.message || 'Unknown error'}`);
        await sendMessage('d', { 
          finishReason: 'error', 
          usage: { promptTokens: 0, completionTokens: 0 } 
        });
      } finally {
        console.log(`[${requestId}] Stream processing complete, closing writer`);
        await writer.close();
      }
    })().catch(err => {
      console.error(`[${requestId}] Unhandled error in async process:`, err);
    });

    // Return the readable stream
    return new Response(readable);
    
  } catch (error) {
    console.error(`[${requestId}] Error in chat API:`, error);
    return NextResponse.json(
      { error: "An error occurred during processing" },
      { status: 500 }
    );
  }
} 