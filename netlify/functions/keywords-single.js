// SimilarWeb API configuration
const SIMILARWEB_API_KEY = process.env.SIMILARWEB_API_KEY;
if (!SIMILARWEB_API_KEY) {
  console.error('SIMILARWEB_API_KEY environment variable is not set');
}
const SIMILARWEB_BASE_URL = 'https://api.similarweb.com/v4';

exports.handler = async function(event, context) {
  // Log every request to help debug
  console.log('📥 Keywords-single function called with payload:', event.body);

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
    // Robust body parsing with logging for debugging
    let requestData;
    try {
      // Log the raw request to help debug
      const requestText = event.body;
      console.log('Raw request body:', requestText);
      
      // Better parsing logic for different body types
      if (typeof requestText === 'string') {
        if (requestText && requestText.trim()) {
          requestData = JSON.parse(requestText);
          console.log('✅ Successfully parsed request body:', JSON.stringify(requestData));
        } else {
          throw new Error('Empty request body');
        }
      } else if (typeof requestText === 'object') {
        requestData = requestText;
        console.log('✅ Request body is already an object:', JSON.stringify(requestData));
      } else {
        throw new Error(`Invalid body type: ${typeof requestText}`);
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
    
    const { keyword } = requestData || {};

    if (!keyword) {
      console.log('❌ Missing keyword in request');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Keyword is required" }),
        headers: { "Content-Type": "application/json" }
      };
    }

    // DIRECT CONSOLE OUTPUT - will always show in terminal
    console.log(`\n\n======== KEYWORD REQUEST: "${keyword}" ========`);
    console.log(`🔍 Processing keyword request: "${keyword}"`);
    
    // Get metrics for this keyword from SimilarWeb
    const metrics = await getKeywordMetricsFromSimilarWeb(keyword);
    
    // Log the outcome in a way that's visible in Netlify logs
    if (metrics.isFallback) {
      console.log(`\n⚠️⚠️⚠️ FALLBACK USED for "${keyword}": API failed ⚠️⚠️⚠️`);
    } else if (metrics.volume === 0) {
      console.log(`ℹ️ Zero volume found for "${keyword}": This keyword has no search traffic according to SimilarWeb`);
    } else {
      console.log(`✅ Real data found for "${keyword}": volume=${metrics.volume}`);
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        keyword,
        metrics,
        success: !!metrics,
        isFallback: metrics.isFallback || false
      }),
      headers: { "Content-Type": "application/json" }
    };
  } catch (error) {
    console.error('❌ Unhandled error in keywords-single function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Failed to fetch keyword metrics", 
        details: error.message,
        stack: error.stack
      }),
      headers: { "Content-Type": "application/json" }
    };
  }
};

async function getKeywordMetricsFromSimilarWeb(keyword) {
  try {
    // Format the keyword for the URL
    const encodedKeyword = encodeURIComponent(keyword);
    
    // Construct the API URL for the Keywords Overview endpoint
    const url = `${SIMILARWEB_BASE_URL}/keywords/${encodedKeyword}/analysis/overview?api_key=${SIMILARWEB_API_KEY}`;
    
    console.log(`Fetching SimilarWeb data for keyword: "${keyword}"`);
    const response = await fetch(url);
    
    if (!response.ok) {
      console.log(`SimilarWeb API returned ${response.status} for "${keyword}"`);
      // If we get an error, return a generated fallback instead of null
      return generateFallbackMetrics(keyword);
    }
    
    const data = await response.json();
    let metrics;
    
    // Handle different possible response structures
    if (data && data.data) {
      // First structure type
      metrics = {
        volume: data.data.volume || 0,
        difficulty: Math.round((data.data.organic_difficulty || 0) * 100) / 100,
        cpc: data.data.cpc_range?.high_bid || data.data.cpc_range?.low_bid || 0,
        isFallback: false
      };
    } else if (data && data.response) {
      // Alternative structure type
      metrics = {
        volume: data.response.volume || 0,
        difficulty: Math.round((data.response.organic_difficulty || 0) * 100) / 100,
        cpc: data.response.cpc?.highest || data.response.cpc?.average || 0,
        isFallback: false
      };
    } else if (data) {
      // Directly on data object
      metrics = {
        volume: data.volume || 0,
        difficulty: Math.round((data.organic_difficulty || 0) * 100) / 100,
        cpc: data.cpc?.highest || data.cpc?.average || 0,
        isFallback: false
      };
    } else {
      // If no valid data structure, use fallback
      return generateFallbackMetrics(keyword);
    }
    
    // Only use fallback if we have near-zero values across all metrics (likely API error)
    // But keep actual zero volume as real data
    if (metrics.volume < 10 && metrics.difficulty === 0 && metrics.cpc === 0) {
      console.log(`SimilarWeb API returned near-zeros for "${keyword}" - using fallback instead`);
      return generateFallbackMetrics(keyword);
    }
    
    return metrics;
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
  
  console.log(`FALLBACK DATA GENERATED for "${keyword}": volume=${volume}, difficulty=${difficulty}, cpc=${cpc}`);
  
  return {
    volume,
    difficulty,
    cpc: parseFloat(cpc),
    isFallback: true // Flag to indicate this is fallback data
  };
} 