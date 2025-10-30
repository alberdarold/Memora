// Test script for Memora hotkey functionality
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testHotkeyFunctionality() {
  console.log("🎯 Testing Memora Hotkey Functionality");
  console.log("=" .repeat(50));
  
  try {
    // Test creating a workflow (simulating hotkey start)
    console.log("1. Testing workflow creation (Ctrl+Space start)...");
    
    const workflow = {
      id: 'workflow_test_' + Date.now(),
      name: 'Test Workflow',
      start_time: new Date().toISOString(),
      app_context: 'Test App',
      status: 'in_progress'
    };
    
    const createResponse = await fetch('http://localhost:3031/api/plugins/action-capture/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workflow)
    });
    
    if (createResponse.ok) {
      console.log("✅ Workflow created successfully");
    } else {
      console.log("❌ Failed to create workflow");
      return;
    }
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test updating workflow (simulating hotkey stop)
    console.log("2. Testing workflow update (Ctrl+Space stop)...");
    
    const updates = {
      end_time: new Date().toISOString(),
      status: 'completed',
      name: 'Test Workflow - Completed'
    };
    
    const updateResponse = await fetch(`http://localhost:3031/api/plugins/action-capture/workflows/${workflow.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    
    if (updateResponse.ok) {
      console.log("✅ Workflow updated successfully");
    } else {
      console.log("❌ Failed to update workflow");
      return;
    }
    
    // Test retrieving workflows
    console.log("3. Testing workflow retrieval...");
    
    const getResponse = await fetch('http://localhost:3031/api/plugins/action-capture/workflows');
    if (getResponse.ok) {
      const data = await getResponse.json();
      console.log(`✅ Retrieved ${data.workflows.length} workflows`);
      
      // Find our test workflow
      const testWorkflow = data.workflows.find(w => w.id === workflow.id);
      if (testWorkflow) {
        console.log("✅ Test workflow found in database");
        console.log(`   - Name: ${testWorkflow.name}`);
        console.log(`   - Status: ${testWorkflow.status}`);
        console.log(`   - Duration: ${testWorkflow.start_time} to ${testWorkflow.end_time}`);
      }
    } else {
      console.log("❌ Failed to retrieve workflows");
    }
    
    console.log("\n🎉 Hotkey functionality test completed!");
    console.log("\n📋 How to use Memora hotkeys:");
    console.log("1. Start Memora Electron app");
    console.log("2. Press Ctrl+Space to start recording");
    console.log("3. Do your work (click, type, navigate)");
    console.log("4. Press Ctrl+Space again to stop recording");
    console.log("5. Your workflow will appear in the timeline!");
    
  } catch (error) {
    console.log("❌ Error testing hotkey functionality:", error.message);
  }
}

testHotkeyFunctionality();
