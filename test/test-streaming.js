// Import node-fetch as ESM
import fetch from 'node-fetch';

// Config
const API_URL = 'http://localhost:3001/api/chat';
const NUM_CONCURRENT_REQUESTS = 3;
const KEYWORDS = ['knife', 'kitchen knife', 'chef knife', 'cutting board'];
const THREAD_ID = null; // Set to null to create a new thread for each test

// Test function
async function testChatAPI() {
  console.log('Starting Chat API streaming test...');
  
  // Run multiple concurrent tests
  const promises = [];
  for (let i = 0; i < NUM_CONCURRENT_REQUESTS; i++) {
    promises.push(runTest(i));
  }
  
  try {
    await Promise.all(promises);
    console.log('All tests completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Individual test function
async function runTest(testId) {
  const keyword = KEYWORDS[testId % KEYWORDS.length];
  console.log(`[Test ${testId}] Starting test with keyword: ${keyword}`);
  
  try {
    // Make API request
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: `What is the search volume for "${keyword}"?`
          }
        ],
        threadId: THREAD_ID
      })
    });
    
    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }
    
    console.log(`[Test ${testId}] Connected to stream`);
    
    // Process the stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let receivedMessages = 0;
    let receivedToolResults = false;
    
    while (true) {
      const { value, done } = await reader.read();
      
      if (done) {
        console.log(`[Test ${testId}] Stream closed normally`);
        break;
      }
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        receivedMessages++;
        
        if (line.startsWith('r:')) {
          receivedToolResults = true;
          console.log(`[Test ${testId}] Received tool result`);
          
          // Randomly abort some streams to test client disconnection
          if (Math.random() < 0.3) {
            console.log(`[Test ${testId}] Simulating client disconnect by aborting stream`);
            await reader.cancel();
            return;
          }
        }
        
        if (line.startsWith('d:')) {
          console.log(`[Test ${testId}] Received completion message`);
        }
      }
    }
    
    console.log(`[Test ${testId}] Test completed successfully: received ${receivedMessages} messages, tool results: ${receivedToolResults}`);
    
  } catch (error) {
    console.error(`[Test ${testId}] Test error:`, error);
    throw error;
  }
}

// Run the test
testChatAPI(); 