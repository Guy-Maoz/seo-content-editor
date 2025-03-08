import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Add these exports to make the route compatible with static export
export const dynamic = 'force-static';
export const revalidate = false;



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

    console.log(`Generating more keywords for topic: "${topic}"`);
    console.log(`Used keywords: ${usedKeywords?.length || 0}, Negative keywords: ${negativeKeywords?.length || 0}`);

    try {
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

Return your suggestions as a JSON object with a "keywords" array containing objects, each with only a "keyword" property.
For example: { "keywords": [{"keyword": "example keyword 1"}, {"keyword": "example keyword 2"}] }

Generate at least 10 high-quality keyword suggestions.`
          }
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      });

      if (!completion.choices[0]?.message?.content) {
        console.error('Empty response from OpenAI keyword generation');
        return NextResponse.json({ 
          keywords: [],
          error: "Empty response from AI model" 
        });
      }

      console.log('OpenAI response received, length:', completion.choices[0].message.content.length);
      
      try {
        const response = JSON.parse(completion.choices[0].message.content);
        
        // Validate the response structure
        if (!response.keywords || !Array.isArray(response.keywords)) {
          console.error('Invalid response structure:', response);
          return NextResponse.json({ 
            keywords: [],
            error: "Invalid response structure" 
          });
        }
        
        console.log(`Successfully generated ${response.keywords.length} additional keywords`);
        return NextResponse.json({ keywords: response.keywords || [] });
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        console.error('Raw content:', completion.choices[0].message.content);
        return NextResponse.json({ 
          keywords: [],
          error: "Failed to parse AI response" 
        });
      }
    } catch (apiError) {
      console.error('OpenAI API error:', apiError);
      return NextResponse.json(
        { 
          error: "OpenAI API error: " + (apiError as Error).message,
          keywords: [] 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error generating more keywords:', error);
    return NextResponse.json(
      { error: "Failed to generate more keywords" },
      { status: 500 }
    );
  }
} 