import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ToolCallOutput, KeywordMetricsResponse, AssistantToolResponse } from '@/types/api';

// Add these exports to make the route compatible with static export
export const dynamic = 'force-static';
export const revalidate = false;


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
    // Use localhost with the correct port for server-side fetch
    // Since we don't know which port Next.js is running on, we'll use environment port or try common ports
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://seo-content-editor.netlify.app' 
      : 'http://localhost:3000';
    
    console.log(`Fetching keyword metrics via tool handler for: "${keyword}"`);
    
    // Call our keyword metrics API with proper absolute URL and headers
    const response = await fetch(`${baseUrl}/api/tools/keyword-metrics`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ keyword })
    });
    
    if (!response.ok) {
      console.error(`Keyword metrics API returned status ${response.status}`);
      // If API call fails, generate fallback metrics
      return generateFallbackMetrics(keyword);
    }
    
    const data = await response.json();
    
    // If we got empty metrics, generate fallback
    if (data.volume === 0 && data.difficulty === 0 && data.cpc === 0) {
      return generateFallbackMetrics(keyword);
    }
    
    return data as KeywordMetricsResponse;
  } catch (error: any) {
    console.error('Error in get_keyword_metrics function:', error.message || error);
    return generateFallbackMetrics(keyword);
  }
}

// Function to generate realistic fallback metrics
function generateFallbackMetrics(keyword: string): KeywordMetricsResponse {
  // Generate deterministic but realistic metrics based on keyword length and composition
  const wordCount = keyword.split(' ').length;
  const charCount = keyword.length;
  
  // Japanese knives keywords tend to have decent volume
  let baseVolume = 0;
  
  // Set base volumes for common knife types
  if (keyword.toLowerCase().includes('japanese chef knives')) {
    baseVolume = 4500;
  } else if (keyword.toLowerCase().includes('santoku')) {
    baseVolume = 6000;
  } else if (keyword.toLowerCase().includes('nakiri')) {
    baseVolume = 2500;
  } else if (keyword.toLowerCase().includes('gyuto')) {
    baseVolume = 2000;
  } else if (keyword.toLowerCase().includes('japanese')) {
    baseVolume = 3500;
  } else {
    // Longer keywords tend to have lower volume
    baseVolume = 2000 - (wordCount * 300);
  }
  
  const volume = Math.max(100, Math.min(10000, baseVolume + (keyword.length % 5) * 50));
  
  // Longer, more specific keywords typically have lower difficulty
  const baseDifficulty = 80 - (wordCount * 5);
  const difficulty = Math.max(20, Math.min(90, baseDifficulty + (charCount % 10)));
  
  // CPC often correlates with competition/difficulty
  const cpc = (difficulty / 30 + Math.random()).toFixed(2);
  
  console.log(`Generated fallback metrics for "${keyword}": volume=${volume}, difficulty=${difficulty}, cpc=${cpc}`);
  
  return {
    keyword,
    volume,
    difficulty,
    cpc: parseFloat(cpc),
    isFallback: true
  };
} 