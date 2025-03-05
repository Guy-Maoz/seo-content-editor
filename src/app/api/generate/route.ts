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
          content: 'You are an expert SEO content writer who creates engaging, informative content.'
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
          
          Return ONLY the article content without any additional commentary.`
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
    
    return NextResponse.json({ content });
  } catch (error) {
    console.error('Error generating content:', error);
    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    );
  }
} 