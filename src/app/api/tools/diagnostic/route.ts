import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ToolCallOutput } from '@/types/api';

// Define the test tool for diagnostics
const TOOL = {
  type: "function" as const,
  function: {
    name: "get_keyword_metrics",
    description: "Get search volume, SEO difficulty, and cost-per-click data for a specific keyword from Similarweb",
    parameters: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "The keyword to look up metrics for (e.g., 'best running shoes')"
        }
      },
      required: ["keyword"]
    }
  }
};

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const assistantId = searchParams.get('assistant_id') || 'asst_JXBmxj6nBTPncEpjwJmtzLTr';
    const testKeyword = searchParams.get('keyword') || 'test keyword';
    
    // Create OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Get the assistant to check if it exists
    let assistant;
    try {
      assistant = await openai.beta.assistants.retrieve(assistantId);
    } catch (error: any) {
      return NextResponse.json({ 
        status: 'error',
        message: `Assistant with ID ${assistantId} not found`,
        error: error.message || 'Unknown error'
      }, { status: 404 });
    }
    
    // Create a thread for testing
    const thread = await openai.beta.threads.create();
    
    // Add a diagnostic message to the thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `This is a diagnostic test. Please use the get_keyword_metrics tool to look up data for the keyword: "${testKeyword}". Only return the raw data from the tool.`
    });
    
    // Run the assistant with our test tool
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
      tools: [TOOL]
    });
    
    // Set up polling to check for tool calls
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    let attempts = 0;
    const maxAttempts = 20;
    let toolCalled = false;
    let toolCallId: string | undefined = undefined;
    let toolCallResult = null;
    
    // Poll for run status
    while (attempts < maxAttempts && 
           runStatus.status !== 'completed' && 
           runStatus.status !== 'failed' && 
           runStatus.status !== 'cancelled') {
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      
      // Update run status
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      console.log(`Diagnostic run status: ${runStatus.status} (Attempt ${attempts}/${maxAttempts})`);
      
      // Check if the assistant is requesting to use the tool
      if (runStatus.status === 'requires_action') {
        toolCalled = true;
        
        // Get the tool calls from the run
        const toolCalls = runStatus.required_action?.submit_tool_outputs?.tool_calls;
        
        if (toolCalls && toolCalls.length > 0) {
          // Process the first tool call
          const toolCall = toolCalls[0];
          toolCallId = toolCall.id;
          
          if (toolCall.function.name === 'get_keyword_metrics') {
            // The assistant is using our tool!
            const args = JSON.parse(toolCall.function.arguments);
            
            // Call our keyword metrics API to get real data
            const keywordMetricsResponse = await fetch(`http://localhost:${process.env.PORT || 3000}/api/tools/keyword-metrics`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ keyword: args.keyword })
            });
            
            if (keywordMetricsResponse.ok) {
              toolCallResult = await keywordMetricsResponse.json();
              
              // Submit the tool output back to the assistant
              if (toolCallId) {
                await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
                  tool_outputs: [{
                    tool_call_id: toolCallId,
                    output: JSON.stringify(toolCallResult)
                  }]
                });
              }
            } else {
              // Submit an error if the API call failed
              if (toolCallId) {
                await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
                  tool_outputs: [{
                    tool_call_id: toolCallId,
                    output: JSON.stringify({ error: "Failed to get keyword metrics" })
                  }]
                });
              }
            }
          } else {
            // The assistant tried to use a different tool
            if (toolCallId) {
              await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
                tool_outputs: [{
                  tool_call_id: toolCallId,
                  output: JSON.stringify({ error: "Unknown tool called" })
                }]
              });
            }
          }
        }
      }
    }
    
    // Get the final response from the assistant
    const messages = await openai.beta.threads.messages.list(thread.id);
    const assistantMessages = messages.data.filter(msg => msg.role === "assistant");
    let finalResponse = "";
    
    if (assistantMessages.length > 0) {
      const latestMessage = assistantMessages[0];
      for (const content of latestMessage.content) {
        if (content.type === "text") {
          finalResponse += content.text.value;
        }
      }
    }
    
    // Return a comprehensive diagnostic report
    return NextResponse.json({
      status: 'success',
      assistant: {
        id: assistant.id,
        name: assistant.name,
        model: assistant.model
      },
      diagnostic_results: {
        test_completed: runStatus.status === 'completed',
        tool_was_called: toolCalled,
        tool_call_id: toolCallId,
        tool_call_result: toolCallResult,
        final_response: finalResponse,
        run_status: runStatus.status,
        attempts_made: attempts
      },
      thread_id: thread.id,
      run_id: run.id
    });
    
  } catch (error: any) {
    console.error('Error in diagnostic tool:', error);
    return NextResponse.json({ 
      status: 'error',
      message: 'Diagnostic check failed',
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
} 