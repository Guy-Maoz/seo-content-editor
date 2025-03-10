const { OpenAI } = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// SimilarWeb API configuration
const SIMILARWEB_API_KEY = process.env.SIMILARWEB_API_KEY;
if (!SIMILARWEB_API_KEY) {
  console.error('SIMILARWEB_API_KEY environment variable is not set');
}
const SIMILARWEB_BASE_URL = 'https://api.similarweb.com/v4';

// Helper function to delay execution (for rate limiting)
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

exports.handler = async function(event, context) {
  // Log every request to help debug
  console.log('📥 Keywords function called with payload:', event.body);

  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    console.log('❌ Method not allowed:', event.httpMethod);
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
    // Parse request body with better error handling
    let requestData;
    try {
      if (typeof event.body === 'string') {
        requestData = JSON.parse(event.body);
        console.log('✅ Successfully parsed request body:', JSON.stringify(requestData));
      } else if (typeof event.body === 'object') {
        requestData = event.body;
        console.log('✅ Request body is already an object:', JSON.stringify(requestData));
      } else {
        throw new Error(`Invalid body type: ${typeof event.body}`);
      }
    } catch (parseError) {
      console.error('❌ Error parsing request body:', parseError, 'Raw body:', event.body);
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: "Invalid JSON in request body", 
          details: parseError.message,
          receivedBody: typeof event.body === 'string' ? event.body.substring(0, 100) + '...' : typeof event.body
        }),
        headers: { "Content-Type": "application/json" }
      };
    }

    const { topic, count = 10, threadId } = requestData || {};

    if (!topic) {
      console.log('❌ Missing topic in request');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Topic is required" }),
        headers: { "Content-Type": "application/json" }
      };
    }

    console.log(`🔍 Processing keywords request for topic: "${topic}"`);

    // Step 1: Generate keywords using OpenAI
    console.log('🤖 Calling OpenAI API for keyword suggestions...');
    const keywordsFromOpenAI = await generateKeywordsWithOpenAI(topic);
    
    if (!keywordsFromOpenAI || !keywordsFromOpenAI.keywords || keywordsFromOpenAI.keywords.length === 0) {
      console.log('❌ Failed to generate keywords from OpenAI');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to generate keywords" }),
        headers: { "Content-Type": "application/json" }
      };
    }

    console.log(`✅ Successfully generated ${keywordsFromOpenAI.keywords.length} keywords from OpenAI`);

    // Step 2: Try to enrich keywords with SimilarWeb metrics
    try {
      console.log(`🔍 Enriching ${keywordsFromOpenAI.keywords.length} keywords with SimilarWeb data`);
      const enrichedKeywords = await enrichKeywordsWithSimilarWeb(keywordsFromOpenAI.keywords);
      console.log('✅ Successfully enriched keywords with SimilarWeb data');
      
      return {
        statusCode: 200,
        body: JSON.stringify({ keywords: enrichedKeywords }),
        headers: { "Content-Type": "application/json" }
      };
    } catch (similarWebError) {
      console.error('⚠️ Error enriching keywords with SimilarWeb:', similarWebError);
      // If SimilarWeb enrichment fails, return the OpenAI keywords as is
      console.log('Falling back to OpenAI keyword data without SimilarWeb metrics');
      return {
        statusCode: 200,
        body: JSON.stringify(keywordsFromOpenAI),
        headers: { "Content-Type": "application/json" }
      };
    }
  } catch (error) {
    console.error('❌ Unhandled error in keywords function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Failed to generate keywords", 
        details: error.message,
        stack: error.stack
      }),
      headers: { "Content-Type": "application/json" }
    };
  }
};

async function generateKeywordsWithOpenAI(topic) {
  try {
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
      keywordsData.keywords = keywordsData.keywords.map((keyword) => ({
        ...keyword,
        selected: true
      }));
    }
    
    return keywordsData;
  } catch (error) {
    console.error('Error generating keywords with OpenAI:', error);
    throw error;
  }
}

async function enrichKeywordsWithSimilarWeb(keywords) {
  // Process keywords sequentially with a delay to avoid rate limiting
  const enrichedKeywords = [];
  
  for (const keyword of keywords) {
    try {
      console.log(`Fetching SimilarWeb data for keyword: "${keyword.keyword}"`);
      const metrics = await getKeywordMetricsFromSimilarWeb(keyword.keyword);
      
      // If we got metrics, update the keyword object
      if (metrics) {
        console.log(`✅ Got SimilarWeb data for "${keyword.keyword}": volume=${metrics.volume}, difficulty=${metrics.difficulty}, cpc=${metrics.cpc}`);
        enrichedKeywords.push({
          ...keyword,
          volume: metrics.volume || keyword.volume,
          difficulty: metrics.difficulty || keyword.difficulty,
          cpc: metrics.cpc || keyword.cpc,
          source: metrics.isFallback ? 'fallback' : 'similarweb' // Track the data source
        });
      } else {
        console.log(`❌ No SimilarWeb data for "${keyword.keyword}", using OpenAI estimates`);
        enrichedKeywords.push({
          ...keyword,
          source: 'openai' // Add a source flag to track where the data came from
        });
      }
      
      // Add a small delay between API calls to avoid rate limiting
      await delay(200);
    } catch (error) {
      console.error(`Error enriching keyword "${keyword.keyword}":`, error);
      // If there's an error, return the original keyword
      enrichedKeywords.push({
        ...keyword,
        source: 'openai_error' // Add a source flag to track where the data came from
      });
      
      // Still add a delay even after an error
      await delay(200);
    }
  }
  
  return enrichedKeywords;
}

async function getKeywordMetricsFromSimilarWeb(keyword) {
  try {
    // Format the keyword for the URL
    const encodedKeyword = encodeURIComponent(keyword);
    
    // Construct the API URL for the Keywords Overview endpoint
    const url = `${SIMILARWEB_BASE_URL}/keywords/${encodedKeyword}/analysis/overview?api_key=${SIMILARWEB_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`SimilarWeb API returned ${response.status} for "${keyword}"`);
      // If we get an error, return a generated fallback instead of null
      return generateFallbackMetrics(keyword);
    }
    
    const data = await response.json();
    
    // Handle different possible response structures
    if (data && data.data) {
      // First structure type
      return {
        volume: data.data.volume || 0,
        difficulty: Math.round((data.data.organic_difficulty || 0) * 100) / 100,
        cpc: data.data.cpc_range?.high_bid || data.data.cpc_range?.low_bid || 0
      };
    } else if (data && data.response) {
      // Alternative structure type
      return {
        volume: data.response.volume || 0,
        difficulty: Math.round((data.response.organic_difficulty || 0) * 100) / 100,
        cpc: data.response.cpc?.highest || data.response.cpc?.average || 0
      };
    } else if (data) {
      // Directly on data object
      return {
        volume: data.volume || 0,
        difficulty: Math.round((data.organic_difficulty || 0) * 100) / 100,
        cpc: data.cpc?.highest || data.cpc?.average || 0
      };
    }
    
    // If none of the structures match, return a generated fallback
    return generateFallbackMetrics(keyword);
  } catch (error) {
    console.error(`Error fetching SimilarWeb metrics for "${keyword}":`, error);
    // Generate realistic fallback data instead of returning null
    return generateFallbackMetrics(keyword);
  }
}

// Function to generate realistic fallback metrics based on keyword characteristics
function generateFallbackMetrics(keyword) {
  // Generate deterministic but realistic metrics based on keyword length and composition
  const wordCount = keyword.split(' ').length;
  const charCount = keyword.length;
  
  // Longer keywords tend to have lower volume but less competition
  const baseVolume = 2000 - (wordCount * 300);
  const volume = Math.max(100, Math.min(3000, baseVolume + (keyword.length % 5) * 50));
  
  // Longer, more specific keywords typically have lower difficulty
  const baseDifficulty = 80 - (wordCount * 5);
  const difficulty = Math.max(20, Math.min(90, baseDifficulty + (charCount % 10)));
  
  // CPC often correlates with competition/difficulty
  const cpc = (difficulty / 30 + Math.random()).toFixed(2);
  
  console.log(`Generated fallback metrics for "${keyword}": volume=${volume}, difficulty=${difficulty}, cpc=${cpc}`);
  
  return {
    volume,
    difficulty,
    cpc: parseFloat(cpc),
    isFallback: true // Flag to indicate this is fallback data
  };
} 