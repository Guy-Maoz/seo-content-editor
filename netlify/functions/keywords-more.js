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
    const { topic, usedKeywords, negativeKeywords } = body;

    if (!topic) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required field: topic" }),
        headers: { "Content-Type": "application/json" }
      };
    }

    console.log(`Generating more keywords for topic: "${topic}"`);
    console.log(`Used keywords: ${usedKeywords?.length || 0}, Negative keywords: ${negativeKeywords?.length || 0}`);

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo", // Using a faster model
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
        return {
          statusCode: 200,
          body: JSON.stringify({ 
            keywords: [],
            error: "Empty response from AI model" 
          }),
          headers: { "Content-Type": "application/json" }
        };
      }

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
        
        console.log(`Successfully generated ${response.keywords.length} additional keywords`);
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
    } catch (apiError) {
      console.error('OpenAI API error:', apiError);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: "OpenAI API error: " + apiError.message,
          keywords: [] 
        }),
        headers: { "Content-Type": "application/json" }
      };
    }
  } catch (error) {
    console.error('Error generating more keywords:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to generate more keywords" }),
      headers: { "Content-Type": "application/json" }
    };
  }
}; 