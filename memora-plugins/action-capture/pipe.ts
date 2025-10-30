import { pipe } from "@screenpipe/js";

// Action capture plugin for Memora
// Captures keyboard and mouse events to build workflows

interface Action {
  id: string;
  timestamp: string;
  type: 'click' | 'keypress' | 'scroll' | 'focus' | 'navigate';
  target?: string;
  coordinates?: { x: number; y: number };
  key?: string;
  app?: string;
  window?: string;
  context?: string;
}

interface Workflow {
  id: string;
  name: string;
  start_time: string;
  end_time?: string;
  app_context: string;
  status: 'in_progress' | 'completed';
  actions: Action[];
}

let currentWorkflow: Workflow | null = null;
let actionCounter = 0;

// Initialize action capture
async function initializeActionCapture() {
  console.log("Action Capture Plugin: Initializing...");
  
  // Create database tables if they don't exist
  await createTables();
  
  // Start capturing events
  startEventCapture();
  
  console.log("Action Capture Plugin: Ready to capture workflows!");
}

// Create database tables for action-centric storage
async function createTables() {
  try {
    // Create workflows table
    await pipe.db.exec(`
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

    // Create actions table
    await pipe.db.exec(`
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

    // Create task_patterns table
    await pipe.db.exec(`
      CREATE TABLE IF NOT EXISTS task_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        actions TEXT,
        frequency INTEGER DEFAULT 1,
        automation_script TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Action Capture Plugin: Database tables created");
  } catch (error) {
    console.error("Action Capture Plugin: Error creating tables:", error);
  }
}

// Start capturing user events
function startEventCapture() {
  // This is a simplified version - in a real implementation,
  // you would use platform-specific APIs to capture events
  
  // For now, we'll simulate event capture by monitoring screen changes
  // and correlating with Screenpipe's frame data
  
  console.log("Action Capture Plugin: Event capture started");
  
  // Monitor for new frames and detect actions
  pipe.scheduler
    .task("detect-actions")
    .every("1 second")
    .do(detectActionsFromFrames);
}

// Detect actions by analyzing frame changes
async function detectActionsFromFrames() {
  try {
    // Get recent frames from Screenpipe
    const frames = await pipe.db.query(`
      SELECT * FROM frames 
      WHERE timestamp > datetime('now', '-5 seconds')
      ORDER BY timestamp DESC
      LIMIT 10
    `);

    if (frames.length === 0) return;

    // Analyze frame changes to detect actions
    for (let i = 1; i < frames.length; i++) {
      const currentFrame = frames[i];
      const previousFrame = frames[i - 1];

      // Detect app changes (new workflow)
      if (currentFrame.app_name !== previousFrame.app_name) {
        await handleAppChange(currentFrame);
      }

      // Detect window changes
      if (currentFrame.window_name !== previousFrame.window_name) {
        await handleWindowChange(currentFrame);
      }

      // Detect URL changes (navigation)
      if (currentFrame.browser_url !== previousFrame.browser_url) {
        await handleNavigation(currentFrame);
      }

      // Detect OCR text changes (typing)
      if (currentFrame.ocr_text !== previousFrame.ocr_text) {
        await handleTextChange(currentFrame, previousFrame);
      }
    }
  } catch (error) {
    console.error("Action Capture Plugin: Error detecting actions:", error);
  }
}

// Handle app changes (start new workflow)
async function handleAppChange(frame: any) {
  // End current workflow if exists
  if (currentWorkflow) {
    await endCurrentWorkflow();
  }

  // Start new workflow
  currentWorkflow = {
    id: `workflow_${Date.now()}`,
    name: inferTaskName(frame),
    start_time: frame.timestamp,
    app_context: frame.app_name,
    status: 'in_progress',
    actions: []
  };

  // Save workflow to database
  await pipe.db.run(`
    INSERT INTO workflows (id, name, start_time, app_context, status)
    VALUES (?, ?, ?, ?, ?)
  `, [
    currentWorkflow.id,
    currentWorkflow.name,
    currentWorkflow.start_time,
    currentWorkflow.app_context,
    currentWorkflow.status
  ]);

  // Add focus action
  await addAction({
    type: 'focus',
    target: frame.app_name,
    app: frame.app_name,
    window: frame.window_name,
    context: `Switched to ${frame.app_name}`
  });

  console.log(`Action Capture Plugin: Started workflow "${currentWorkflow.name}"`);
}

// Handle window changes
async function handleWindowChange(frame: any) {
  if (!currentWorkflow) return;

  await addAction({
    type: 'focus',
    target: frame.window_name,
    app: frame.app_name,
    window: frame.window_name,
    context: `Opened window: ${frame.window_name}`
  });
}

// Handle navigation (URL changes)
async function handleNavigation(frame: any) {
  if (!currentWorkflow || !frame.browser_url) return;

  await addAction({
    type: 'navigate',
    target: frame.browser_url,
    app: frame.app_name,
    context: `Navigated to ${frame.browser_url}`
  });
}

// Handle text changes (typing)
async function handleTextChange(currentFrame: any, previousFrame: any) {
  if (!currentWorkflow) return;

  // Simple heuristic: if OCR text changed significantly, user was typing
  const textDiff = currentFrame.ocr_text?.length - (previousFrame.ocr_text?.length || 0);
  
  if (Math.abs(textDiff) > 10) { // Significant text change
    await addAction({
      type: 'keypress',
      target: 'text_input',
      app: currentFrame.app_name,
      context: `Typed ${Math.abs(textDiff)} characters`
    });
  }
}

// Add action to current workflow
async function addAction(actionData: Partial<Action>) {
  if (!currentWorkflow) return;

  const action: Action = {
    id: `action_${++actionCounter}_${Date.now()}`,
    timestamp: new Date().toISOString(),
    type: actionData.type || 'keypress',
    target: actionData.target,
    coordinates: actionData.coordinates,
    key: actionData.key,
    app: actionData.app,
    window: actionData.window,
    context: actionData.context
  };

  currentWorkflow.actions.push(action);

  // Save action to database
  await pipe.db.run(`
    INSERT INTO actions (id, workflow_id, timestamp, type, target, coordinates, key, app, window, context)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    action.id,
    currentWorkflow.id,
    action.timestamp,
    action.type,
    action.target,
    action.coordinates ? JSON.stringify(action.coordinates) : null,
    action.key,
    action.app,
    action.window,
    action.context
  ]);

  console.log(`Action Capture Plugin: Captured ${action.type} action`);
}

// End current workflow
async function endCurrentWorkflow() {
  if (!currentWorkflow) return;

  currentWorkflow.end_time = new Date().toISOString();
  currentWorkflow.status = 'completed';

  // Update workflow in database
  await pipe.db.run(`
    UPDATE workflows 
    SET end_time = ?, status = ?
    WHERE id = ?
  `, [currentWorkflow.end_time, currentWorkflow.status, currentWorkflow.id]);

  console.log(`Action Capture Plugin: Completed workflow "${currentWorkflow.name}" with ${currentWorkflow.actions.length} actions`);

  // Analyze for patterns
  await analyzeWorkflowPattern(currentWorkflow);

  currentWorkflow = null;
}

// Infer task name from context
function inferTaskName(frame: any): string {
  const app = frame.app_name?.toLowerCase() || '';
  const window = frame.window_name?.toLowerCase() || '';
  const url = frame.browser_url || '';

  // Simple heuristics for common tasks
  if (app.includes('excel') || window.includes('excel')) {
    return 'Excel Work';
  }
  if (app.includes('chrome') || app.includes('firefox')) {
    if (url.includes('gmail')) return 'Check Email';
    if (url.includes('sharepoint')) return 'SharePoint Work';
    if (url.includes('github')) return 'GitHub Work';
    return 'Web Browsing';
  }
  if (app.includes('code') || app.includes('cursor') || app.includes('vscode')) {
    return 'Coding Work';
  }
  if (app.includes('word') || window.includes('word')) {
    return 'Document Work';
  }

  return `${app} Work`;
}

// Analyze workflow for patterns
async function analyzeWorkflowPattern(workflow: Workflow) {
  try {
    // Check if similar workflow exists
    const similarWorkflows = await pipe.db.query(`
      SELECT name, COUNT(*) as count
      FROM workflows 
      WHERE name = ? AND id != ?
      GROUP BY name
    `, [workflow.name, workflow.id]);

    if (similarWorkflows.length > 0) {
      const count = similarWorkflows[0].count + 1;
      console.log(`Action Capture Plugin: Found recurring workflow "${workflow.name}" (${count} times)`);
      
      // Update or create pattern
      await pipe.db.run(`
        INSERT OR REPLACE INTO task_patterns (name, actions, frequency)
        VALUES (?, ?, ?)
      `, [
        workflow.name,
        JSON.stringify(workflow.actions),
        count
      ]);
    }
  } catch (error) {
    console.error("Action Capture Plugin: Error analyzing pattern:", error);
  }
}

// API endpoints for Memora UI
pipe.api.get("/workflows", async (req, res) => {
  try {
    const workflows = await pipe.db.query(`
      SELECT w.*, COUNT(a.id) as action_count
      FROM workflows w
      LEFT JOIN actions a ON w.id = a.workflow_id
      GROUP BY w.id
      ORDER BY w.start_time DESC
      LIMIT 50
    `);
    
    res.json({ workflows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

pipe.api.get("/workflows/:id/actions", async (req, res) => {
  try {
    const actions = await pipe.db.query(`
      SELECT * FROM actions 
      WHERE workflow_id = ?
      ORDER BY timestamp ASC
    `, [req.params.id]);
    
    res.json({ actions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

pipe.api.get("/patterns", async (req, res) => {
  try {
    const patterns = await pipe.db.query(`
      SELECT * FROM task_patterns 
      ORDER BY frequency DESC
    `);
    
    res.json({ patterns });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export workflow for AI automation
pipe.api.get("/workflows/:id/export", async (req, res) => {
  try {
    const workflow = await pipe.db.query(`
      SELECT * FROM workflows WHERE id = ?
    `, [req.params.id]);
    
    if (workflow.length === 0) {
      return res.status(404).json({ error: "Workflow not found" });
    }

    const actions = await pipe.db.query(`
      SELECT * FROM actions 
      WHERE workflow_id = ?
      ORDER BY timestamp ASC
    `, [req.params.id]);

    // Generate AI-ready export
    const aiExport = {
      task: {
        id: workflow[0].id,
        name: workflow[0].name,
        detected_at: workflow[0].start_time,
        duration: calculateDuration(workflow[0].start_time, workflow[0].end_time),
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
function calculateDuration(start: string, end: string): string {
  if (!end) return "ongoing";
  
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  const diffMs = endTime - startTime;
  
  const minutes = Math.floor(diffMs / 60000);
  const seconds = Math.floor((diffMs % 60000) / 1000);
  
  return `${minutes}m ${seconds}s`;
}

function getAppFlow(actions: any[]): string[] {
  const apps = [...new Set(actions.map(a => a.app).filter(Boolean))];
  return apps;
}

function generateAutomationScript(actions: any[]): string {
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

// Initialize the plugin
initializeActionCapture();

export default pipe;




