// SimilarWeb API configuration
const SIMILARWEB_API_KEY = process.env.SIMILARWEB_API_KEY || 'd14923977f194036a9c41c5d924fd9ec';
const SIMILARWEB_BASE_URL = 'https://api.similarweb.com/v4';

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
    const { keyword } = JSON.parse(event.body);

    if (!keyword) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Keyword is required" }),
        headers: { "Content-Type": "application/json" }
      };
    }

    // Log the start of processing
    console.log(`Processing keyword request: "${keyword}"`);
    
    // Get metrics for this keyword from SimilarWeb
    const metrics = await getKeywordMetricsFromSimilarWeb(keyword);
    
    // Log fallback usage
    if (metrics.isFallback) {
      console.log(`FALLBACK USED for "${keyword}": API failed`);
    } else if (metrics.volume === 0) {
      console.log(`Zero volume found for "${keyword}": This keyword has no search traffic according to SimilarWeb`);
    } else {
      console.log(`Real data found for "${keyword}": volume=${metrics.volume}`);
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
    console.error('Error fetching keyword metrics:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch keyword metrics" }),
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