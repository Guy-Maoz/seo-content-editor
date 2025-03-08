const { OpenAI } = require("openai");

// Define the test tool for diagnostics
const TOOL = {
  type: "function",
  function: {
    name: "get_keyword_metrics",
    description: "Get search volume, SEO difficulty, and cost-per-click data for a specific keyword from Similarweb",
    parameters: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "The keyword to look up metrics for (e.g., 'best running shoes')"
        }
      },
      required: ["keyword"]
    }
  }
};

exports.handler = async function(event, context) {
  // Set a longer function timeout
  context.callbackWaitsForEmptyEventLoop = false;

  // Only allow GET requests
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
      headers: {
        "Allow": "GET",
        "Content-Type": "application/json"
      }
    };
  }

  try {
    // Parse query parameters
    const params = event.queryStringParameters || {};
    const assistantId = params.assistant_id || 'asst_JXBmxj6nBTPncEpjwJmtzLTr';
    const testKeyword = params.keyword || 'test keyword';
    
    // Create OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Get the assistant to check if it exists
    let assistant;
    try {
      assistant = await openai.beta.assistants.retrieve(assistantId);
    } catch (error) {
      return {
        statusCode: 404,
        body: JSON.stringify({ 
          status: 'error',
          message: `Assistant with ID ${assistantId} not found`,
          error: error.message || 'Unknown error'
        }),
        headers: { "Content-Type": "application/json" }
      };
    }
    
    // Create a thread for testing
    const thread = await openai.beta.threads.create();
    
    // Add a diagnostic message to the thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: `This is a diagnostic test. Please use the get_keyword_metrics tool to look up data for the keyword: "${testKeyword}". Only return the raw data from the tool.`
    });
    
    // Run the assistant with our test tool
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
      tools: [TOOL]
    });
    
    // Set up polling to check for tool calls
    let runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
    let attempts = 0;
    const maxAttempts = 15; // Reduced to avoid timeouts
    let toolCalled = false;
    let toolCallId = undefined;
    let toolCallResult = null;
    
    // Poll for run status
    while (attempts < maxAttempts && 
           runStatus.status !== 'completed' && 
           runStatus.status !== 'failed' && 
           runStatus.status !== 'cancelled') {
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
      
      // Update run status
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      console.log(`Diagnostic run status: ${runStatus.status} (Attempt ${attempts}/${maxAttempts})`);
      
      // Check if the assistant is requesting to use the tool
      if (runStatus.status === 'requires_action') {
        toolCalled = true;
        
        // Get the tool calls from the run
        const toolCalls = runStatus.required_action?.submit_tool_outputs?.tool_calls;
        
        if (toolCalls && toolCalls.length > 0) {
          // Process the first tool call
          const toolCall = toolCalls[0];
          toolCallId = toolCall.id;
          
          if (toolCall.function.name === 'get_keyword_metrics') {
            // The assistant is using our tool!
            const args = JSON.parse(toolCall.function.arguments);
            
            // Set base URL to our Netlify functions
            const baseUrl = 'https://similarweb-content-seo.netlify.app';
            
            console.log(`Diagnostic calling keyword metrics API for: "${args.keyword}"`);
            
            // Call our keyword metrics API to get real data
            try {
              const keywordMetricsResponse = await fetch(`${baseUrl}/.netlify/functions/tools-keyword-metrics`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyword: args.keyword })
              });
              
              if (keywordMetricsResponse.ok) {
                toolCallResult = await keywordMetricsResponse.json();
                
                // Submit the tool output back to the assistant
                if (toolCallId) {
                  await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
                    tool_outputs: [{
                      tool_call_id: toolCallId,
                      output: JSON.stringify(toolCallResult)
                    }]
                  });
                }
              } else {
                const errorText = await keywordMetricsResponse.text();
                console.error(`Error calling keyword metrics API: ${errorText}`);
                
                // Submit an error if the API call failed
                if (toolCallId) {
                  await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
                    tool_outputs: [{
                      tool_call_id: toolCallId,
                      output: JSON.stringify({ error: "Failed to get keyword metrics", details: errorText })
                    }]
                  });
                }
              }
            } catch (fetchError) {
              console.error('Fetch error calling keyword metrics API:', fetchError);
              
              // Submit an error if the API call failed
              if (toolCallId) {
                await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
                  tool_outputs: [{
                    tool_call_id: toolCallId,
                    output: JSON.stringify({ 
                      error: "Failed to get keyword metrics",
                      details: fetchError.message
                    })
                  }]
                });
              }
            }
          } else {
            // The assistant tried to use a different tool
            if (toolCallId) {
              await openai.beta.threads.runs.submitToolOutputs(thread.id, run.id, {
                tool_outputs: [{
                  tool_call_id: toolCallId,
                  output: JSON.stringify({ error: "Unknown tool called" })
                }]
              });
            }
          }
        }
      }
    }
    
    // Get the final response from the assistant
    const messages = await openai.beta.threads.messages.list(thread.id);
    const assistantMessages = messages.data.filter(msg => msg.role === "assistant");
    let finalResponse = "";
    
    if (assistantMessages.length > 0) {
      const latestMessage = assistantMessages[0];
      for (const content of latestMessage.content) {
        if (content.type === "text") {
          finalResponse += content.text.value;
        }
      }
    }
    
    // Return a comprehensive diagnostic report
    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'success',
        assistant: {
          id: assistant.id,
          name: assistant.name,
          model: assistant.model
        },
        diagnostic_results: {
          test_completed: runStatus.status === 'completed',
          tool_was_called: toolCalled,
          tool_call_id: toolCallId,
          tool_call_result: toolCallResult,
          final_response: finalResponse,
          run_status: runStatus.status,
          attempts_made: attempts
        },
        thread_id: thread.id,
        run_id: run.id
      }),
      headers: { "Content-Type": "application/json" }
    };
    
  } catch (error) {
    console.error('Error in diagnostic tool:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        status: 'error',
        message: 'Diagnostic check failed',
        error: error.message || 'Unknown error'
      }),
      headers: { "Content-Type": "application/json" }
    };
  }
}; 