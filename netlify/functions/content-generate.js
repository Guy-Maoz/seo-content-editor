const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    const body = JSON.parse(event.body);
    const { topic, keywords, existingContent, isUpdate } = body;

    if (!topic || !keywords || keywords.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields: topic and keywords" }),
        headers: { "Content-Type": "application/json" }
      };
    }

    console.log(`Generating ${isUpdate ? 'updated' : 'new'} content for topic: "${topic}" with ${keywords.length} keywords`);
    
    const prompt = isUpdate
      ? generateUpdatePrompt(topic, keywords, existingContent)
      : generateNewPrompt(topic, keywords);

    // Log the start of the API request
    console.log(`Sending request to OpenAI for content generation (${prompt.length} chars)`);
    
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: `You are an expert SEO content writer. You create engaging, informative, and high-quality content that utilizes keywords naturally while providing real value to readers.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2500,
      });

      if (!completion.choices[0]?.message?.content) {
        console.error('Empty response from OpenAI content generation');
        return {
          statusCode: 500,
          body: JSON.stringify({ 
            content: existingContent || '',
            error: "Failed to generate content - empty response" 
          }),
          headers: { "Content-Type": "application/json" }
        };
      }

      const generatedContent = completion.choices[0].message.content;
      console.log(`Successfully generated content (${generatedContent.length} chars)`);

      return {
        statusCode: 200,
        body: JSON.stringify({ content: generatedContent }),
        headers: { "Content-Type": "application/json" }
      };
    } catch (apiError) {
      console.error('OpenAI API error:', apiError);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: "OpenAI API error: " + apiError.message,
          content: existingContent || '' 
        }),
        headers: { "Content-Type": "application/json" }
      };
    }
  } catch (error) {
    console.error('Error generating content:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to generate content" }),
      headers: { "Content-Type": "application/json" }
    };
  }
};

function generateNewPrompt(topic, keywords) {
  return `
Write a high-quality, SEO-optimized article about "${topic}".

Please incorporate the following keywords naturally throughout the content:
${keywords.map(kw => `- ${kw}`).join('\n')}

Guidelines:
- Create a compelling headline (H1) that includes the primary keyword
- Use proper heading structure (H2, H3) to organize the content
- Write at least 700-1000 words of comprehensive content
- Include an introduction that hooks the reader and explains what they'll learn
- Provide practical, actionable advice and information
- Incorporate keywords naturally without keyword stuffing
- Conclude with a summary and optionally a call to action
- Maintain a friendly, authoritative tone
- Format the content in HTML using proper heading tags, paragraphs, and lists
`;
}

function generateUpdatePrompt(topic, keywords, existingContent) {
  return `
I have an existing article about "${topic}". Please improve and enhance this content while ensuring all the following keywords are incorporated naturally:
${keywords.map(kw => `- ${kw}`).join('\n')}

Here's the existing content:
${existingContent}

Guidelines for improvement:
- Maintain the overall structure but enhance where needed
- Ensure all keywords are included naturally
- Improve flow, readability and engagement
- Add additional valuable information where appropriate
- Fix any grammatical or stylistic issues
- Maintain the HTML formatting with proper heading tags
- Return the complete improved article
`;
} 