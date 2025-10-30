// Test how many workflows we get with 500 frames
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testWorkflowCount() {
  console.log("🔍 Testing Workflow Count with 500 frames");
  console.log("=" .repeat(50));
  
  try {
    const response = await fetch('http://localhost:3030/search?limit=500&offset=0');
    if (response.ok) {
      const data = await response.json();
      console.log(`📊 Frames received: ${data.data.length}`);
      
      // Group frames by file_path
      const frameGroups = {};
      data.data.forEach(frame => {
        const filePath = frame.content.file_path;
        if (!frameGroups[filePath]) {
          frameGroups[filePath] = [];
        }
        frameGroups[filePath].push(frame);
      });
      
      console.log(`🎥 Unique recording files: ${Object.keys(frameGroups).length}`);
      
      // Show the workflows we would create
      const workflows = Object.entries(frameGroups).map(([filePath, frames]) => {
        frames.sort((a, b) => a.content.frame_id - b.content.frame_id);
        const firstFrame = frames[0];
        return {
          id: `screenpipe_${firstFrame.content.frame_id}`,
          name: firstFrame.content.window_name || `${firstFrame.content.app_name} Session`,
          app_context: firstFrame.content.app_name || 'Unknown',
          frame_count: frames.length
        };
      });
      
      console.log(`\n📋 Workflows that would be created:`);
      workflows.forEach((workflow, index) => {
        console.log(`${index + 1}. ${workflow.name} (${workflow.frame_count} frames)`);
      });
      
      console.log(`\n🎯 Total workflows: ${workflows.length}`);
      
    } else {
      console.log(`❌ Failed to fetch data: ${response.status}`);
    }
    
  } catch (error) {
    console.log("❌ Error:", error.message);
  }
}

testWorkflowCount();




