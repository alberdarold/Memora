// Debug script to test the workflow loading logic
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function debugWorkflowLoading() {
  console.log("🔍 Debugging Workflow Loading");
  console.log("=" .repeat(40));
  
  try {
    // Test Screenpipe data
    console.log("1. Testing Screenpipe API...");
    const screenpipeResponse = await fetch('http://localhost:3030/search?limit=10&offset=0');
    console.log(`   Status: ${screenpipeResponse.status}`);
    
    if (screenpipeResponse.ok) {
      const screenpipeData = await screenpipeResponse.json();
      console.log(`   Frames received: ${screenpipeData.data.length}`);
      
      if (screenpipeData.data.length > 0) {
        const firstFrame = screenpipeData.data[0];
        console.log(`   First frame ID: ${firstFrame.content.frame_id}`);
        console.log(`   First frame text length: ${firstFrame.content.text.length}`);
        console.log(`   First frame timestamp: ${firstFrame.content.timestamp}`);
      }
    }
    
    // Test plugins API
    console.log("\n2. Testing Plugins API...");
    const pluginsResponse = await fetch('http://localhost:3031/api/plugins/action-capture/workflows');
    console.log(`   Status: ${pluginsResponse.status}`);
    
    if (pluginsResponse.ok) {
      const pluginsData = await pluginsResponse.json();
      console.log(`   Workflows received: ${pluginsData.workflows.length}`);
    }
    
    // Test the grouping logic
    console.log("\n3. Testing grouping logic...");
    if (screenpipeResponse.ok) {
      const screenpipeData = await screenpipeResponse.json();
      
      // Group frames by file_path
      const frameGroups = {};
      (screenpipeData.data || []).forEach(frame => {
        const filePath = frame.content.file_path;
        if (!frameGroups[filePath]) {
          frameGroups[filePath] = [];
        }
        frameGroups[filePath].push(frame);
      });
      
      console.log(`   Unique recording files: ${Object.keys(frameGroups).length}`);
      
      // Test workflow creation
      const workflows = Object.entries(frameGroups).map(([filePath, frames]) => {
        frames.sort((a, b) => a.content.frame_id - b.content.frame_id);
        const firstFrame = frames[0];
        
        // Test timestamp parsing
        const timestampMatch = filePath.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
        let startTime;
        
        if (timestampMatch) {
          const timestampStr = timestampMatch[1].replace(/_/g, 'T').replace(/-/g, '-') + '.000Z';
          startTime = new Date(timestampStr);
          console.log(`   Parsed timestamp: ${timestampStr} -> ${startTime.toISOString()}`);
        } else {
          startTime = new Date();
          console.log(`   Using fallback timestamp: ${startTime.toISOString()}`);
        }
        
        if (isNaN(startTime.getTime())) {
          console.log(`   ❌ Invalid timestamp detected!`);
          startTime = new Date();
        }
        
        return {
          id: `screenpipe_${firstFrame.content.frame_id}`,
          name: firstFrame.content.window_name || `${firstFrame.content.app_name} Session`,
          start_time: startTime.toISOString(),
          app_context: firstFrame.content.app_name || 'Unknown',
          source: 'screenpipe',
          frame_count: frames.length
        };
      });
      
      console.log(`   Created workflows: ${workflows.length}`);
      workflows.forEach((workflow, index) => {
        console.log(`   ${index + 1}. ${workflow.name} (${workflow.frame_count} frames)`);
      });
    }
    
  } catch (error) {
    console.log("❌ Error:", error.message);
    console.log("Stack:", error.stack);
  }
}

debugWorkflowLoading();




