import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topic, keywords, existingContent, isUpdate } = body;

    if (!topic || !keywords || keywords.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: topic and keywords" },
        { status: 400 }
      );
    }

    console.log(`Generating ${isUpdate ? 'updated' : 'new'} content for topic: "${topic}" with ${keywords.length} keywords`);
    
    const prompt = isUpdate
      ? generateUpdatePrompt(topic, keywords, existingContent)
      : generateNewPrompt(topic, keywords);

    // Log the start of the API request
    console.log(`Sending request to OpenAI for content generation (${prompt.length} chars)`);
    
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: `You are an expert SEO content writer. You create engaging, informative, and high-quality content that utilizes keywords naturally while providing real value to readers.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2500,
      });

      if (!completion.choices[0]?.message?.content) {
        console.error('Empty response from OpenAI content generation');
        return NextResponse.json({ 
          content: existingContent || '',
          error: "Failed to generate content - empty response" 
        });
      }

      const generatedContent = completion.choices[0].message.content;
      console.log(`Successfully generated content (${generatedContent.length} chars)`);

      return NextResponse.json({ content: generatedContent });
    } catch (apiError) {
      console.error('OpenAI API error:', apiError);
      return NextResponse.json(
        { 
          error: "OpenAI API error: " + (apiError as Error).message,
          content: existingContent || '' 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error generating content:', error);
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    );
  }
}

function generateNewPrompt(topic: string, keywords: string[]): string {
  return `
Write a high-quality, SEO-optimized article about "${topic}".

Please incorporate the following keywords naturally throughout the content:
${keywords.map(kw => `- ${kw}`).join('\n')}

Guidelines:
- Create a compelling headline (H1) that includes the primary keyword
- Use proper heading structure (H2, H3) to organize the content
- Write at least 700-1000 words of comprehensive content
- Include an introduction that hooks the reader and explains what they'll learn
- Provide practical, actionable advice and information
- Incorporate keywords naturally without keyword stuffing
- Conclude with a summary and optionally a call to action
- Maintain a friendly, authoritative tone
- Format the content in HTML using proper heading tags, paragraphs, and lists
`;
}

function generateUpdatePrompt(topic: string, keywords: string[], existingContent: string): string {
  return `
I have an existing article about "${topic}". Please improve and enhance this content while ensuring all the following keywords are incorporated naturally:
${keywords.map(kw => `- ${kw}`).join('\n')}

Here's the existing content:
${existingContent}

Guidelines for improvement:
- Maintain the overall structure but enhance where needed
- Ensure all keywords are included naturally
- Improve flow, readability and engagement
- Add additional valuable information where appropriate
- Fix any grammatical or stylistic issues
- Maintain the HTML formatting with proper heading tags
- Return the complete improved article
`;
} 