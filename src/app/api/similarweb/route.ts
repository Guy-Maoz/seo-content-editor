import { NextResponse } from 'next/server';

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

    // Fetch keyword metrics from Similarweb API
    const keywordMetrics = await getKeywordMetrics(topic);

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
    throw error;
  }
}

function transformSimilarwebData(data: any, mainKeyword: string) {
  // Check if we have valid data
  if (!data || !data.response) {
    return { keywords: [] };
  }

  const keywordData = data.response;
  
  // Create a formatted keyword object
  const formattedKeyword = {
    keyword: mainKeyword,
    volume: keywordData.volume || 0,
    difficulty: Math.round((keywordData.organic_difficulty || 0) * 100),
    cpc: keywordData.cpc?.highest || 0,
    selected: true
  };
  
  // Related keywords might not be directly available in this endpoint
  // If we need related keywords, a separate call would be needed
  
  return {
    keywords: [formattedKeyword]
  };
} 