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
    const { content, topic } = body;

    if (!content) {
      return NextResponse.json(
        { error: "Missing required field: content" },
        { status: 400 }
      );
    }

    console.log(`Extracting keywords for topic: "${topic || 'general'}" (content length: ${content.length} chars)`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: `You are an SEO keyword extraction system. Extract relevant keywords from content that relate to the main topic.`
        },
        {
          role: "user",
          content: `Extract the most important keywords from the following content that relate to the topic "${topic || 'general'}". 
          
Return a JSON object with a "keywords" property that contains an array of objects, each with a "keyword" property.
For example: { "keywords": [{"keyword": "example keyword 1"}, {"keyword": "example keyword 2"}] }

Focus on extracting meaningful phrases that could be used for SEO optimization, return at least 5-10 keywords.

Content:
${content.substring(0, 5000)}`  // Limit content length to avoid token issues
        }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });


    // Check if we have a response and content
    if (!completion.choices[0]?.message?.content) {
      console.error('Empty response from OpenAI');
      return NextResponse.json({ 
        keywords: [],
        error: "Empty response from AI model" 
      });
    }

    // Log the response for debugging
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
      
      console.log(`Successfully extracted ${response.keywords.length} keywords`);
      return NextResponse.json({ keywords: response.keywords || [] });
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Raw content:', completion.choices[0].message.content);
      return NextResponse.json({ 
        keywords: [],
        error: "Failed to parse AI response" 
      });
    }
  } catch (error) {
    console.error('Error extracting keywords:', error);
    return NextResponse.json(
      { error: "Failed to extract keywords" },
      { status: 500 }
    );
  }
} 