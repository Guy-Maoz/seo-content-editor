import { NextResponse } from 'next/server';
import OpenAI from 'openai';

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
      return NextResponse.json(
        { error: 'Failed to generate keywords' },
        { status: 500 }
      );
    }

    // Parse the JSON response
    const keywordsData = JSON.parse(content);
    
    return NextResponse.json(keywordsData);
  } catch (error) {
    console.error('Error generating keywords:', error);
    return NextResponse.json(
      { error: 'Failed to generate keywords' },
      { status: 500 }
    );
  }
} 