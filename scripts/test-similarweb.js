// Simple script to test the SimilarWeb API directly
const https = require('https');
const fs = require('fs');
const path = require('path');

// Read API key from .env.local file
let apiKey = '';
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/SIMILARWEB_API_KEY=([^\s]+)/);
  if (match && match[1]) {
    apiKey = match[1];
  }
} catch (err) {
  console.error('Error reading .env.local file:', err.message);
}

// Fallback to hardcoded API key if not found in .env.local
if (!apiKey) {
  apiKey = 'd14923977f194036a9c41c5d924fd9ec';
  console.log('Using fallback API key');
} else {
  console.log(`Using API key from .env.local: ${apiKey.substring(0, 5)}...`);
}

// Get keyword from command line argument or use default
const keyword = process.argv[2] || 'digital marketing';
const encodedKeyword = encodeURIComponent(keyword);

// Construct the API URL
const url = `https://api.similarweb.com/v4/keywords/${encodedKeyword}/analysis/overview?api_key=${apiKey}`;

console.log(`Testing SimilarWeb API with keyword: "${keyword}"`);
console.log(`API URL: https://api.similarweb.com/v4/keywords/${encodedKeyword}/analysis/overview?api_key=***`);

// Make the API request
https.get(url, (res) => {
  let data = '';
  
  console.log(`Response status code: ${res.statusCode}`);
  console.log(`Response headers: ${JSON.stringify(res.headers, null, 2)}`);
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\nResponse body:');
    try {
      const parsedData = JSON.parse(data);
      console.log(JSON.stringify(parsedData, null, 2));
      
      // Check if we got valid data - the actual response format has data at the top level
      if (parsedData.data && parsedData.data.volume) {
        console.log('\n✅ SUCCESS: Received valid data from SimilarWeb API');
        console.log(`Volume: ${parsedData.data.volume}`);
        console.log(`Organic Difficulty: ${parsedData.data.organic_difficulty}`);
        console.log(`CPC Range: ${JSON.stringify(parsedData.data.cpc_range)}`);
        
        // Check API usage from headers
        if (res.headers['sw-datapoints']) {
          console.log(`\nAPI Usage:`);
          console.log(`Data points used: ${res.headers['sw-datapoints']}`);
          console.log(`Hits: ${res.headers['sw-hits']}`);
          console.log(`Coins: ${res.headers['sw-coins']}`);
          console.log(`Wallet: ${res.headers['sw-wallet']}`);
        }
      } else {
        console.log('\n❌ ERROR: Did not receive expected data structure');
      }
    } catch (err) {
      console.log('Could not parse JSON response:');
      console.log(data);
    }
  });
}).on('error', (err) => {
  console.error(`Error making request: ${err.message}`);
});

// Usage instructions
console.log('\nUsage:');
console.log('  node scripts/test-similarweb.js [keyword]');
console.log('Example:');
console.log('  node scripts/test-similarweb.js "seo tools"'); 