import { NextResponse } from 'next/server';

// Add these exports to make the route compatible with static export
export const dynamic = 'force-static';
export const revalidate = false;



// SimilarWeb API configuration
const SIMILARWEB_API_KEY = process.env.SIMILARWEB_API_KEY;
if (!SIMILARWEB_API_KEY) {
  console.error('SIMILARWEB_API_KEY environment variable is not set');
}
const SIMILARWEB_BASE_URL = 'https://api.similarweb.com/v4';

export async function GET(request: Request) {
  try {
    // Get the keyword from the URL query parameters
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || 'digital marketing';
    
    // Log the API key (first few characters for security)
    const apiKeyPrefix = SIMILARWEB_API_KEY ? SIMILARWEB_API_KEY.substring(0, 5) + '...' : 'NOT_SET';
    console.log(`Using SimilarWeb API key: ${apiKeyPrefix}`);
    
    // Format the keyword for the URL
    const encodedKeyword = encodeURIComponent(keyword);
    
    // Construct the API URL for the Keywords Overview endpoint
    const url = `${SIMILARWEB_BASE_URL}/keywords/${encodedKeyword}/analysis/overview?api_key=${SIMILARWEB_API_KEY}`;
    console.log(`Calling SimilarWeb API: ${SIMILARWEB_BASE_URL}/keywords/${encodedKeyword}/analysis/overview?api_key=***`);
    
    // Make the API call
    const response = await fetch(url);
    
    // Log the response status
    console.log(`SimilarWeb API response status: ${response.status}`);
    
    if (!response.ok) {
      // If the response is not OK, return the error details
      const errorText = await response.text();
      return NextResponse.json({
        success: false,
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url: SIMILARWEB_API_KEY ? url.replace(SIMILARWEB_API_KEY, '***') : url,
      }, { status: response.status });
    }
    
    // Parse the response JSON
    const data = await response.json();
    
    // Return the response data
    return NextResponse.json({
      success: true,
      keyword,
      data,
    });
  } catch (error) {
    console.error('Error testing SimilarWeb API:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
} 