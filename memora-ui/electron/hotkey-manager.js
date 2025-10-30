const { globalShortcut, app, BrowserWindow } = require('electron');
const fetch = require('node-fetch');
const path = require('path');

class MemoraHotkeyManager {
  constructor() {
    this.isRecording = false;
    this.recordingStartTime = null;
    this.currentWorkflowId = null;
    this.mainWindow = null;
  }

  initialize(mainWindow) {
    this.mainWindow = mainWindow;
    
    // Register global hotkey: Ctrl+Space
    const ret = globalShortcut.register('CommandOrControl+Space', () => {
      this.toggleRecording();
    });

    if (!ret) {
      console.log('Failed to register Ctrl+Space hotkey');
    } else {
      console.log('✅ Memora hotkey registered: Ctrl+Space');
    }

    // Show notification when app starts
    this.showNotification('Memora Ready', 'Press Ctrl+Space to start/stop recording workflows');
  }

  async toggleRecording() {
    if (this.isRecording) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  async startRecording() {
    try {
      this.isRecording = true;
      this.recordingStartTime = new Date();
      this.currentWorkflowId = `workflow_${Date.now()}`;

      // Create new workflow in database
      await this.createWorkflow({
        id: this.currentWorkflowId,
        name: 'Recording in progress...',
        start_time: this.recordingStartTime.toISOString(),
        app_context: 'Unknown',
        status: 'in_progress'
      });

      // Play start sound
      this.playSound('start');
      
      // Show notification
      this.showNotification('🔴 Recording Started', 'Memora is now capturing your workflow. Press Ctrl+Space to stop.');
      
      // Update UI if window is open
      if (this.mainWindow) {
        this.mainWindow.webContents.send('recording-started', {
          workflowId: this.currentWorkflowId,
          startTime: this.recordingStartTime.toISOString()
        });
      }

      console.log('🔴 Memora recording started:', this.currentWorkflowId);
    } catch (error) {
      console.error('Error starting recording:', error);
      this.isRecording = false;
    }
  }

  async stopRecording() {
    try {
      if (!this.isRecording || !this.currentWorkflowId) {
        return;
      }

      const endTime = new Date();
      const duration = endTime - this.recordingStartTime;

      // Update workflow in database
      await this.updateWorkflow(this.currentWorkflowId, {
        end_time: endTime.toISOString(),
        status: 'completed',
        name: this.generateWorkflowName()
      });

      // Play stop sound
      this.playSound('stop');
      
      // Show notification
      this.showNotification('⏹️ Recording Stopped', `Workflow captured! Duration: ${Math.round(duration/1000)}s`);
      
      // Update UI if window is open
      if (this.mainWindow) {
        this.mainWindow.webContents.send('recording-stopped', {
          workflowId: this.currentWorkflowId,
          duration: duration,
          endTime: endTime.toISOString()
        });
      }

      console.log('⏹️ Memora recording stopped:', this.currentWorkflowId);
      
      // Reset state
      this.isRecording = false;
      this.recordingStartTime = null;
      this.currentWorkflowId = null;
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  }

  generateWorkflowName() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    return `Workflow at ${timeStr}`;
  }

  async createWorkflow(workflow) {
    try {
      const response = await fetch('http://localhost:3031/api/plugins/action-capture/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflow)
      });
      return response.ok;
    } catch (error) {
      console.error('Error creating workflow:', error);
      return false;
    }
  }

  async updateWorkflow(workflowId, updates) {
    try {
      const response = await fetch(`http://localhost:3031/api/plugins/action-capture/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(upflows)
      });
      return response.ok;
    } catch (error) {
      console.error('Error updating workflow:', error);
      return false;
    }
  }

  playSound(soundType) {
    try {
      // Create audio context for sound generation
      const { spawn } = require('child_process');
      
      if (soundType === 'start') {
        // Play start recording sound (high beep)
        this.playBeep(800, 200); // 800Hz for 200ms
      } else if (soundType === 'stop') {
        // Play stop recording sound (low beep)
        this.playBeep(400, 300); // 400Hz for 300ms
      }
    } catch (error) {
      console.log('Could not play sound:', error.message);
    }
  }

  playBeep(frequency, duration) {
    try {
      // Use PowerShell to generate beep sound
      const { spawn } = require('child_process');
      
      if (process.platform === 'win32') {
        // Windows: Use PowerShell to generate beep
        const psCommand = `[Console]::Beep(${frequency}, ${duration})`;
        spawn('powershell', ['-Command', psCommand], { stdio: 'ignore' });
      } else if (process.platform === 'darwin') {
        // macOS: Use afplay or say command
        spawn('afplay', ['/System/Library/Sounds/Ping.aiff'], { stdio: 'ignore' });
      } else {
        // Linux: Use beep command if available
        spawn('beep', [], { stdio: 'ignore' });
      }
    } catch (error) {
      console.log('Could not play beep:', error.message);
    }
  }

  showNotification(title, body) {
    // Try to show native notification
    if (process.platform === 'win32') {
      // Windows notification
      const { Notification } = require('electron');
      new Notification({ title, body }).show();
    } else if (process.platform === 'darwin') {
      // macOS notification
      const { Notification } = require('electron');
      new Notification({ title, body }).show();
    } else {
      // Linux or fallback
      console.log(`📢 ${title}: ${body}`);
    }
  }

  getRecordingStatus() {
    return {
      isRecording: this.isRecording,
      workflowId: this.currentWorkflowId,
      startTime: this.recordingStartTime,
      duration: this.isRecording ? Date.now() - this.recordingStartTime : 0
    };
  }

  cleanup() {
    globalShortcut.unregisterAll();
  }
}

module.exports = MemoraHotkeyManager;
