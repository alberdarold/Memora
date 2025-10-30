// Comprehensive test for Memora automation-first implementation
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testMemoraImplementation() {
  console.log("🚀 Testing Memora Automation-First Implementation");
  console.log("=" .repeat(60));
  
  const tests = [
    {
      name: "Screenpipe Health Check",
      test: async () => {
        const response = await fetch('http://localhost:3030/health');
        return response.ok;
      }
    },
    {
      name: "Action Capture Plugin",
      test: async () => {
        const response = await fetch('http://localhost:3031/api/plugins/action-capture/workflows');
        return response.ok;
      }
    },
    {
      name: "Task Detector Plugin", 
      test: async () => {
        const response = await fetch('http://localhost:3031/api/plugins/task-detector/automation-suggestions');
        return response.ok;
      }
    },
    {
      name: "Vite Dev Server",
      test: async () => {
        const response = await fetch('http://localhost:5173');
        return response.ok;
      }
    }
  ];

  let passed = 0;
  let total = tests.length;

  for (const test of tests) {
    try {
      const result = await test.test();
      if (result) {
        console.log(`✅ ${test.name} - PASSED`);
        passed++;
      } else {
        console.log(`❌ ${test.name} - FAILED`);
      }
    } catch (error) {
      console.log(`❌ ${test.name} - ERROR: ${error.message}`);
    }
  }

  console.log("=" .repeat(60));
  console.log(`📊 Test Results: ${passed}/${total} passed`);
  
  if (passed === total) {
    console.log("🎉 All systems operational! Memora is ready for automation!");
  } else {
    console.log("⚠️  Some components need attention.");
  }
  
  console.log("\n🎯 Next Steps:");
  console.log("1. Open http://localhost:5173 in your browser");
  console.log("2. Test the Flow-inspired UI");
  console.log("3. Try the automation features");
  console.log("4. Export workflows for AI automation");
}

testMemoraImplementation();
