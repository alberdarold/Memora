const { app, BrowserWindow, globalShortcut, Notification } = require('electron');
const { spawn } = require('child_process');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

let mainWindow;
let isRecording = false;
let currentWorkflowId = null;
let recordingStartTime = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    alwaysOnTop: true,
    resizable: false
  });
  
  // Create simple HTML content
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Memora Hotkey Controller</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background: #2c3e50;
          color: white;
          text-align: center;
          padding: 20px;
        }
        .status {
          font-size: 24px;
          margin: 20px 0;
        }
        .recording {
          color: #e74c3c;
          animation: pulse 1s infinite;
        }
        .stopped {
          color: #27ae60;
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
        .instructions {
          font-size: 14px;
          margin-top: 20px;
          opacity: 0.8;
        }
      </style>
    </head>
    <body>
      <h1>🎯 Memora</h1>
      <div class="status" id="status">Ready to Record</div>
      <div class="instructions">
        Press <strong>Ctrl+Space</strong> to start/stop recording<br>
        <small>This window must stay open for hotkeys to work</small>
      </div>
    </body>
    </html>
  `;
  
  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));
  
  console.log('🎯 Memora Hotkey Controller Started');
  console.log('🔊 Press Ctrl+Space to start/stop recording');
}

function setupHotkeys() {
  const ret = globalShortcut.register('CommandOrControl+Space', () => {
    toggleRecording();
  });

  if (!ret) {
    console.log('❌ Failed to register Ctrl+Space hotkey');
  } else {
    console.log('✅ Ctrl+Space hotkey registered successfully');
  }
}

async function toggleRecording() {
  isRecording = !isRecording;
  
  if (isRecording) {
    console.log('🔴 Recording started');
    recordingStartTime = new Date();
    currentWorkflowId = `workflow_${Date.now()}`;
    
    // Create workflow in backend
    await createWorkflow({
      id: currentWorkflowId,
      name: 'Recording in progress...',
      start_time: recordingStartTime.toISOString(),
      app_context: 'Unknown',
      status: 'in_progress'
    });
    
    playSound('start');
    showNotification('🔴 Recording Started', 'Memora is capturing your workflow');
    updateUI('🔴 RECORDING', 'recording');
    
    // Flash the window title
    flashWindow('🔴 RECORDING');
  } else {
    console.log('⏹️ Recording stopped');
    const endTime = new Date();
    const duration = endTime - recordingStartTime;
    
    // Update workflow in backend
    await updateWorkflow(currentWorkflowId, {
      end_time: endTime.toISOString(),
      status: 'completed',
      name: `Workflow at ${recordingStartTime.toLocaleTimeString()}`
    });
    
    playSound('stop');
    showNotification('⏹️ Recording Stopped', `Workflow saved! Duration: ${Math.round(duration/1000)}s`);
    updateUI('Ready to Record', 'stopped');
    
    // Reset window title
    if (mainWindow) {
      mainWindow.setTitle('🎯 Memora - Ready');
    }
    
    // Reset variables
    currentWorkflowId = null;
    recordingStartTime = null;
  }
}

function flashWindow(text) {
  if (mainWindow) {
    let flashCount = 0;
    const flashInterval = setInterval(() => {
      if (flashCount < 6) { // Flash 3 times (on/off = 2 states each)
        mainWindow.setTitle(flashCount % 2 === 0 ? text : '🎯 Memora');
        flashCount++;
      } else {
        clearInterval(flashInterval);
        mainWindow.setTitle(text);
      }
    }, 300);
  }
}

function playSound(type) {
  try {
    if (process.platform === 'win32') {
      if (type === 'start') {
        // Try multiple sound methods
        try {
          // Method 1: Console beep
          const psCommand = `[Console]::Beep(800, 200)`;
          spawn('powershell', ['-Command', psCommand], { stdio: 'ignore' });
          console.log('🔊 Playing start sound (800Hz)');
        } catch (e) {
          // Method 2: Windows message sound
          spawn('msg', ['*', '🔴 Memora Recording Started'], { stdio: 'ignore' });
          console.log('🔊 Playing start notification');
        }
      } else if (type === 'stop') {
        try {
          // Method 1: Console beep
          const psCommand = `[Console]::Beep(400, 300)`;
          spawn('powershell', ['-Command', psCommand], { stdio: 'ignore' });
          console.log('🔊 Playing stop sound (400Hz)');
        } catch (e) {
          // Method 2: Windows message sound
          spawn('msg', ['*', '⏹️ Memora Recording Stopped'], { stdio: 'ignore' });
          console.log('🔊 Playing stop notification');
        }
      }
    } else {
      console.log('🔊 Sound not supported on this platform');
    }
  } catch (error) {
    console.log('❌ Could not play sound:', error.message);
  }
}

function showNotification(title, body) {
  try {
    new Notification({ title, body }).show();
  } catch (error) {
    console.log('❌ Could not show notification:', error.message);
  }
}

function updateUI(text, className) {
  if (mainWindow) {
    mainWindow.webContents.executeJavaScript(`
      document.getElementById('status').textContent = '${text}';
      document.getElementById('status').className = 'status ${className}';
    `);
  }
}

async function createWorkflow(workflow) {
  try {
    const response = await fetch('http://localhost:3031/api/plugins/action-capture/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workflow)
    });
    
    if (response.ok) {
      console.log('✅ Workflow created in backend');
      return true;
    } else {
      console.log('❌ Failed to create workflow in backend');
      return false;
    }
  } catch (error) {
    console.log('❌ Error creating workflow:', error.message);
    return false;
  }
}

async function updateWorkflow(workflowId, updates) {
  try {
    const response = await fetch(`http://localhost:3031/api/plugins/action-capture/workflows/${workflowId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    
    if (response.ok) {
      console.log('✅ Workflow updated in backend');
      return true;
    } else {
      console.log('❌ Failed to update workflow in backend');
      return false;
    }
  } catch (error) {
    console.log('❌ Error updating workflow:', error.message);
    return false;
  }
}

app.whenReady().then(() => {
  createWindow();
  setupHotkeys();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
