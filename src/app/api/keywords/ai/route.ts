import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Add these exports to make the route compatible with static export
export const dynamic = 'force-static';
export const revalidate = false;


// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { topic } = await request.json();

    if (!topic) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      );
    }

    // Generate keywords using OpenAI only (fast response)
    const keywordsFromOpenAI = await generateKeywordsWithOpenAI(topic);
    
    if (!keywordsFromOpenAI || !keywordsFromOpenAI.keywords || keywordsFromOpenAI.keywords.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate keywords' },
        { status: 500 }
      );
    }

    return NextResponse.json(keywordsFromOpenAI);
  } catch (error) {
    console.error('Error in AI keywords API:', error);
    return NextResponse.json(
      { error: 'Failed to generate keywords' },
      { status: 500 }
    );
  }
}

async function generateKeywordsWithOpenAI(topic: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful SEO expert that provides keyword suggestions.'
      },
      {
        role: 'user',
        content: `Generate 10 high-search-volume keywords related to "${topic}". 
        Return ONLY a JSON array of objects with properties: 
        "keyword" (the keyword phrase), 
        "volume" (estimated monthly search volume as a number), 
        "difficulty" (SEO difficulty score from 1-100), 
        "cpc" (estimated cost-per-click in USD).
        Make sure the response is valid JSON.`
      }
    ],
    temperature: 0.7,
    response_format: { type: 'json_object' }
  });

  const content = response.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error('Failed to generate keywords with OpenAI');
  }

  // Parse the JSON response
  const keywordsData = JSON.parse(content);
  
  // Add selected property to each keyword
  if (keywordsData.keywords && Array.isArray(keywordsData.keywords)) {
    keywordsData.keywords = keywordsData.keywords.map((keyword: any) => ({
      ...keyword,
      selected: true
    }));
  }
  
  return keywordsData;
} 