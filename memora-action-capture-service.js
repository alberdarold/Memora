// Enhanced action capture system for Memora
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3032; // Different port for action capture

// Enable CORS
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
const dbPath = path.join(process.env.HOME || process.env.USERPROFILE, '.screenpipe', 'memora_actions.db');
const db = new sqlite3.Database(dbPath);

// Create tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS action_sessions (
      id TEXT PRIMARY KEY,
      name TEXT,
      start_time TEXT,
      end_time TEXT,
      app_context TEXT,
      status TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS user_actions (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      action_type TEXT,
      target_element TEXT,
      target_text TEXT,
      coordinates TEXT,
      timestamp TEXT,
      app_name TEXT,
      window_name TEXT,
      screenshot_path TEXT,
      FOREIGN KEY (session_id) REFERENCES action_sessions(id)
    )
  `);

  // Insert sample data
  db.get("SELECT COUNT(*) as count FROM action_sessions", (err, row) => {
    if (err) {
      console.error("Error checking action_sessions table:", err.message);
      return;
    }
    if (row.count === 0) {
      console.log("Inserting sample action data...");
      const sessionId = 'session_sample_001';
      db.run(`
        INSERT INTO action_sessions (id, name, start_time, end_time, app_context, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [sessionId, 'Excel Report Upload Session', new Date().toISOString(), new Date(Date.now() + 120000).toISOString(), 'Excel', 'completed']);

      // Sample actions
      const actions = [
        { type: 'click', target: 'File menu', text: 'File', coords: '100,50', app: 'Excel', window: 'Book1 - Excel' },
        { type: 'click', target: 'Open button', text: 'Open', coords: '200,100', app: 'Excel', window: 'Book1 - Excel' },
        { type: 'type', target: 'File path', text: 'C:\\Reports\\Q4_Report.xlsx', coords: '300,150', app: 'Excel', window: 'Book1 - Excel' },
        { type: 'click', target: 'Upload button', text: 'Upload', coords: '400,200', app: 'SharePoint', window: 'SharePoint - Upload' },
        { type: 'click', target: 'Confirm button', text: 'Confirm', coords: '500,250', app: 'SharePoint', window: 'SharePoint - Upload' }
      ];

      actions.forEach((action, index) => {
        db.run(`
          INSERT INTO user_actions (id, session_id, action_type, target_element, target_text, coordinates, timestamp, app_name, window_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          `action_${sessionId}_${index}`,
          sessionId,
          action.type,
          action.target,
          action.text,
          action.coords,
          new Date(Date.now() - (actions.length - index) * 10000).toISOString(),
          action.app,
          action.window
        ]);
      });
    }
  });
});

// API Routes

// Create new action session
app.post('/api/sessions', (req, res) => {
  const session = req.body;
  db.run(`
    INSERT OR REPLACE INTO action_sessions (id, name, start_time, end_time, app_context, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
    session.id,
    session.name,
    session.start_time,
    session.end_time,
    session.app_context,
    session.status
  ], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ success: true, session: session });
    }
  });
});

// Add action to session
app.post('/api/sessions/:sessionId/actions', (req, res) => {
  const sessionId = req.params.sessionId;
  const action = req.body;
  
  db.run(`
    INSERT INTO user_actions (id, session_id, action_type, target_element, target_text, coordinates, timestamp, app_name, window_name, screenshot_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    action.id || `action_${Date.now()}`,
    sessionId,
    action.action_type,
    action.target_element,
    action.target_text,
    action.coordinates,
    action.timestamp,
    action.app_name,
    action.window_name,
    action.screenshot_path
  ], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
    } else {
      res.json({ success: true, action: action });
    }
  });
});

// Get all sessions
app.get('/api/sessions', (req, res) => {
  db.all(`
    SELECT s.*, COUNT(a.id) as action_count
    FROM action_sessions s
    LEFT JOIN user_actions a ON s.id = a.session_id
    GROUP BY s.id
    ORDER BY s.start_time DESC
  `, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ sessions: rows });
  });
});

// Get actions for a session
app.get('/api/sessions/:sessionId/actions', (req, res) => {
  const sessionId = req.params.sessionId;
  db.all(`
    SELECT * FROM user_actions 
    WHERE session_id = ? 
    ORDER BY timestamp ASC
  `, [sessionId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ actions: rows });
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'memora-action-capture', 
    timestamp: new Date().toISOString() 
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🎯 Memora Action Capture Service running on port ${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}`);
  console.log(`📝 Sample action data created for testing`);
});




