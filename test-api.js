const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testScreenpipeAPI() {
  try {
    // Try different endpoints
    const endpoints = [
      'http://localhost:3030',
      'http://localhost:3030/api',
      'http://localhost:3030/search',
      'http://localhost:3030/frames',
      'http://localhost:3030/health'
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Testing ${endpoint}...`);
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        console.log(`Status: ${response.status}`);
        if (response.status === 200) {
          const data = await response.text();
          console.log(`Response: ${data.substring(0, 200)}...`);
        }
      } catch (err) {
        console.log(`Error: ${err.message}`);
      }
    }
    
    // Try GET search with query parameters
    try {
      console.log('\nTrying GET /search with query params...');
      const response = await fetch('http://localhost:3030/search?limit=10&offset=0', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      console.log(`GET Status: ${response.status}`);
      if (response.status === 200) {
        const data = await response.json();
        console.log('Frames captured:', data.data?.length || 0);
        console.log('First frame:', JSON.stringify(data.data?.[0], null, 2));
      }
    } catch (err) {
      console.log(`GET Error: ${err.message}`);
    }
    
  } catch (err) {
    console.error('Test failed:', err.message);
  }
}

testScreenpipeAPI();
