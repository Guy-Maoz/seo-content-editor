const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

exports.handler = async function(event, context) {
  // Set a longer function timeout
  context.callbackWaitsForEmptyEventLoop = false;
  
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
      headers: {
        "Allow": "POST",
        "Content-Type": "application/json"
      }
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { content, topic } = body;

    if (!content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required field: content" }),
        headers: { "Content-Type": "application/json" }
      };
    }

    console.log(`Extracting keywords for topic: "${topic || 'general'}" (content length: ${content.length} chars)`);

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Use a faster model to avoid timeouts
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
${content.substring(0, 3000)}`  // Shortened to 3000 chars to reduce processing time
        }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    // Check if we have a response and content
    if (!completion.choices[0]?.message?.content) {
      console.error('Empty response from OpenAI');
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          keywords: [],
          error: "Empty response from AI model" 
        }),
        headers: { "Content-Type": "application/json" }
      };
    }

    // Log the response for debugging
    console.log('OpenAI response received, length:', completion.choices[0].message.content.length);
    
    try {
      const response = JSON.parse(completion.choices[0].message.content);
      
      // Validate the response structure
      if (!response.keywords || !Array.isArray(response.keywords)) {
        console.error('Invalid response structure:', response);
        return {
          statusCode: 200,
          body: JSON.stringify({ 
            keywords: [],
            error: "Invalid response structure" 
          }),
          headers: { "Content-Type": "application/json" }
        };
      }
      
      console.log(`Successfully extracted ${response.keywords.length} keywords`);
      return {
        statusCode: 200,
        body: JSON.stringify({ keywords: response.keywords || [] }),
        headers: { "Content-Type": "application/json" }
      };
    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      console.error('Raw content:', completion.choices[0].message.content);
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          keywords: [],
          error: "Failed to parse AI response" 
        }),
        headers: { "Content-Type": "application/json" }
      };
    }
  } catch (error) {
    console.error('Error extracting keywords:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to extract keywords" }),
      headers: { "Content-Type": "application/json" }
    };
  }
}; 