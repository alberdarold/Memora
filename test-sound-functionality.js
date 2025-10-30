// Test script for Memora sound functionality
const { spawn } = require('child_process');

function testSoundFunctionality() {
  console.log("🔊 Testing Memora Sound Functionality");
  console.log("=" .repeat(50));
  
  try {
    console.log("1. Testing start recording sound (high beep)...");
    playBeep(800, 200); // High beep for start
    
    setTimeout(() => {
      console.log("2. Testing stop recording sound (low beep)...");
      playBeep(400, 300); // Low beep for stop
      
      setTimeout(() => {
        console.log("3. Testing notification sound...");
        playBeep(600, 150); // Medium beep for notification
        
        console.log("\n🎉 Sound test completed!");
        console.log("\n📋 Sound Guide:");
        console.log("• High beep (800Hz) = Recording started");
        console.log("• Low beep (400Hz) = Recording stopped");
        console.log("• Medium beep (600Hz) = Notifications");
        console.log("\n🎯 When you press Ctrl+Space:");
        console.log("1. You'll hear a high beep when recording starts");
        console.log("2. You'll see the red recording indicator");
        console.log("3. You'll hear a low beep when recording stops");
        console.log("4. Your workflow will appear in the timeline");
      }, 1000);
    }, 1000);
    
  } catch (error) {
    console.log("❌ Error testing sound:", error.message);
  }
}

function playBeep(frequency, duration) {
  try {
    if (process.platform === 'win32') {
      // Windows: Use PowerShell to generate beep
      const psCommand = `[Console]::Beep(${frequency}, ${duration})`;
      spawn('powershell', ['-Command', psCommand], { stdio: 'ignore' });
      console.log(`   🔊 Playing ${frequency}Hz beep for ${duration}ms`);
    } else if (process.platform === 'darwin') {
      // macOS: Use afplay
      spawn('afplay', ['/System/Library/Sounds/Ping.aiff'], { stdio: 'ignore' });
      console.log(`   🔊 Playing system sound`);
    } else {
      // Linux: Use beep command if available
      spawn('beep', [], { stdio: 'ignore' });
      console.log(`   🔊 Playing beep sound`);
    }
  } catch (error) {
    console.log(`   ❌ Could not play beep: ${error.message}`);
  }
}

testSoundFunctionality();




