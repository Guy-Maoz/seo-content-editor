import { NextResponse } from 'next/server';

// Change static to dynamic for API routes
export const dynamic = 'force-dynamic';
export const revalidate = false;



// Add a helper function to print colored messages to console
function logWarning(message: string) {
  // Use bright yellow with bold text and multiple warning symbols
  console.log('\x1b[1;33m%s\x1b[0m', `⚠️⚠️⚠️ ${message} ⚠️⚠️⚠️`);
  
  // Also log to standard error for extra visibility
  console.error(`FALLBACK WARNING: ${message}`);
}

// SimilarWeb API configuration
const SIMILARWEB_API_KEY = process.env.SIMILARWEB_API_KEY;
if (!SIMILARWEB_API_KEY) {
  console.error('SIMILARWEB_API_KEY environment variable is not set');
}
const SIMILARWEB_BASE_URL = 'https://api.similarweb.com/v4';

export async function POST(request: Request) {
  try {
    // Add more robust request body handling
    let requestData;
    try {
      // Log the raw request to help debug
      const requestText = await request.text();
      console.log('Raw request body:', requestText);
      
      // Try to parse if not empty
      if (requestText && requestText.trim()) {
        requestData = JSON.parse(requestText);
      } else {
        throw new Error('Empty request body');
      }
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body', details: parseError.message },
        { status: 400 }
      );
    }
    
    const { keyword } = requestData || {};

    if (!keyword) {
      return NextResponse.json(
        { error: 'Keyword is required' },
        { status: 400 }
      );
    }

    // DIRECT CONSOLE OUTPUT - will always show in terminal
    console.log(`\n\n======== KEYWORD REQUEST: "${keyword}" ========`);
    
    // Log the start of processing - always visible
    console.log(`\x1b[36m%s\x1b[0m`, `🔍 Processing keyword request: "${keyword}"`);
    
    // Get metrics for this keyword from SimilarWeb
    const metrics = await getKeywordMetricsFromSimilarWeb(keyword);
    
    // Force manual console.error to ensure it shows in terminal
    if (metrics.isFallback) {
      // This will DEFINITELY show in terminal
      console.error(`\n⚠️⚠️⚠️ FALLBACK USED for "${keyword}": API failed ⚠️⚠️⚠️`);
      
      // Normal warning that might be affected by logger settings
      logWarning(`FALLBACK DATA USED for "${keyword}": volume=${metrics.volume}, difficulty=${metrics.difficulty}, cpc=${metrics.cpc}`);
    } else if (metrics.volume === 0) {
      // Special note when real value is zero
      console.log(`\x1b[33m%s\x1b[0m`, `ℹ️ Zero volume found for "${keyword}": This keyword has no search traffic according to SimilarWeb`);
    } else {
      console.log(`✅ Real data found for "${keyword}": volume=${metrics.volume}`);
    }
    
    return NextResponse.json({ 
      keyword,
      metrics,
      success: !!metrics,
      isFallback: metrics.isFallback || false
    });
  } catch (error) {
    console.error('Error fetching keyword metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keyword metrics', details: error.message },
      { status: 500 }
    );
  }
}

async function getKeywordMetricsFromSimilarWeb(keyword: string) {
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
function generateFallbackMetrics(keyword: string) {
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
  
  // Make the fallback message very visible in the terminal
  logWarning(`FALLBACK DATA GENERATED for "${keyword}": volume=${volume}, difficulty=${difficulty}, cpc=${cpc}`);
  
  return {
    volume,
    difficulty,
    cpc: parseFloat(cpc),
    isFallback: true // Flag to indicate this is fallback data
  };
} 