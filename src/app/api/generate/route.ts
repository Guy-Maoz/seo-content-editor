import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert SEO content writer who creates engaging, informative content with proper HTML formatting.'
        },
        {
          role: 'user',
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
          
          Make sure to use these HTML tags properly - they should be properly nested and closed.
          The headings should have proper hierarchy (h1 -> h2 -> h3).
          
          Return ONLY the article content with HTML formatting, without any additional commentary.`
        }
      ],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      return NextResponse.json(
        { error: 'Failed to generate content' },
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
  
  return cleaned;
} 