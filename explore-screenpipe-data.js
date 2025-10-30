// Explore all available Screenpipe data
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function exploreScreenpipeData() {
  console.log("🔍 Exploring Screenpipe Data");
  console.log("=" .repeat(50));
  
  try {
    // Check health endpoint for more info
    console.log("1. Health Check:");
    const healthResponse = await fetch('http://localhost:3030/health');
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log("   Status:", healthData.status);
      console.log("   Last frame:", healthData.last_frame_timestamp);
      console.log("   Last audio:", healthData.last_audio_timestamp);
      console.log("   Last UI:", healthData.last_ui_timestamp);
      console.log("   Frame status:", healthData.frame_status);
      console.log("   Audio status:", healthData.audio_status);
    }
    
    // Get recent frames with more details
    console.log("\n2. Recent Frames (last 5):");
    const framesResponse = await fetch('http://localhost:3030/search?limit=5&offset=0');
    if (framesResponse.ok) {
      const framesData = await framesResponse.json();
      console.log(`   Found ${framesData.data.length} frames`);
      
      framesData.data.forEach((frame, index) => {
        console.log(`\n   Frame ${index + 1}:`);
        console.log(`   - Frame ID: ${frame.content.frame_id}`);
        console.log(`   - Timestamp: ${frame.timestamp}`);
        console.log(`   - App: ${frame.content.app_name}`);
        console.log(`   - Window: ${frame.content.window_name}`);
        console.log(`   - File: ${frame.content.file_path}`);
        console.log(`   - Text length: ${frame.content.text ? frame.content.text.length : 0} chars`);
        console.log(`   - Text preview: ${frame.content.text ? frame.content.text.substring(0, 100) + '...' : 'No text'}`);
        console.log(`   - Focused: ${frame.content.focused}`);
        console.log(`   - Tags: ${frame.content.tags ? frame.content.tags.join(', ') : 'None'}`);
      });
    }
    
    // Try to get more frames to see patterns
    console.log("\n3. More Frames (last 20):");
    const moreFramesResponse = await fetch('http://localhost:3030/search?limit=20&offset=0');
    if (moreFramesResponse.ok) {
      const moreFramesData = await moreFramesResponse.json();
      
      // Group by app
      const apps = {};
      moreFramesData.data.forEach(frame => {
        const app = frame.content.app_name || 'Unknown';
        if (!apps[app]) apps[app] = 0;
        apps[app]++;
      });
      
      console.log("   Apps captured:");
      Object.entries(apps).forEach(([app, count]) => {
        console.log(`   - ${app}: ${count} frames`);
      });
      
      // Check for different file paths (different recordings)
      const files = [...new Set(moreFramesData.data.map(f => f.content.file_path))];
      console.log(`\n   Different recording files: ${files.length}`);
      files.forEach(file => {
        console.log(`   - ${file}`);
      });
    }
    
    // Check if there are other endpoints
    console.log("\n4. Checking for other endpoints:");
    const endpoints = [
      'http://localhost:3030/api/frames',
      'http://localhost:3030/api/audio',
      'http://localhost:3030/api/ui',
      'http://localhost:3030/api/events',
      'http://localhost:3030/api/actions',
      'http://localhost:3030/api/recordings',
      'http://localhost:3030/api/sessions'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint);
        console.log(`   ${endpoint}: ${response.status}`);
        if (response.status === 200) {
          const data = await response.text();
          console.log(`     Response: ${data.substring(0, 100)}...`);
        }
      } catch (err) {
        console.log(`   ${endpoint}: Error - ${err.message}`);
      }
    }
    
  } catch (error) {
    console.log("❌ Error:", error.message);
  }
}

exploreScreenpipeData();




