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

// Define our tool schema
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

export async function POST(request: Request) {
  try {
    const { topic, keywords } = await request.json();

    if (!topic || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { error: 'Topic and at least one keyword are required' },
        { status: 400 }
      );
    }

    const keywordsList = keywords.map((k: any) => k.keyword).join(', ');

    // Create a Thread
    const thread = await openai.beta.threads.create();

    // Add a Message to the Thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `Write a well-structured, SEO-optimized article about "${topic}".
      
      Use the following keywords naturally throughout the text (don't force them):
      ${keywordsList}
      
      The content should be:
      - Engaging and informative
      - Well-structured with clear sections
      - Between 500-800 words
      - Written in a conversational tone
      - Optimized for SEO with proper keyword usage
      
      IMPORTANT: Format the content with proper HTML tags following these strict rules:
      - Use <h1> for the main title (only use ONE h1 tag)
      - Use <h2> for major sections (2-4 sections)
      - Use <h3> for subsections where needed
      - Use <p> for paragraphs
      - Use <strong> or <b> for emphasis and important points
      - Use <em> or <i> for italicized text
      
      DO NOT include <!DOCTYPE>, <html>, <head>, <body> or any other document structure tags.
      Only provide the actual content with heading and paragraph tags.
      
      Make sure to use these HTML tags properly - they should be properly nested and closed.
      The headings should have proper hierarchy (h1 -> h2 -> h3).
      
      Return ONLY the article content with HTML formatting, without any additional commentary.`
    });

// Add these exports to make the route compatible with static export
export const dynamic = 'force-static';
export const revalidate = false;


    // Run the Assistant on the Thread with tools
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID,
      tools: TOOLS
    });

    // Set up polling with a maximum number of attempts and time between checks
    const maxPollingAttempts = 30; // Maximum 30 checks
    const pollingIntervalMs = 1000; // Check every 1 second
    let pollingAttempts = 0;
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    
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
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      console.log(`Run status: ${runStatus.status} (Attempt ${pollingAttempts}/${maxPollingAttempts})`);
      
      // Handle if run requires action (e.g., function calls)
      if (runStatus.status === 'requires_action') {
        console.log('Function calls required. Processing tool calls...');
        
        const toolCalls = runStatus.required_action?.submit_tool_outputs?.tool_calls;
        
        if (toolCalls && toolCalls.length > 0) {
          const toolOutputs: { tool_call_id: string; output: string }[] = [];
          
          // Process each tool call
          for (const toolCall of toolCalls) {
            if (toolCall.function.name === 'get_keyword_metrics') {
              try {
                const args = JSON.parse(toolCall.function.arguments);
                const keyword = args.keyword;
                
                console.log(`Content generation fetching metrics for: "${keyword}"`);
                
                // Set base URL depending on environment
                const baseUrl = process.env.NODE_ENV === 'production' 
                  ? 'https://seo-content-editor.netlify.app' 
                  : `http://localhost:${process.env.PORT || 3000}`;
                
                // Call our keyword metrics API
                const response = await fetch(`${baseUrl}/api/tools/keyword-metrics`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ keyword })
                });
                
                let output;
                if (response.ok) {
                  output = await response.json();
                } else {
                  // If API fails, generate fallback data
                  output = { 
                    keyword,
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
              } catch (error) {
                console.error('Error processing keyword metrics:', error);
                // Return error information
                toolOutputs.push({
                  tool_call_id: toolCall.id,
                  output: JSON.stringify({ error: 'Failed to get keyword metrics' })
                });
              }
            } else {
              // Unknown function
              toolOutputs.push({
                tool_call_id: toolCall.id,
                output: JSON.stringify({ error: `Unknown function: ${toolCall.function.name}` })
              });
            }
          }
          
          // Submit all tool outputs back to the assistant
          if (toolOutputs.length > 0) {
            await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
              tool_outputs: toolOutputs
            });
          }
        }
      }
    }

    // If we've hit our polling limit and the run isn't complete, cancel it
    if (pollingAttempts >= maxPollingAttempts && runStatus.status !== 'completed') {
      console.error('Maximum polling attempts reached. Cancelling run.');
      await openai.beta.threads.runs.cancel(thread.id, run.id);
      return NextResponse.json(
        { error: 'Content generation timed out. Please try again.' },
        { status: 504 } // Gateway Timeout status
      );
    }

    if (runStatus.status !== 'completed') {
      console.error('Run did not complete successfully:', runStatus.status);
      return NextResponse.json(
        { error: `Failed to generate content: ${runStatus.status}` },
        { status: 500 }
      );
    }

    // Get Messages from the Thread
    const messages = await openai.beta.threads.messages.list(thread.id);
    
    // Find the latest assistant message
    const assistantMessages = messages.data
      .filter(message => message.role === 'assistant')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    if (assistantMessages.length === 0) {
      return NextResponse.json(
        { error: 'No response from assistant' },
        { status: 500 }
      );
    }
    
    // Get the content from the latest assistant message
    const latestMessage = assistantMessages[0];
    let content = '';
    
    if (latestMessage.content && latestMessage.content.length > 0) {
      // Extract text content from the message
      for (const contentPart of latestMessage.content) {
        if (contentPart.type === 'text') {
          content += contentPart.text.value;
        }
      }
    }
    
    if (!content) {
      return NextResponse.json(
        { error: 'Failed to get content from assistant message' },
        { status: 500 }
      );
    }
    
    // Clean up the content to ensure it's valid HTML
    const cleanedContent = cleanHtml(content);
    
    return NextResponse.json({ content: cleanedContent });
  } catch (error) {
    console.error('Error generating content:', error);
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    );
  }
}

// Function to clean up HTML and ensure it's valid
function cleanHtml(html: string) {
  // Remove any markdown backticks that might be included
  let cleaned = html.replace(/```html/g, '').replace(/```/g, '');
  
  // Remove doctype, html, head, body tags if present
  cleaned = cleaned.replace(/<!DOCTYPE[^>]*>/i, '');
  cleaned = cleaned.replace(/<html[^>]*>|<\/html>/gi, '');
  cleaned = cleaned.replace(/<head>[\s\S]*?<\/head>/gi, '');
  cleaned = cleaned.replace(/<body[^>]*>|<\/body>/gi, '');
  cleaned = cleaned.replace(/<meta[^>]*>/gi, '');
  cleaned = cleaned.replace(/<title>.*?<\/title>/gi, '');
  
  // Ensure there's only one h1 tag
  const h1Count = (cleaned.match(/<h1/g) || []).length;
  if (h1Count > 1) {
    // Replace additional h1 tags with h2
    cleaned = cleaned.replace(/<h1/g, (match, index) => {
      return index === cleaned.indexOf('<h1') ? match : '<h2';
    });
    cleaned = cleaned.replace(/<\/h1>/g, (match, index) => {
      return index === cleaned.lastIndexOf('</h1>') ? match : '</h2>';
    });
  }
  
  // Trim whitespace
  cleaned = cleaned.trim();
  
  // Log the cleaned content for debugging
  console.log('Cleaned HTML content:', cleaned.substring(0, 200) + '...');
  
  return cleaned;
} 