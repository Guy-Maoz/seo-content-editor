import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Assistant ID
const ASSISTANT_ID = 'asst_JXBmxj6nBTPncEpjwJmtzLTr';

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

    // Run the Assistant on the Thread
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: ASSISTANT_ID,
    });

    // Poll for the Run completion
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    
    // Check run status every 1 second
    while (runStatus.status !== 'completed' && runStatus.status !== 'failed' && runStatus.status !== 'cancelled') {
      await new Promise(resolve => setTimeout(resolve, 1000));
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      console.log(`Run status: ${runStatus.status}`);
      
      // Handle if run requires action (e.g., function calls)
      if (runStatus.status === 'requires_action') {
        console.log('Run requires action, but we do not handle function calls in this implementation.');
        await openai.beta.threads.runs.cancel(thread.id, run.id);
        return NextResponse.json(
          { error: 'Assistant requires function calls which are not implemented' },
          { status: 500 }
        );
      }
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