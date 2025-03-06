// Netlify Edge Function for content generation
export default async (request, context) => {
  // Use a higher timeout for this function
  context.waitUntil(new Promise(resolve => setTimeout(resolve, 60000))); // 60 second timeout

  // Forward the request to the Next.js API route
  const url = new URL(request.url);
  url.pathname = '/api/generate';
  
  return fetch(url.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body
  });
}; 