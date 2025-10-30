import { pipe } from "@screenpipe/js";

// Task Detector Plugin for Memora
// Analyzes workflows and detects task boundaries

interface TaskBoundary {
  type: 'start' | 'end';
  timestamp: string;
  reason: string;
  confidence: number;
  context: any;
}

interface TaskAnalysis {
  workflow_id: string;
  task_name: string;
  start_time: string;
  end_time: string;
  duration: number;
  app_flow: string[];
  action_count: number;
  success: boolean;
  patterns: string[];
}

let lastActivityTime = Date.now();
let currentTaskStart: string | null = null;
const IDLE_THRESHOLD = 2 * 60 * 1000; // 2 minutes

// Initialize task detection
async function initializeTaskDetection() {
  console.log("Task Detector Plugin: Initializing...");
  
  // Start monitoring for task boundaries
  startTaskMonitoring();
  
  // Schedule periodic task analysis
  pipe.scheduler
    .task("analyze-tasks")
    .every("30 seconds")
    .do(analyzeRecentTasks);
  
  console.log("Task Detector Plugin: Ready to detect tasks!");
}

// Start monitoring for task boundaries
function startTaskMonitoring() {
  // Monitor for new frames to detect activity
  pipe.scheduler
    .task("detect-boundaries")
    .every("5 seconds")
    .do(detectTaskBoundaries);
}

// Detect task boundaries based on activity patterns
async function detectTaskBoundaries() {
  try {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityTime;
    
    // Check for new activity
    const recentFrames = await pipe.db.query(`
      SELECT * FROM frames 
      WHERE timestamp > datetime('now', '-10 seconds')
      ORDER BY timestamp DESC
      LIMIT 5
    `);

    if (recentFrames.length > 0) {
      lastActivityTime = now;
      
      // Detect task start
      if (!currentTaskStart) {
        const boundary = await detectTaskStart(recentFrames[0]);
        if (boundary) {
          await recordTaskBoundary(boundary);
          currentTaskStart = recentFrames[0].timestamp;
        }
      }
    } else if (timeSinceLastActivity > IDLE_THRESHOLD && currentTaskStart) {
      // Detect task end due to inactivity
      const boundary: TaskBoundary = {
        type: 'end',
        timestamp: new Date().toISOString(),
        reason: 'inactivity',
        confidence: 0.8,
        context: { idle_time: timeSinceLastActivity }
      };
      
      await recordTaskBoundary(boundary);
      currentTaskStart = null;
    }
  } catch (error) {
    console.error("Task Detector Plugin: Error detecting boundaries:", error);
  }
}

// Detect task start
async function detectTaskStart(frame: any): Promise<TaskBoundary | null> {
  try {
    // Get previous frame for comparison
    const previousFrame = await pipe.db.query(`
      SELECT * FROM frames 
      WHERE timestamp < ?
      ORDER BY timestamp DESC
      LIMIT 1
    `, [frame.timestamp]);

    if (previousFrame.length === 0) return null;

    const prev = previousFrame[0];
    let confidence = 0;
    let reason = '';

    // Check for app changes
    if (frame.app_name !== prev.app_name) {
      confidence += 0.4;
      reason = 'app_change';
    }

    // Check for window changes
    if (frame.window_name !== prev.window_name) {
      confidence += 0.3;
      reason = reason ? 'app_and_window_change' : 'window_change';
    }

    // Check for URL changes (navigation)
    if (frame.browser_url !== prev.browser_url) {
      confidence += 0.3;
      reason = reason ? 'navigation_and_change' : 'navigation';
    }

    // Check for significant OCR changes (new content)
    const textDiff = (frame.ocr_text?.length || 0) - (prev.ocr_text?.length || 0);
    if (textDiff > 50) {
      confidence += 0.2;
      reason = reason ? `${reason}_with_content` : 'new_content';
    }

    if (confidence >= 0.5) {
      return {
        type: 'start',
        timestamp: frame.timestamp,
        reason,
        confidence,
        context: {
          app: frame.app_name,
          window: frame.window_name,
          url: frame.browser_url,
          text_change: textDiff
        }
      };
    }

    return null;
  } catch (error) {
    console.error("Task Detector Plugin: Error detecting task start:", error);
    return null;
  }
}

// Record task boundary
async function recordTaskBoundary(boundary: TaskBoundary) {
  try {
    await pipe.db.run(`
      INSERT INTO task_boundaries (type, timestamp, reason, confidence, context)
      VALUES (?, ?, ?, ?, ?)
    `, [
      boundary.type,
      boundary.timestamp,
      boundary.reason,
      boundary.confidence,
      JSON.stringify(boundary.context)
    ]);

    console.log(`Task Detector Plugin: Detected task ${boundary.type} (${boundary.reason})`);
  } catch (error) {
    console.error("Task Detector Plugin: Error recording boundary:", error);
  }
}

// Analyze recent tasks
async function analyzeRecentTasks() {
  try {
    // Get recent workflows
    const workflows = await pipe.db.query(`
      SELECT w.*, COUNT(a.id) as action_count
      FROM workflows w
      LEFT JOIN actions a ON w.id = a.workflow_id
      WHERE w.start_time > datetime('now', '-1 hour')
      GROUP BY w.id
      ORDER BY w.start_time DESC
    `);

    for (const workflow of workflows) {
      await analyzeWorkflow(workflow);
    }
  } catch (error) {
    console.error("Task Detector Plugin: Error analyzing tasks:", error);
  }
}

// Analyze individual workflow
async function analyzeWorkflow(workflow: any) {
  try {
    // Get actions for this workflow
    const actions = await pipe.db.query(`
      SELECT * FROM actions 
      WHERE workflow_id = ?
      ORDER BY timestamp ASC
    `, [workflow.id]);

    // Analyze workflow patterns
    const analysis: TaskAnalysis = {
      workflow_id: workflow.id,
      task_name: workflow.name,
      start_time: workflow.start_time,
      end_time: workflow.end_time || new Date().toISOString(),
      duration: calculateDuration(workflow.start_time, workflow.end_time),
      app_flow: getAppFlow(actions),
      action_count: actions.length,
      success: determineSuccess(workflow, actions),
      patterns: detectPatterns(actions)
    };

    // Save analysis
    await pipe.db.run(`
      INSERT OR REPLACE INTO task_analyses (
        workflow_id, task_name, start_time, end_time, duration,
        app_flow, action_count, success, patterns
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      analysis.workflow_id,
      analysis.task_name,
      analysis.start_time,
      analysis.end_time,
      analysis.duration,
      JSON.stringify(analysis.app_flow),
      analysis.action_count,
      analysis.success,
      JSON.stringify(analysis.patterns)
    ]);

    // Check for automation opportunities
    await checkAutomationOpportunities(analysis);

  } catch (error) {
    console.error("Task Detector Plugin: Error analyzing workflow:", error);
  }
}

// Check for automation opportunities
async function checkAutomationOpportunities(analysis: TaskAnalysis) {
  try {
    // Look for recurring patterns
    const similarTasks = await pipe.db.query(`
      SELECT COUNT(*) as count, task_name
      FROM task_analyses 
      WHERE task_name = ? AND workflow_id != ?
      GROUP BY task_name
    `, [analysis.task_name, analysis.workflow_id]);

    if (similarTasks.length > 0 && similarTasks[0].count >= 3) {
      // This is a recurring task - suggest automation
      await pipe.db.run(`
        INSERT OR REPLACE INTO automation_suggestions (
          task_name, frequency, last_performed, automation_potential
        ) VALUES (?, ?, ?, ?)
      `, [
        analysis.task_name,
        similarTasks[0].count + 1,
        analysis.start_time,
        calculateAutomationPotential(analysis)
      ]);

      console.log(`Task Detector Plugin: Found automation opportunity: ${analysis.task_name} (${similarTasks[0].count + 1} times)`);
    }
  } catch (error) {
    console.error("Task Detector Plugin: Error checking automation opportunities:", error);
  }
}

// Helper functions
function calculateDuration(start: string, end: string | null): number {
  if (!end) return 0;
  
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  return Math.floor((endTime - startTime) / 1000); // seconds
}

function getAppFlow(actions: any[]): string[] {
  const apps = [...new Set(actions.map(a => a.app).filter(Boolean))];
  return apps;
}

function determineSuccess(workflow: any, actions: any[]): boolean {
  // Simple heuristic: workflow is successful if it has multiple actions
  // and ended properly (not just abandoned)
  return actions.length > 3 && workflow.status === 'completed';
}

function detectPatterns(actions: any[]): string[] {
  const patterns: string[] = [];
  
  // Detect common patterns
  const actionTypes = actions.map(a => a.type);
  
  if (actionTypes.includes('navigate') && actionTypes.includes('click')) {
    patterns.push('web_interaction');
  }
  
  if (actionTypes.includes('keypress') && actionTypes.filter(t => t === 'keypress').length > 10) {
    patterns.push('text_input_heavy');
  }
  
  if (actionTypes.includes('focus') && actionTypes.filter(t => t === 'focus').length > 3) {
    patterns.push('multi_app_workflow');
  }
  
  return patterns;
}

function calculateAutomationPotential(analysis: TaskAnalysis): number {
  let potential = 0;
  
  // Factors that increase automation potential
  if (analysis.app_flow.length <= 3) potential += 0.3; // Simple app flow
  if (analysis.action_count > 5 && analysis.action_count < 20) potential += 0.2; // Moderate complexity
  if (analysis.patterns.includes('web_interaction')) potential += 0.2; // Web interactions are automatable
  if (analysis.success) potential += 0.1; // Successful workflow
  if (analysis.duration < 300) potential += 0.2; // Short duration (quick wins)
  
  return Math.min(potential, 1.0);
}

// Create required tables
async function createTables() {
  try {
    await pipe.db.exec(`
      CREATE TABLE IF NOT EXISTS task_boundaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT,
        timestamp DATETIME,
        reason TEXT,
        confidence REAL,
        context TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pipe.db.exec(`
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

    await pipe.db.exec(`
      CREATE TABLE IF NOT EXISTS automation_suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_name TEXT,
        frequency INTEGER,
        last_performed DATETIME,
        automation_potential REAL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Task Detector Plugin: Database tables created");
  } catch (error) {
    console.error("Task Detector Plugin: Error creating tables:", error);
  }
}

// API endpoints
pipe.api.get("/task-analyses", async (req, res) => {
  try {
    const analyses = await pipe.db.query(`
      SELECT * FROM task_analyses 
      ORDER BY start_time DESC
      LIMIT 50
    `);
    
    res.json({ analyses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

pipe.api.get("/automation-suggestions", async (req, res) => {
  try {
    const suggestions = await pipe.db.query(`
      SELECT * FROM automation_suggestions 
      ORDER BY automation_potential DESC, frequency DESC
    `);
    
    res.json({ suggestions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

pipe.api.get("/task-boundaries", async (req, res) => {
  try {
    const boundaries = await pipe.db.query(`
      SELECT * FROM task_boundaries 
      ORDER BY timestamp DESC
      LIMIT 100
    `);
    
    res.json({ boundaries });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialize the plugin
createTables().then(() => {
  initializeTaskDetection();
});

export default pipe;




