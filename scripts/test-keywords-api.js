const https = require('https');
const http = require('http');

// Configuration
const topic = process.argv[2] || 'digital marketing';
const apiUrl = 'http://localhost:3003/api/keywords';

console.log(`Testing keywords API with topic: "${topic}"`);

// Prepare the request data
const requestData = JSON.stringify({
  topic: topic
});

// Prepare the request options
const options = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(requestData)
  }
};

// Make the request
const req = http.request(apiUrl, options, (res) => {
  console.log(`Response status code: ${res.statusCode}`);
  
  let responseBody = '';
  
  // Collect the response data
  res.on('data', (chunk) => {
    responseBody += chunk;
  });
  
  // Process the complete response
  res.on('end', () => {
    try {
      const parsedData = JSON.parse(responseBody);
      
      if (parsedData.keywords && Array.isArray(parsedData.keywords)) {
        console.log(`\nReceived ${parsedData.keywords.length} keywords:`);
        
        // Count keywords by source
        const sourceCount = {};
        parsedData.keywords.forEach(keyword => {
          const source = keyword.source || 'unknown';
          sourceCount[source] = (sourceCount[source] || 0) + 1;
        });
        
        console.log('\nKeywords by source:');
        Object.entries(sourceCount).forEach(([source, count]) => {
          console.log(`- ${source}: ${count}`);
        });
        
        // Print the first 3 keywords as examples
        console.log('\nExample keywords:');
        parsedData.keywords.slice(0, 3).forEach((keyword, index) => {
          console.log(`\n[${index + 1}] ${keyword.keyword}`);
          console.log(`  Volume: ${keyword.volume}`);
          console.log(`  Difficulty: ${keyword.difficulty}`);
          console.log(`  CPC: $${keyword.cpc}`);
          console.log(`  Source: ${keyword.source || 'unknown'}`);
        });
      } else {
        console.log('No keywords found in the response');
        console.log('Response:', parsedData);
      }
    } catch (error) {
      console.error('Error parsing response:', error);
      console.log('Raw response:', responseBody);
    }
  });
});

// Handle request errors
req.on('error', (error) => {
  console.error('Error making request:', error);
});

// Send the request data
req.write(requestData);
req.end();

console.log('Request sent, waiting for response...'); 