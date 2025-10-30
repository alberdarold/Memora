const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

let mainWindow;
let isRecording = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  // Load the Vite development server
  mainWindow.loadURL('http://localhost:5173');
  
  // Open DevTools for debugging
  mainWindow.webContents.openDevTools();
  
  console.log('🎯 Memora Electron App Started');
  console.log('🔊 Press Ctrl+Space to start/stop recording');
}

// Hotkey functionality
function setupHotkeys() {
  // Register Ctrl+Space hotkey
  const ret = globalShortcut.register('CommandOrControl+Space', () => {
    toggleRecording();
  });

  if (!ret) {
    console.log('❌ Failed to register Ctrl+Space hotkey');
  } else {
    console.log('✅ Ctrl+Space hotkey registered');
  }
}

function toggleRecording() {
  isRecording = !isRecording;
  
  if (isRecording) {
    console.log('🔴 Recording started');
    playSound('start');
    showNotification('Recording Started', 'Memora is capturing your workflow');
  } else {
    console.log('⏹️ Recording stopped');
    playSound('stop');
    showNotification('Recording Stopped', 'Workflow saved to timeline');
  }
}

function playSound(type) {
  try {
    const { spawn } = require('child_process');
    
    if (type === 'start') {
      // High beep for start
      const psCommand = `[Console]::Beep(800, 200)`;
      spawn('powershell', ['-Command', psCommand], { stdio: 'ignore' });
    } else if (type === 'stop') {
      // Low beep for stop
      const psCommand = `[Console]::Beep(400, 300)`;
      spawn('powershell', ['-Command', psCommand], { stdio: 'ignore' });
    }
  } catch (error) {
    console.log('Could not play sound:', error.message);
  }
}

function showNotification(title, body) {
  try {
    const { Notification } = require('electron');
    new Notification({ title, body }).show();
  } catch (error) {
    console.log('Could not show notification:', error.message);
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




