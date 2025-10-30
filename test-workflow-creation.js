// Test script to create a workflow via the API
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testWorkflowCreation() {
  console.log("🧪 Testing Workflow Creation");
  console.log("=" .repeat(40));
  
  try {
    // Create a test workflow
    const workflow = {
      id: 'workflow_test_' + Date.now(),
      name: 'Test Recording from Hotkey',
      start_time: new Date().toISOString(),
      app_context: 'Test App',
      status: 'in_progress'
    };
    
    console.log("1. Creating workflow...");
    const createResponse = await fetch('http://localhost:3031/api/plugins/action-capture/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workflow)
    });
    
    if (createResponse.ok) {
      console.log("✅ Workflow created successfully");
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update the workflow
      console.log("2. Updating workflow...");
      const updates = {
        end_time: new Date().toISOString(),
        status: 'completed',
        name: 'Test Recording from Hotkey - Completed'
      };
      
      const updateResponse = await fetch(`http://localhost:3031/api/plugins/action-capture/workflows/${workflow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      
      if (updateResponse.ok) {
        console.log("✅ Workflow updated successfully");
        
        // Check if workflow appears in the list
        console.log("3. Checking workflow list...");
        const listResponse = await fetch('http://localhost:3031/api/plugins/action-capture/workflows');
        if (listResponse.ok) {
          const data = await listResponse.json();
          const testWorkflow = data.workflows.find(w => w.id === workflow.id);
          
          if (testWorkflow) {
            console.log("✅ Workflow found in database!");
            console.log(`   - Name: ${testWorkflow.name}`);
            console.log(`   - Status: ${testWorkflow.status}`);
            console.log(`   - Duration: ${testWorkflow.start_time} to ${testWorkflow.end_time}`);
          } else {
            console.log("❌ Workflow not found in database");
          }
        }
      } else {
        console.log("❌ Failed to update workflow");
      }
    } else {
      console.log("❌ Failed to create workflow");
    }
    
    console.log("\n🎯 Next Steps:");
    console.log("1. Go to http://localhost:5173");
    console.log("2. Refresh the page (F5)");
    console.log("3. You should see the new workflow!");
    
  } catch (error) {
    console.log("❌ Error:", error.message);
  }
}

testWorkflowCreation();




