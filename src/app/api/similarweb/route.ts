import { NextResponse } from 'next/server';

// Add these exports to make the route compatible with static export
export const dynamic = 'force-static';
export const revalidate = false;


// Add a helper function to print colored messages to console
function logWarning(message: string) {
  // Use bright yellow with bold text and multiple warning symbols
  console.log('\x1b[1;33m%s\x1b[0m', `⚠️⚠️⚠️ ${message} ⚠️⚠️⚠️`);
  
  // Also log to standard error for extra visibility
  console.error(`FALLBACK WARNING: ${message}`);
}

// API key for Similarweb
const SIMILARWEB_API_KEY = 'd14923977f194036a9c41c5d924fd9ec';
const SIMILARWEB_BASE_URL = 'https://api.similarweb.com/v4';

export async function POST(request: Request) {
  try {
    const { topic } = await request.json();

    if (!topic) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      );
    }

    // Log the start of processing - always visible
    console.log(`\x1b[36m%s\x1b[0m`, `🔍 Processing similarweb request: "${topic}"`);

    // Fetch keyword metrics from Similarweb API
    const keywordMetrics = await getKeywordMetrics(topic);

    // Check if fallback was used
    if (keywordMetrics.keywords.some(k => k.isFallback)) {
      logWarning(`FALLBACK METRICS USED for "${topic}"`);
    }

    return NextResponse.json(keywordMetrics);
  } catch (error) {
    console.error('Error fetching keyword metrics from Similarweb:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keyword metrics' },
      { status: 500 }
    );
  }
}

async function getKeywordMetrics(keyword: string) {
  try {
    // Format the keyword for the URL
    const encodedKeyword = encodeURIComponent(keyword);
    
    // Construct the API URL
    const url = `${SIMILARWEB_BASE_URL}/keywords/${encodedKeyword}/analysis/overview?api_key=${SIMILARWEB_API_KEY}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Similarweb API returned status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Transform the data into the format needed for our application
    const keywordsData = transformSimilarwebData(data, keyword);
    
    return keywordsData;
  } catch (error) {
    console.error('Error in Similarweb API call:', error);
    // Create fallback data and log clearly that we're using it
    logWarning(`SIMILARWEB API FALLBACK USED for "${keyword}"`);
    return {
      keywords: [{
        keyword: keyword,
        volume: 1000, // Fallback value
        difficulty: 50, // Fallback value
        cpc: 0.5, // Fallback value
        selected: true,
        isFallback: true
      }]
    };
  }
}

function transformSimilarwebData(data: any, mainKeyword: string) {
  // Check if we have valid data
  if (!data || !data.response) {
    logWarning(`No valid response data from SimilarWeb for "${mainKeyword}" - using fallback`);
    return { 
      keywords: [{
        keyword: mainKeyword,
        volume: 1000,
        difficulty: 50,
        cpc: 0.5,
        selected: true,
        isFallback: true
      }] 
    };
  }

  const keywordData = data.response;
  
  // Don't treat zero volume as fallback anymore
  const isEffectivelyFallback = false;
  
  if (keywordData.volume === 0) {
    console.log(`Zero volume data from SimilarWeb for "${mainKeyword}" - keeping as real data`);
  }
  
  // Create a formatted keyword object
  const formattedKeyword = {
    keyword: mainKeyword,
    volume: keywordData.volume || 0,
    difficulty: Math.round((keywordData.organic_difficulty || 0) * 100),
    cpc: keywordData.cpc?.highest || 0,
    selected: true,
    isFallback: isEffectivelyFallback
  };
  
  // Related keywords might not be directly available in this endpoint
  // If we need related keywords, a separate call would be needed
  
  return {
    keywords: [formattedKeyword]
  };
} 