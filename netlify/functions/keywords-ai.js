const { OpenAI } = require("openai");

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

exports.handler = async function(event, context) {
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
    // Parse the request body
    const { topic } = JSON.parse(event.body);

    if (!topic) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Topic is required" }),
        headers: { "Content-Type": "application/json" }
      };
    }

    // Generate keywords using OpenAI
    const keywordsFromOpenAI = await generateKeywordsWithOpenAI(topic);
    
    if (!keywordsFromOpenAI || !keywordsFromOpenAI.keywords || keywordsFromOpenAI.keywords.length === 0) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to generate keywords" }),
        headers: { "Content-Type": "application/json" }
      };
    }

    // Return the response
    return {
      statusCode: 200,
      body: JSON.stringify(keywordsFromOpenAI),
      headers: { "Content-Type": "application/json" }
    };
  } catch (error) {
    console.error("Error in AI keywords function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to generate keywords" }),
      headers: { "Content-Type": "application/json" }
    };
  }
};

async function generateKeywordsWithOpenAI(topic) {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: "You are a helpful SEO expert that provides keyword suggestions."
      },
      {
        role: "user",
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
    response_format: { type: "json_object" }
  });

  const content = response.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error("Failed to generate keywords with OpenAI");
  }

  // Parse the JSON response
  const keywordsData = JSON.parse(content);
  
  // Add selected property to each keyword
  if (keywordsData.keywords && Array.isArray(keywordsData.keywords)) {
    keywordsData.keywords = keywordsData.keywords.map((keyword) => ({
      ...keyword,
      selected: true
    }));
  }
  
  return keywordsData;
} 