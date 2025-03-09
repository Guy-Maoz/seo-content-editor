/**
 * Utility to get the correct API endpoint based on the current environment
 * In development, we use the local Next.js API routes
 * In production, we use Netlify serverless functions
 */

/**
 * Map of API endpoints between environments
 */
const API_ENDPOINT_MAP: Record<string, string> = {
  // Keywords
  '/api/keywords/ai': '/.netlify/functions/keywords-ai',
  '/api/keywords/single': '/.netlify/functions/keywords-single',
  '/api/keywords/more': '/.netlify/functions/keywords-more',
  '/api/keywords/extract': '/.netlify/functions/keywords-extract',
  
  // Content
  '/api/content/generate': '/.netlify/functions/content-generate',
  
  // Tools
  '/api/tools/handler': '/.netlify/functions/tools-handler',
  '/api/tools/diagnostic': '/.netlify/functions/tools-diagnostic',
  '/api/tools/keyword-metrics': '/.netlify/functions/tools-keyword-metrics',
};

/**
 * Get the correct API endpoint based on the environment
 * @param endpoint The Next.js API endpoint path
 * @returns The correct endpoint for the current environment
 */
export function getApiEndpoint(endpoint: string): string {
  // Determine if we're in production (Netlify) or development
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction && endpoint in API_ENDPOINT_MAP) {
    return API_ENDPOINT_MAP[endpoint];
  }
  
  // In development, use the local Next.js API routes
  return endpoint;
}

/**
 * Enhanced fetch function that uses the correct API endpoint
 * @param endpoint The API endpoint path (using Next.js API format)
 * @param options Fetch options
 * @returns Fetch response
 */
export async function apiFetch(endpoint: string, options?: RequestInit): Promise<Response> {
  const url = getApiEndpoint(endpoint);
  return fetch(url, options);
} 