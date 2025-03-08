import { NextResponse } from 'next/server';
import { KeywordMetricsResponse, SimilarwebKeywordMetrics } from '@/types/api';

// Add these exports to make the route compatible with static export
export const dynamic = 'force-static';
export const revalidate = false;



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
    
    const response: KeywordMetricsResponse = {
      keyword,
      volume: metrics.volume,
      difficulty: metrics.difficulty,
      cpc: metrics.cpc,
      isFallback: metrics.isFallback || false
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching keyword metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keyword metrics' },
      { status: 500 }
    );
  }
}

async function getKeywordMetricsFromSimilarWeb(keyword: string): Promise<SimilarwebKeywordMetrics> {
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
        cpc: data.data.cpc_range?.high_bid || data.data.cpc_range?.low_bid || 0
      };
    } else if (data && data.response) {
      // Alternative structure type
      metrics = {
        volume: data.response.volume || 0,
        difficulty: Math.round((data.response.organic_difficulty || 0) * 100) / 100,
        cpc: data.response.cpc?.highest || data.response.cpc?.average || 0
      };
    } else if (data) {
      // Directly on data object
      metrics = {
        volume: data.volume || 0,
        difficulty: Math.round((data.organic_difficulty || 0) * 100) / 100,
        cpc: data.cpc?.highest || data.cpc?.average || 0
      };
    } else {
      // If no valid data structure, use fallback
      return generateFallbackMetrics(keyword);
    }
    
    // Only use fallback if we have zeros across all metrics AND we suspect it's an API error
    // Keep actual zero volume as real data
    if (metrics.volume === 0 && metrics.difficulty === 0 && metrics.cpc === 0) {
      console.log(`Zero metrics found for "${keyword}" - using real values not fallback`);
      metrics.isFallback = false;
    }
    
    return metrics;
  } catch (error) {
    console.error(`Error fetching SimilarWeb metrics for "${keyword}":`, error);
    // Generate realistic fallback data instead of returning null
    return generateFallbackMetrics(keyword);
  }
}

// Function to generate realistic fallback metrics based on keyword characteristics
function generateFallbackMetrics(keyword: string): SimilarwebKeywordMetrics {
  // Generate deterministic but realistic metrics based on keyword length and composition
  const wordCount = keyword.split(' ').length;
  const charCount = keyword.length;
  
  // Japanese knives keywords tend to have decent volume
  let baseVolume = 0;
  
  // Set base volumes for common knife types
  if (keyword.toLowerCase().includes('japanese chef knives')) {
    baseVolume = 4500;
  } else if (keyword.toLowerCase().includes('santoku')) {
    baseVolume = 6000;
  } else if (keyword.toLowerCase().includes('nakiri')) {
    baseVolume = 2500;
  } else if (keyword.toLowerCase().includes('gyuto')) {
    baseVolume = 2000;
  } else if (keyword.toLowerCase().includes('japanese')) {
    baseVolume = 3500;
  } else {
    // Longer keywords tend to have lower volume
    baseVolume = 2000 - (wordCount * 300);
  }
  
  const volume = Math.max(100, Math.min(10000, baseVolume + (keyword.length % 5) * 50));
  
  // Longer, more specific keywords typically have lower difficulty
  const baseDifficulty = 80 - (wordCount * 5);
  const difficulty = Math.max(20, Math.min(90, baseDifficulty + (charCount % 10)));
  
  // CPC often correlates with competition/difficulty
  const cpc = (difficulty / 30 + Math.random()).toFixed(2);
  
  // Make the fallback message more visible in the terminal
  console.log('\x1b[33m%s\x1b[0m', `⚠️ ASSISTANT TOOL FALLBACK DATA USED for "${keyword}": volume=${volume}, difficulty=${difficulty}, cpc=${cpc}`);
  
  return {
    volume,
    difficulty,
    cpc: parseFloat(cpc),
    isFallback: true // Flag to indicate this is fallback data
  };
} 