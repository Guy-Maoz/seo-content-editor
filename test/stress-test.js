import fetch from 'node-fetch';

// Configuration
const API_URL = 'http://localhost:3001/api/chat';
const CONCURRENT_REQUESTS = 5;
const TOTAL_TESTS = 20;
const DISCONNECT_PROBABILITY = 0.7; // 70% chance to disconnect during processing
const KEYWORDS = [
  'shoes', 'headphones', 'laptop', 'coffee maker', 'kitchen knife',
  'smartphone', 'tablet', 'watch', 'camera', 'microphone'
];

// Stats tracking
const stats = {
  started: 0,
  completed: 0,
  disconnected: 0,
  failed: 0,
  totalDuration: 0,
  errors: []
};

// Returns a random integer between min and max (inclusive)
const getRandomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// Function to run a single test
async function runTest(testId) {
  const keyword = KEYWORDS[testId % KEYWORDS.length];
  const startTime = Date.now();
  stats.started++;
  
  console.log(`[Test ${testId}] Starting test with keyword: "${keyword}"`);
  
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
        threadId: null // Create a new thread each time
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
    let toolCallReceived = false;
    let toolResultReceived = false;
    let completionReceived = false;
    let shouldDisconnect = Math.random() < DISCONNECT_PROBABILITY;
    let disconnectAfterMessages = shouldDisconnect ? getRandomInt(3, 10) : Infinity;
    
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
        
        if (line.startsWith('t:')) {
          toolCallReceived = true;
          console.log(`[Test ${testId}] Received tool call`);
        }
        
        if (line.startsWith('r:')) {
          toolResultReceived = true;
          console.log(`[Test ${testId}] Received tool result`);
        }
        
        if (line.startsWith('d:')) {
          completionReceived = true;
          console.log(`[Test ${testId}] Received completion message`);
        }
        
        // Simulate client disconnecting
        if (receivedMessages >= disconnectAfterMessages && shouldDisconnect) {
          console.log(`[Test ${testId}] Simulating client disconnect after ${receivedMessages} messages`);
          stats.disconnected++;
          await reader.cancel();
          const duration = Date.now() - startTime;
          console.log(`[Test ${testId}] Disconnected after ${duration}ms`);
          return;
        }
      }
    }
    
    // Test completed successfully
    stats.completed++;
    const duration = Date.now() - startTime;
    stats.totalDuration += duration;
    console.log(`[Test ${testId}] Test completed successfully: received ${receivedMessages} messages, tool call: ${toolCallReceived}, tool result: ${toolResultReceived}, completion: ${completionReceived}, duration: ${duration}ms`);
    
  } catch (error) {
    stats.failed++;
    stats.errors.push({ testId, error: error.message });
    console.error(`[Test ${testId}] Test error:`, error);
  }
}

// Function to run multiple tests with concurrency control
async function runStressTest() {
  console.log(`Starting stress test with ${TOTAL_TESTS} tests, ${CONCURRENT_REQUESTS} concurrent requests, ${DISCONNECT_PROBABILITY * 100}% disconnect probability`);
  console.log(`Using keywords: ${KEYWORDS.join(', ')}`);
  
  const startTime = Date.now();
  let completed = 0;
  
  // Run tests in batches to control concurrency
  for (let i = 0; i < TOTAL_TESTS; i += CONCURRENT_REQUESTS) {
    const batch = [];
    const batchSize = Math.min(CONCURRENT_REQUESTS, TOTAL_TESTS - i);
    
    console.log(`\nStarting batch ${Math.floor(i / CONCURRENT_REQUESTS) + 1} with ${batchSize} tests`);
    
    for (let j = 0; j < batchSize; j++) {
      batch.push(runTest(i + j));
    }
    
    // Wait for batch to complete
    await Promise.all(batch);
    completed += batchSize;
    
    console.log(`Completed ${completed}/${TOTAL_TESTS} tests`);
    
    // Short delay between batches
    if (i + CONCURRENT_REQUESTS < TOTAL_TESTS) {
      console.log('Waiting before next batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Print stats
  const totalDuration = Date.now() - startTime;
  const avgDuration = stats.completed > 0 ? (stats.totalDuration / stats.completed).toFixed(2) : 0;
  
  console.log('\n===== STRESS TEST RESULTS =====');
  console.log(`Total tests: ${TOTAL_TESTS}`);
  console.log(`Completed: ${stats.completed}`);
  console.log(`Disconnected: ${stats.disconnected}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Total duration: ${totalDuration}ms`);
  console.log(`Average duration (completed tests): ${avgDuration}ms`);
  
  if (stats.errors.length > 0) {
    console.log('\nErrors:');
    stats.errors.forEach(err => {
      console.log(`- Test ${err.testId}: ${err.error}`);
    });
  }
  
  console.log('\nTest completed.');
}

// Run the stress test
runStressTest().catch(err => {
  console.error('Stress test failed:', err);
}); 