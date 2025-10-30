const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3031; // Different port from Screenpipe

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());

// Initialize database
const dbPath = path.join(process.env.HOME || process.env.USERPROFILE, '.screenpipe', 'memora.db');
const db = new sqlite3.Database(dbPath);

// Create tables
db.serialize(() => {
  // Workflows table
  db.run(`
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT,
      start_time DATETIME,
      end_time DATETIME,
      app_context TEXT,
      status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Actions table
  db.run(`
    CREATE TABLE IF NOT EXISTS actions (
      id TEXT PRIMARY KEY,
      workflow_id TEXT,
      timestamp DATETIME,
      type TEXT,
      target TEXT,
      coordinates TEXT,
      key TEXT,
      app TEXT,
      window TEXT,
      context TEXT,
      FOREIGN KEY(workflow_id) REFERENCES workflows(id)
    )
  `);

  // Task patterns table
  db.run(`
    CREATE TABLE IF NOT EXISTS task_patterns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      actions TEXT,
      frequency INTEGER DEFAULT 1,
      automation_script TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Task analyses table
  db.run(`
    CREATE TABLE IF NOT EXISTS task_analyses (
      workflow_id TEXT PRIMARY KEY,
      task_name TEXT,
      start_time DATETIME,
      end_time DATETIME,
      duration INTEGER,
      app_flow TEXT,
      action_count INTEGER,
      success BOOLEAN,
      patterns TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Automation suggestions table
  db.run(`
    CREATE TABLE IF NOT EXISTS automation_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_name TEXT,
      frequency INTEGER,
      last_performed DATETIME,
      automation_potential REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// Simulate some sample data for testing
function createSampleData() {
  const sampleWorkflow = {
    id: 'workflow_sample_001',
    name: 'Upload Excel Report',
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 2 * 60 * 1000).toISOString(), // 2 minutes later
    app_context: 'Excel',
    status: 'completed'
  };

  const sampleActions = [
    {
      id: 'action_001',
      workflow_id: 'workflow_sample_001',
      timestamp: new Date().toISOString(),
      type: 'click',
      target: 'File menu',
      coordinates: JSON.stringify({x: 120, y: 45}),
      app: 'Excel',
      window: 'sales_report.xlsx - Excel',
      context: 'Opened File menu'
    },
    {
      id: 'action_002',
      workflow_id: 'workflow_sample_001',
      timestamp: new Date(Date.now() + 30000).toISOString(),
      type: 'navigate',
      target: 'https://sharepoint.com/reports',
      app: 'Chrome',
      window: 'SharePoint - Reports',
      context: 'Navigated to SharePoint reports page'
    },
    {
      id: 'action_003',
      workflow_id: 'workflow_sample_001',
      timestamp: new Date(Date.now() + 60000).toISOString(),
      type: 'click',
      target: 'Upload button',
      coordinates: JSON.stringify({x: 300, y: 200}),
      app: 'Chrome',
      window: 'SharePoint - Reports',
      context: 'Clicked upload button'
    }
  ];

  // Insert sample workflow
  db.run(`
    INSERT OR REPLACE INTO workflows (id, name, start_time, end_time, app_context, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [sampleWorkflow.id, sampleWorkflow.name, sampleWorkflow.start_time, sampleWorkflow.end_time, sampleWorkflow.app_context, sampleWorkflow.status]);

  // Insert sample actions
  sampleActions.forEach(action => {
    db.run(`
      INSERT OR REPLACE INTO actions (id, workflow_id, timestamp, type, target, coordinates, key, app, window, context)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [action.id, action.workflow_id, action.timestamp, action.type, action.target, action.coordinates, action.key, action.app, action.window, action.context]);
  });

  // Insert sample automation suggestion
  db.run(`
    INSERT OR REPLACE INTO automation_suggestions (task_name, frequency, last_performed, automation_potential)
    VALUES (?, ?, ?, ?)
  `, ['Upload Excel Report', 5, new Date().toISOString(), 0.85]);
}

// API Routes

// Create workflow (for hotkey recording)
app.post('/api/plugins/action-capture/workflows', (req, res) => {
  const workflow = req.body;
  
  db.run(`
    INSERT OR REPLACE INTO workflows (id, name, start_time, end_time, app_context, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    workflow.id,
    workflow.name,
    workflow.start_time,
    workflow.end_time,
    workflow.app_context,
    workflow.status
  ], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ success: true, workflow: workflow });
    }
  });
});

// Update workflow (for hotkey recording)
app.put('/api/plugins/action-capture/workflows/:id', (req, res) => {
  const workflowId = req.params.id;
  const updates = req.body;
  
  const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
  const values = Object.values(updates);
  values.push(workflowId);
  
  db.run(`
    UPDATE workflows 
    SET ${setClause}
    WHERE id = ?
  `, values, function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ success: true });
    }
  });
});

// Get workflows
app.get('/api/plugins/action-capture/workflows', (req, res) => {
  db.all(`
    SELECT w.*, COUNT(a.id) as action_count
    FROM workflows w
    LEFT JOIN actions a ON w.id = a.workflow_id
    GROUP BY w.id
    ORDER BY w.start_time DESC
    LIMIT 50
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ workflows: rows });
    }
  });
});

// Get actions for a workflow
app.get('/api/plugins/action-capture/workflows/:id/actions', (req, res) => {
  const workflowId = req.params.id;
  db.all(`
    SELECT * FROM actions 
    WHERE workflow_id = ?
    ORDER BY timestamp ASC
  `, [workflowId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ actions: rows });
    }
  });
});

// Export workflow for AI
app.get('/api/plugins/action-capture/workflows/:id/export', (req, res) => {
  const workflowId = req.params.id;
  
  db.get(`
    SELECT * FROM workflows WHERE id = ?
  `, [workflowId], (err, workflow) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!workflow) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    db.all(`
      SELECT * FROM actions 
      WHERE workflow_id = ?
      ORDER BY timestamp ASC
    `, [workflowId], (err, actions) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Generate AI-ready export
      const aiExport = {
        task: {
          id: workflow.id,
          name: workflow.name,
          detected_at: workflow.start_time,
          duration: calculateDuration(workflow.start_time, workflow.end_time),
          app_flow: getAppFlow(actions),
          success: true
        },
        steps: actions.map((action, index) => ({
          order: index + 1,
          action: action.type,
          target: action.target,
          app: action.app,
          timestamp: action.timestamp,
          context: action.context,
          coordinates: action.coordinates ? JSON.parse(action.coordinates) : null
        })),
        automation: {
          confidence: 0.85,
          language: "python",
          script: generateAutomationScript(actions)
        }
      };

      res.json(aiExport);
    });
  });
});

// Get automation suggestions
app.get('/api/plugins/task-detector/automation-suggestions', (req, res) => {
  db.all(`
    SELECT * FROM automation_suggestions 
    ORDER BY automation_potential DESC, frequency DESC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ suggestions: rows });
    }
  });
});

// Get task analyses
app.get('/api/plugins/task-detector/task-analyses', (req, res) => {
  db.all(`
    SELECT * FROM task_analyses 
    ORDER BY start_time DESC
    LIMIT 50
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ analyses: rows });
    }
  });
});

// Helper functions
function calculateDuration(start, end) {
  if (!end) return "ongoing";
  
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  const diffMs = endTime - startTime;
  
  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);
  
  return `${minutes}m ${seconds}s`;
}

function getAppFlow(actions) {
  const apps = [...new Set(actions.map(a => a.app).filter(Boolean))];
  return apps;
}

function generateAutomationScript(actions) {
  let script = "# Generated automation script\n";
  script += "import pyautogui\n";
  script += "import time\n\n";
  
  actions.forEach((action, index) => {
    switch (action.type) {
      case 'click':
        if (action.coordinates) {
          const coords = JSON.parse(action.coordinates);
          script += `pyautogui.click(${coords.x}, ${coords.y})\n`;
        }
        break;
      case 'keypress':
        if (action.key) {
          script += `pyautogui.press('${action.key}')\n`;
        }
        break;
      case 'navigate':
        script += `# Navigate to: ${action.target}\n`;
        break;
    }
    script += "time.sleep(0.5)\n\n";
  });
  
  return script;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'memora-plugins',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Memora Plugins Service running on port ${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}`);
  
  // Create sample data for testing
  setTimeout(() => {
    createSampleData();
    console.log('📝 Sample data created for testing');
  }, 1000);
});

module.exports = app;
