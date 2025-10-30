// Comprehensive Screenpipe API exploration
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function exploreAllScreenpipeCapabilities() {
  console.log("🔍 Exploring ALL Screenpipe Capabilities");
  console.log("=" .repeat(60));
  
  try {
    // 1. Check all possible endpoints
    console.log("1. Testing all possible endpoints:");
    const endpoints = [
      'http://localhost:3030',
      'http://localhost:3030/',
      'http://localhost:3030/api',
      'http://localhost:3030/api/',
      'http://localhost:3030/search',
      'http://localhost:3030/search/',
      'http://localhost:3030/frames',
      'http://localhost:3030/frames/',
      'http://localhost:3030/health',
      'http://localhost:3030/health/',
      'http://localhost:3030/status',
      'http://localhost:3030/status/',
      'http://localhost:3030/data',
      'http://localhost:3030/data/',
      'http://localhost:3030/recordings',
      'http://localhost:3030/recordings/',
      'http://localhost:3030/sessions',
      'http://localhost:3030/sessions/',
      'http://localhost:3030/events',
      'http://localhost:3030/events/',
      'http://localhost:3030/actions',
      'http://localhost:3030/actions/',
      'http://localhost:3030/ui',
      'http://localhost:3030/ui/',
      'http://localhost:3030/audio',
      'http://localhost:3030/audio/',
      'http://localhost:3030/video',
      'http://localhost:3030/video/',
      'http://localhost:3030/clipboard',
      'http://localhost:3030/clipboard/',
      'http://localhost:3030/keystrokes',
      'http://localhost:3030/keystrokes/',
      'http://localhost:3030/mouse',
      'http://localhost:3030/mouse/',
      'http://localhost:3030/windows',
      'http://localhost:3030/windows/',
      'http://localhost:3030/apps',
      'http://localhost:3030/apps/',
      'http://localhost:3030/processes',
      'http://localhost:3030/processes/',
      'http://localhost:3030/config',
      'http://localhost:3030/config/',
      'http://localhost:3030/plugins',
      'http://localhost:3030/plugins/',
      'http://localhost:3030/pipes',
      'http://localhost:3030/pipes/'
    ];
    
    const workingEndpoints = [];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, { method: 'GET' });
        console.log(`   ${endpoint}: ${response.status}`);
        if (response.status === 200) {
          workingEndpoints.push(endpoint);
          const data = await response.text();
          console.log(`     Response preview: ${data.substring(0, 150)}...`);
        }
      } catch (err) {
        console.log(`   ${endpoint}: Error - ${err.message}`);
      }
    }
    
    console.log(`\n✅ Working endpoints: ${workingEndpoints.length}`);
    workingEndpoints.forEach(ep => console.log(`   - ${ep}`));
    
    // 2. Test search endpoint with different parameters
    console.log("\n2. Testing search endpoint variations:");
    const searchVariations = [
      'http://localhost:3030/search',
      'http://localhost:3030/search?limit=1',
      'http://localhost:3030/search?limit=5',
      'http://localhost:3030/search?limit=10',
      'http://localhost:3030/search?limit=50',
      'http://localhost:3030/search?offset=0',
      'http://localhost:3030/search?offset=10',
      'http://localhost:3030/search?limit=10&offset=0',
      'http://localhost:3030/search?limit=10&offset=10',
      'http://localhost:3030/search?limit=10&offset=20',
      'http://localhost:3030/search?app=Cursor',
      'http://localhost:3030/search?app=Microsoft Edge',
      'http://localhost:3030/search?type=OCR',
      'http://localhost:3030/search?type=audio',
      'http://localhost:3030/search?type=ui',
      'http://localhost:3030/search?focused=true',
      'http://localhost:3030/search?focused=false'
    ];
    
    for (const searchUrl of searchVariations) {
      try {
        const response = await fetch(searchUrl);
        if (response.status === 200) {
          const data = await response.json();
          console.log(`   ${searchUrl}: ${data.data ? data.data.length : 0} results`);
          if (data.data && data.data.length > 0) {
            const firstResult = data.data[0];
            console.log(`     Sample: ${firstResult.type} - ${firstResult.content?.app_name || 'Unknown'} - ${firstResult.timestamp || 'No timestamp'}`);
          }
        } else {
          console.log(`   ${searchUrl}: ${response.status}`);
        }
      } catch (err) {
        console.log(`   ${searchUrl}: Error - ${err.message}`);
      }
    }
    
    // 3. Check if there are different data types
    console.log("\n3. Analyzing data types in recent frames:");
    const recentResponse = await fetch('http://localhost:3030/search?limit=20');
    if (recentResponse.ok) {
      const recentData = await recentResponse.json();
      const dataTypes = {};
      const appTypes = {};
      const windowTypes = {};
      
      recentData.data.forEach(frame => {
        const type = frame.type || 'unknown';
        const app = frame.content?.app_name || 'unknown';
        const window = frame.content?.window_name || 'unknown';
        
        dataTypes[type] = (dataTypes[type] || 0) + 1;
        appTypes[app] = (appTypes[app] || 0) + 1;
        windowTypes[window] = (windowTypes[window] || 0) + 1;
      });
      
      console.log("   Data types found:");
      Object.entries(dataTypes).forEach(([type, count]) => {
        console.log(`     - ${type}: ${count} frames`);
      });
      
      console.log("   Apps captured:");
      Object.entries(appTypes).forEach(([app, count]) => {
        console.log(`     - ${app}: ${count} frames`);
      });
      
      console.log("   Windows captured:");
      Object.entries(windowTypes).forEach(([window, count]) => {
        console.log(`     - ${window}: ${count} frames`);
      });
    }
    
    // 4. Check for any additional data in frames
    console.log("\n4. Analyzing frame structure:");
    const frameResponse = await fetch('http://localhost:3030/search?limit=1');
    if (frameResponse.ok) {
      const frameData = await frameResponse.json();
      if (frameData.data && frameData.data.length > 0) {
        const frame = frameData.data[0];
        console.log("   Frame structure:");
        console.log(`     - Type: ${frame.type}`);
        console.log(`     - Timestamp: ${frame.timestamp}`);
        console.log(`     - Content keys: ${Object.keys(frame.content || {}).join(', ')}`);
        
        if (frame.content) {
          Object.entries(frame.content).forEach(([key, value]) => {
            if (typeof value === 'string' && value.length > 100) {
              console.log(`     - ${key}: ${value.substring(0, 100)}... (${value.length} chars)`);
            } else {
              console.log(`     - ${key}: ${value}`);
            }
          });
        }
      }
    }
    
  } catch (error) {
    console.log("❌ Error:", error.message);
  }
}

exploreAllScreenpipeCapabilities();




