// Test script for action-capture plugin
const fetch = require('node-fetch');

async function testActionCapturePlugin() {
  console.log("Testing Action Capture Plugin...");
  
  try {
    // Test if plugin is running
    const response = await fetch('http://localhost:3030/api/plugins/action-capture/workflows');
    
    if (response.ok) {
      const data = await response.json();
      console.log("✅ Plugin is running!");
      console.log(`📊 Found ${data.workflows?.length || 0} workflows`);
      
      if (data.workflows && data.workflows.length > 0) {
        console.log("Recent workflows:");
        data.workflows.slice(0, 3).forEach(workflow => {
          console.log(`  - ${workflow.name} (${workflow.action_count} actions)`);
        });
      }
    } else {
      console.log("❌ Plugin not responding");
    }
  } catch (error) {
    console.log("❌ Error testing plugin:", error.message);
  }
}

testActionCapturePlugin();




