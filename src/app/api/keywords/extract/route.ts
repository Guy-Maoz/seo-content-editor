import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { content, topic } = body;

    if (!content) {
      return NextResponse.json(
        { error: "Missing required field: content" },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `You are an SEO keyword extraction system. Extract relevant keywords from content that relate to the main topic.`
        },
        {
          role: "user",
          content: `Extract the most important keywords from the following content that relate to the topic "${topic || 'general'}". Return only a JSON array of objects with a "keyword" property for each keyword. Focus on extracting meaningful phrases that could be used for SEO optimization.

Content:
${content}`
        }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const response = JSON.parse(completion.choices[0].message.content || "{}");

    return NextResponse.json({ keywords: response.keywords || [] });
  } catch (error) {
    console.error('Error extracting keywords:', error);
    return NextResponse.json(
      { error: "Failed to extract keywords" },
      { status: 500 }
    );
  }
} 