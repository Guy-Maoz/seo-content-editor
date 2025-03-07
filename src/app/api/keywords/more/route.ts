import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topic, usedKeywords, negativeKeywords } = body;

    if (!topic) {
      return NextResponse.json(
        { error: "Missing required field: topic" },
        { status: 400 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `You are an SEO keyword research assistant. Generate relevant, useful keywords for content creation on specific topics.`
        },
        {
          role: "user",
          content: `Generate additional SEO keyword suggestions for the topic "${topic}".

${usedKeywords && usedKeywords.length > 0 ? 
  `The following keywords are already being used, so don't include these:
${usedKeywords.map(kw => `- ${kw}`).join('\n')}` : ''}

${negativeKeywords && negativeKeywords.length > 0 ? 
  `The following keywords should be avoided:
${negativeKeywords.map(kw => `- ${kw}`).join('\n')}` : ''}

Return your suggestions as a JSON array of objects, each with only a "keyword" property. Generate at least 10 high-quality keyword suggestions.`
        }
      ],
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const response = JSON.parse(completion.choices[0].message.content || "{}");

    return NextResponse.json({ keywords: response.keywords || [] });
  } catch (error) {
    console.error('Error generating more keywords:', error);
    return NextResponse.json(
      { error: "Failed to generate more keywords" },
      { status: 500 }
    );
  }
} 