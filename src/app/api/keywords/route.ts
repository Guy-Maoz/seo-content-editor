import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Change from static to dynamic to ensure proper API functionality
export const dynamic = 'force-dynamic';
export const revalidate = false;

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

export async function POST(request: Request) {
  try {
    const { topic } = await request.json();

    if (!topic) {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      );
    }

    // Step 1: Generate keywords using OpenAI
    const keywordsFromOpenAI = await generateKeywordsWithOpenAI(topic);
    
    if (!keywordsFromOpenAI || !keywordsFromOpenAI.keywords || keywordsFromOpenAI.keywords.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate keywords' },
        { status: 500 }
      );
    }

    // Step 2: Try to enrich keywords with SimilarWeb metrics
    try {
      console.log(`Enriching ${keywordsFromOpenAI.keywords.length} keywords with SimilarWeb data`);
      const enrichedKeywords = await enrichKeywordsWithSimilarWeb(keywordsFromOpenAI.keywords);
      return NextResponse.json({ keywords: enrichedKeywords });
    } catch (similarWebError) {
      console.error('Error enriching keywords with SimilarWeb:', similarWebError);
      // If SimilarWeb enrichment fails, return the OpenAI keywords as is
      return NextResponse.json(keywordsFromOpenAI);
    }
  } catch (error) {
    console.error('Error in keywords API:', error);
    return NextResponse.json(
      { error: 'Failed to generate keywords' },
      { status: 500 }
    );
  }
}

async function generateKeywordsWithOpenAI(topic: string) {
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
    keywordsData.keywords = keywordsData.keywords.map((keyword: any) => ({
      ...keyword,
      selected: true
    }));
  }
  
  return keywordsData;
}

// Helper function to delay execution (for rate limiting)
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function enrichKeywordsWithSimilarWeb(keywords: any[]) {
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
      await delay(500);
    } catch (error) {
      console.error(`Error enriching keyword "${keyword.keyword}":`, error);
      // If there's an error, return the original keyword
      enrichedKeywords.push({
        ...keyword,
        source: 'openai_error' // Add a source flag to track where the data came from
      });
      
      // Still add a delay even after an error
      await delay(500);
    }
  }
  
  return enrichedKeywords;
}

async function getKeywordMetricsFromSimilarWeb(keyword: string) {
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
  
  console.log(`Generated fallback metrics for "${keyword}": volume=${volume}, difficulty=${difficulty}, cpc=${cpc}`);
  
  return {
    volume,
    difficulty,
    cpc: parseFloat(cpc),
    isFallback: true // Flag to indicate this is fallback data
  };
} 