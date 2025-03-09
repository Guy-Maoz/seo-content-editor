import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Assistant ID
const ASSISTANT_ID = 'asst_JXBmxj6nBTPncEpjwJmtzLTr';

// Set increased function timeout
export const maxDuration = 60; // Set maximum duration to 60 seconds

export async function POST(req: Request) {
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

    // Add the message to the thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: latestUserMessage.content
    });

    // Create a run in the thread
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID
    });

    // Stream the response
    const stream = new ReadableStream({
      async start(controller) {
        // Helper function to send a message part to the stream
        const sendMessagePart = (type: string, content: any) => {
          controller.enqueue(new TextEncoder().encode(`${type}:${JSON.stringify(content)}\n`));
        };

        try {
          // Set up polling with a maximum number of attempts and time between checks
          const maxPollingAttempts = 60; // Maximum 60 checks
          const pollingIntervalMs = 1000; // Check every 1 second
          let pollingAttempts = 0;
          
          // First, send message ID
          sendMessagePart('f', { messageId: `msg-${Date.now()}` });
          
          let runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
          
          // Poll for the Run completion with a limit on total attempts
          while (
            pollingAttempts < maxPollingAttempts && 
            runStatus.status !== 'completed' && 
            runStatus.status !== 'failed' && 
            runStatus.status !== 'cancelled'
          ) {
            // Increment attempt counter
            pollingAttempts++;
            
            // Wait before checking again
            await new Promise(resolve => setTimeout(resolve, pollingIntervalMs));
            
            // Check run status
            runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
            console.log(`Run status: ${runStatus.status} (Attempt ${pollingAttempts}/${maxPollingAttempts})`);
            
            // Handle if run requires action (e.g., function calls)
            if (runStatus.status === 'requires_action') {
              console.log('Function calls required. Processing tool calls...');
              
              const toolCalls = runStatus.required_action?.submit_tool_outputs?.tool_calls;
              
              if (toolCalls && toolCalls.length > 0) {
                const toolOutputs: { tool_call_id: string; output: string }[] = [];
                
                // Process each tool call
                for (const toolCall of toolCalls) {
                  // Send tool call info to client
                  sendMessagePart('t', {
                    id: toolCall.id,
                    name: toolCall.function.name,
                    args: JSON.parse(toolCall.function.arguments)
                  });
                  
                  try {
                    const args = JSON.parse(toolCall.function.arguments);
                    
                    if (toolCall.function.name === 'get_keyword_metrics') {
                      // Set base URL depending on environment
                      const baseUrl = process.env.NODE_ENV === 'production' 
                        ? process.env.NEXT_PUBLIC_API_BASE_URL || 'https://similarweb-content-seo.netlify.app'  
                        : `http://localhost:${process.env.PORT || 3000}`;
                      
                      // Call our keyword metrics API
                      const response = await fetch(`${baseUrl}/api/tools/keyword-metrics`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ keyword: args.keyword })
                      });
                      
                      let output;
                      if (response.ok) {
                        output = await response.json();
                      } else {
                        // If API fails, generate fallback data
                        output = { 
                          keyword: args.keyword,
                          volume: 1000, 
                          difficulty: 50,
                          cpc: 0.5,
                          isFallback: true
                        };
                      }
                      
                      toolOutputs.push({
                        tool_call_id: toolCall.id,
                        output: JSON.stringify(output)
                      });
                      
                      // Send tool result to client
                      sendMessagePart('r', {
                        toolCallId: toolCall.id,
                        result: output
                      });
                    }
                    else if (toolCall.function.name === 'generate_keywords') {
                      // Call our keyword generation API
                      const baseUrl = process.env.NODE_ENV === 'production' 
                        ? process.env.NEXT_PUBLIC_API_BASE_URL || 'https://similarweb-content-seo.netlify.app'  
                        : `http://localhost:${process.env.PORT || 3000}`;
                      
                      const response = await fetch(`${baseUrl}/api/keywords`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                          topic: args.topic,
                          count: args.count || 10 
                        })
                      });
                      
                      let output;
                      if (response.ok) {
                        output = await response.json();
                      } else {
                        // If API fails, return error
                        output = { 
                          error: `Failed to generate keywords for topic: ${args.topic}`,
                          keywords: []
                        };
                      }
                      
                      toolOutputs.push({
                        tool_call_id: toolCall.id,
                        output: JSON.stringify(output)
                      });
                      
                      // Send tool result to client
                      sendMessagePart('r', {
                        toolCallId: toolCall.id,
                        result: output
                      });
                    }
                    else if (toolCall.function.name === 'generate_content') {
                      // Call our content generation API
                      const baseUrl = process.env.NODE_ENV === 'production' 
                        ? process.env.NEXT_PUBLIC_API_BASE_URL || 'https://similarweb-content-seo.netlify.app'  
                        : `http://localhost:${process.env.PORT || 3000}`;
                      
                      const response = await fetch(`${baseUrl}/api/content/generate`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                          keywords: args.keywords,
                          contentType: args.contentType || 'blog post',
                          tone: args.tone || 'informative'
                        })
                      });
                      
                      let output;
                      if (response.ok) {
                        output = await response.json();
                      } else {
                        // If API fails, return error
                        output = { 
                          error: `Failed to generate content`,
                          content: ''
                        };
                      }
                      
                      toolOutputs.push({
                        tool_call_id: toolCall.id,
                        output: JSON.stringify(output)
                      });
                      
                      // Send tool result to client
                      sendMessagePart('r', {
                        toolCallId: toolCall.id,
                        result: output
                      });
                    }
                    else if (toolCall.function.name === 'analyze_seo') {
                      // Call our SEO analysis API
                      const baseUrl = process.env.NODE_ENV === 'production' 
                        ? process.env.NEXT_PUBLIC_API_BASE_URL || 'https://similarweb-content-seo.netlify.app'  
                        : `http://localhost:${process.env.PORT || 3000}`;
                      
                      const response = await fetch(`${baseUrl}/api/keywords/extract`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                          content: args.content,
                          topic: 'SEO analysis',
                          keywords: args.keywords || []
                        })
                      });
                      
                      let output;
                      if (response.ok) {
                        output = await response.json();
                      } else {
                        // If API fails, return error
                        output = { 
                          error: `Failed to analyze content`,
                          analysis: {},
                          suggestions: []
                        };
                      }
                      
                      toolOutputs.push({
                        tool_call_id: toolCall.id,
                        output: JSON.stringify(output)
                      });
                      
                      // Send tool result to client
                      sendMessagePart('r', {
                        toolCallId: toolCall.id,
                        result: output
                      });
                    }
                    else {
                      // Unknown function
                      toolOutputs.push({
                        tool_call_id: toolCall.id,
                        output: JSON.stringify({ error: `Unknown function: ${toolCall.function.name}` })
                      });
                      
                      // Send tool result to client
                      sendMessagePart('r', {
                        toolCallId: toolCall.id,
                        result: { error: `Unknown function: ${toolCall.function.name}` }
                      });
                    }
                  } catch (error) {
                    console.error(`Error processing tool call ${toolCall.function.name}:`, error);
                    // Return error information
                    toolOutputs.push({
                      tool_call_id: toolCall.id,
                      output: JSON.stringify({ error: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` })
                    });
                    
                    // Send tool result to client
                    sendMessagePart('r', {
                      toolCallId: toolCall.id,
                      result: { error: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }
                    });
                  }
                }
                
                // Submit all tool outputs back to the assistant
                if (toolOutputs.length > 0) {
                  await openai.beta.threads.runs.submitToolOutputs(threadId, run.id, {
                    tool_outputs: toolOutputs
                  });
                }
              }
            }
          }
          
          // Get the assistant's response
          if (runStatus.status === 'completed') {
            const messages = await openai.beta.threads.messages.list(threadId);
            
            // Find the latest assistant message
            const assistantMessages = messages.data
              .filter(message => message.role === 'assistant')
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            
            if (assistantMessages.length > 0) {
              const latestMessage = assistantMessages[0];
              
              // Extract and stream text content from the message
              if (latestMessage.content && latestMessage.content.length > 0) {
                for (const contentPart of latestMessage.content) {
                  if (contentPart.type === 'text') {
                    // Split message into smaller chunks to simulate streaming
                    const text = contentPart.text.value;
                    const chunkSize = 5; // Characters per chunk
                    
                    for (let i = 0; i < text.length; i += chunkSize) {
                      const chunk = text.slice(i, i + chunkSize);
                      sendMessagePart('0', chunk);
                      // Small delay to simulate streaming
                      await new Promise(resolve => setTimeout(resolve, 10));
                    }
                  }
                }
              }
            }
            
            // Send finish event
            sendMessagePart('d', { finishReason: 'stop', usage: { promptTokens: 0, completionTokens: 0 } });
          } else {
            // Send error if run didn't complete
            sendMessagePart('3', `Run did not complete successfully: ${runStatus.status}`);
            sendMessagePart('d', { finishReason: 'error', usage: { promptTokens: 0, completionTokens: 0 } });
          }
        } catch (error) {
          console.error('Error in chat stream:', error);
          // Send error message
          sendMessagePart('3', `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          sendMessagePart('d', { finishReason: 'error', usage: { promptTokens: 0, completionTokens: 0 } });
        } finally {
          controller.close();
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