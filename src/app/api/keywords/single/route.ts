import { NextResponse } from 'next/server';

// SimilarWeb API configuration
const SIMILARWEB_API_KEY = process.env.SIMILARWEB_API_KEY || 'd14923977f194036a9c41c5d924fd9ec';
const SIMILARWEB_BASE_URL = 'https://api.similarweb.com/v4';

export async function POST(request: Request) {
  try {
    const { keyword } = await request.json();

    if (!keyword) {
      return NextResponse.json(
        { error: 'Keyword is required' },
        { status: 400 }
      );
    }

    // Get metrics for this keyword from SimilarWeb
    const metrics = await getKeywordMetricsFromSimilarWeb(keyword);
    
    return NextResponse.json({ 
      keyword,
      metrics,
      success: !!metrics
    });
  } catch (error) {
    console.error('Error fetching keyword metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keyword metrics' },
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
      // If we get a 404 or other error, just return null instead of throwing
      return null;
    }
    
    const data = await response.json();
    
    // Extract and return the metrics - updated to match the actual response format
    if (data && data.data) {
      return {
        volume: data.data.volume || 0,
        difficulty: Math.round((data.data.organic_difficulty || 0) * 100) / 100,
        cpc: data.data.cpc_range?.high_bid || data.data.cpc_range?.low_bid || 0
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching SimilarWeb metrics for "${keyword}":`, error);
    return null;
  }
} 