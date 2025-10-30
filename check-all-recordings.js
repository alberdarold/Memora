// Check all Screenpipe recordings
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function checkAllRecordings() {
  console.log("🔍 Checking All Screenpipe Recordings");
  console.log("=" .repeat(50));
  
  try {
    // Get all available frames
    const response = await fetch('http://localhost:3030/search?limit=1000');
    if (response.ok) {
      const data = await response.json();
      console.log(`📊 Total frames available: ${data.data.length}`);
      
      // Group by file path to see unique recordings
      const recordings = {};
      data.data.forEach(frame => {
        const filePath = frame.content.file_path;
        if (!recordings[filePath]) {
          recordings[filePath] = {
            frames: [],
            firstFrame: frame,
            lastFrame: frame
          };
        }
        recordings[filePath].frames.push(frame);
        
        // Update first/last frame based on frame_id
        if (frame.content.frame_id < recordings[filePath].firstFrame.content.frame_id) {
          recordings[filePath].firstFrame = frame;
        }
        if (frame.content.frame_id > recordings[filePath].lastFrame.content.frame_id) {
          recordings[filePath].lastFrame = frame;
        }
      });
      
      console.log(`🎥 Unique recording files: ${Object.keys(recordings).length}`);
      console.log("\n📁 Recording Details:");
      
      Object.entries(recordings).forEach(([filePath, recording], index) => {
        const frameCount = recording.frames.length;
        const firstFrameId = recording.firstFrame.content.frame_id;
        const lastFrameId = recording.lastFrame.content.frame_id;
        const appName = recording.firstFrame.content.app_name;
        const windowName = recording.firstFrame.content.window_name;
        
        console.log(`\n${index + 1}. ${filePath.split('\\').pop()}`);
        console.log(`   - Frames: ${frameCount}`);
        console.log(`   - Frame IDs: ${firstFrameId} to ${lastFrameId}`);
        console.log(`   - App: ${appName}`);
        console.log(`   - Window: ${windowName}`);
        console.log(`   - Duration: ~${frameCount} seconds`);
      });
      
      // Check if we're missing any recordings
      console.log("\n🔍 Analysis:");
      const totalFrames = Object.values(recordings).reduce((sum, r) => sum + r.frames.length, 0);
      console.log(`   - Total frames processed: ${totalFrames}`);
      console.log(`   - Unique recordings: ${Object.keys(recordings).length}`);
      
      // Show the most recent recordings
      const sortedRecordings = Object.entries(recordings)
        .sort((a, b) => b[1].lastFrame.content.frame_id - a[1].lastFrame.content.frame_id);
      
      console.log("\n🕒 Most Recent Recordings:");
      sortedRecordings.slice(0, 5).forEach(([filePath, recording], index) => {
        const fileName = filePath.split('\\').pop();
        const frameCount = recording.frames.length;
        const appName = recording.firstFrame.content.app_name;
        console.log(`   ${index + 1}. ${fileName} (${frameCount} frames, ${appName})`);
      });
      
    } else {
      console.log(`❌ Failed to fetch data: ${response.status}`);
    }
    
  } catch (error) {
    console.log("❌ Error:", error.message);
  }
}

checkAllRecordings();




