import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ToolCallOutput, KeywordMetricsResponse, AssistantToolResponse } from '@/types/api';

// Define the tool schema
const TOOLS = [
  {
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
  }
];

// Next.js API route handler
export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    
    if (!query) {
      return NextResponse.json(
        { error: "Query parameter is required" },
        { status: 400 }
      );
    }
    
    // Create OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Create a thread
    const thread = await openai.beta.threads.create();
    
    // Add message to thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: query
    });
    
    // Run the assistant with tools
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: "asst_JXBmxj6nBTPncEpjwJmtzLTr",
      tools: TOOLS
    });
    
    // Polling for completion or tool calls
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    
    // Set a reasonable timeout (30 polling attempts)
    let attempts = 0;
    const maxAttempts = 30;
    
    while (runStatus.status !== "completed" && 
           runStatus.status !== "failed" && 
           runStatus.status !== "cancelled" && 
           attempts < maxAttempts) {
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      
      // Get updated status
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      console.log(`Run status: ${runStatus.status} (Attempt ${attempts}/${maxAttempts})`);
      
      // Handle required actions (tool calls)
      if (runStatus.status === "requires_action") {
        console.log("Tool calls required");
        
        // Get the tool calls
        const toolCalls = runStatus.required_action?.submit_tool_outputs?.tool_calls;
        
        if (toolCalls && toolCalls.length > 0) {
          const toolOutputs: ToolCallOutput[] = [];
          
          // Process each tool call
          for (const toolCall of toolCalls) {
            const functionName = toolCall.function.name;
            const functionArgs = JSON.parse(toolCall.function.arguments);
            
            let output: KeywordMetricsResponse | { error: string };
            
            // Route to the appropriate function
            if (functionName === "get_keyword_metrics") {
              output = await handleGetKeywordMetrics(functionArgs.keyword);
            } else {
              output = { error: `Unknown function: ${functionName}` };
            }
            
            toolOutputs.push({
              tool_call_id: toolCall.id,
              output: JSON.stringify(output)
            });
          }
          
          // Submit tool outputs back to the assistant
          await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
            tool_outputs: toolOutputs
          });
        }
      }
    }
    
    // If still not completed after max attempts
    if (attempts >= maxAttempts && runStatus.status !== "completed") {
      return NextResponse.json({ 
        error: "Request timed out" 
      }, { status: 504 });
    }
    
    // If run failed
    if (runStatus.status === "failed") {
      return NextResponse.json({ 
        error: "Assistant run failed", 
        details: runStatus.last_error 
      }, { status: 500 });
    }
    
    // Get the messages from the thread
    const messages = await openai.beta.threads.messages.list(thread.id);
    
    // Find assistant's response
    const assistantMessages = messages.data
      .filter(message => message.role === "assistant")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    if (assistantMessages.length === 0) {
      return NextResponse.json({ error: "No response from assistant" }, { status: 500 });
    }
    
    // Format the response
    const response: AssistantToolResponse = {
      answer: "",
      tool_calls: []
    };
    
    // Get the latest message content
    const latestMessage = assistantMessages[0];
    for (const content of latestMessage.content) {
      if (content.type === "text") {
        response.answer += content.text.value;
      }
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error("Error in tools handler:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Function to handle keyword metrics tool call
async function handleGetKeywordMetrics(keyword: string): Promise<KeywordMetricsResponse> {
  try {
    // Get the current URL for relative path resolution
    const baseUrl = process.env.VERCEL_URL || process.env.NETLIFY_URL 
      ? `https://${process.env.VERCEL_URL || process.env.NETLIFY_URL}`
      : 'http://localhost:3000';
      
    // Call our keyword metrics API
    const response = await fetch(`${baseUrl}/api/tools/keyword-metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ keyword })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get keyword metrics: ${response.status}`);
    }
    
    const data = await response.json();
    return data as KeywordMetricsResponse;
  } catch (error: any) {
    console.error('Error in get_keyword_metrics function:', error);
    
    // Return a fallback response
    return {
      keyword,
      volume: 0,
      difficulty: 0,
      cpc: 0,
      isFallback: true,
      error: error.message || 'Unknown error'
    };
  }
} 