const { app, BrowserWindow } = require('electron');
const path = require('path');
const MemoraHotkeyManager = require('./hotkey-manager');

let mainWindow;
let hotkeyManager;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  // In development
  mainWindow.loadURL('http://localhost:5173');
  mainWindow.webContents.openDevTools();

  // Initialize hotkey manager
  hotkeyManager = new MemoraHotkeyManager();
  hotkeyManager.initialize(mainWindow);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  // Cleanup hotkey manager
  if (hotkeyManager) {
    hotkeyManager.cleanup();
  }
});
