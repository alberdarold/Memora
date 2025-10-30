import React, { useState, useEffect } from 'react';
import './AutomationPanel.css';

function AutomationPanel() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [automationScript, setAutomationScript] = useState('');
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    loadAutomationSuggestions();
  }, []);

  const loadAutomationSuggestions = async () => {
    try {
      setLoading(true);
      
      // Load automation suggestions from task-detector plugin
      const response = await fetch('http://localhost:3031/api/plugins/task-detector/automation-suggestions');
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Error loading automation suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWorkflowSelect = async (workflowId) => {
    try {
      // Load workflow details and generate automation script
      const response = await fetch(`http://localhost:3031/api/plugins/action-capture/workflows/${workflowId}/export`);
      if (response.ok) {
        const data = await response.json();
        setSelectedWorkflow(data);
        setAutomationScript(data.automation?.script || '');
      }
    } catch (error) {
      console.error('Error loading workflow:', error);
    }
  };

  const generateAutomationScript = (workflow) => {
    if (!workflow || !workflow.steps) return '';

    let script = `# Automation Script for: ${workflow.task.name}\n`;
    script += `# Generated on: ${new Date().toISOString()}\n`;
    script += `# Duration: ${workflow.task.duration}\n\n`;
    
    script += `import pyautogui\n`;
    script += `import time\n`;
    script += `import webbrowser\n\n`;
    
    script += `# Configuration\n`;
    script += `pyautogui.PAUSE = 0.5  # Pause between actions\n`;
    script += `pyautogui.FAILSAFE = True  # Move mouse to corner to stop\n\n`;
    
    script += `def automate_workflow():\n`;
    script += `    """Automate: ${workflow.task.name}"""\n`;
    script += `    print("Starting automation: ${workflow.task.name}")\n\n`;
    
    workflow.steps.forEach((step, index) => {
      script += `    # Step ${index + 1}: ${step.action}\n`;
      
      switch (step.action) {
        case 'click':
          if (step.coordinates) {
            script += `    pyautogui.click(${step.coordinates.x}, ${step.coordinates.y})\n`;
          } else {
            script += `    # TODO: Click on "${step.target}"\n`;
          }
          break;
        case 'navigate':
          script += `    webbrowser.open("${step.target}")\n`;
          script += `    time.sleep(2)  # Wait for page to load\n`;
          break;
        case 'keypress':
          if (step.key) {
            script += `    pyautogui.press("${step.key}")\n`;
          } else {
            script += `    # TODO: Type "${step.target}"\n`;
          }
          break;
        case 'focus':
          script += `    # Focus on: ${step.target}\n`;
          break;
        default:
          script += `    # TODO: Handle ${step.action} action\n`;
      }
      
      script += `    time.sleep(0.5)\n\n`;
    });
    
    script += `    print("Automation completed!")\n\n`;
    script += `if __name__ == "__main__":\n`;
    script += `    automate_workflow()\n`;
    
    return script;
  };

  const handlePreview = () => {
    if (selectedWorkflow) {
      const script = generateAutomationScript(selectedWorkflow);
      setAutomationScript(script);
      setPreviewMode(true);
    }
  };

  const handleExport = () => {
    if (automationScript) {
      const blob = new Blob([automationScript], { type: 'text/python' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `automation_${selectedWorkflow?.task?.name?.replace(/\s+/g, '_') || 'workflow'}.py`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleRunPreview = () => {
    alert('Preview mode - this would show you exactly what the automation would do without actually executing it.');
  };

  if (loading) {
    return (
      <div className="automation-panel">
        <div className="loading">Loading automation suggestions...</div>
      </div>
    );
  }

  return (
    <div className="automation-panel">
      <div className="automation-header">
        <h2>🤖 Automation Center</h2>
        <p>Transform your workflows into automated scripts</p>
      </div>

      <div className="automation-content">
        <div className="suggestions-section">
          <h3>Ready for Automation</h3>
          <div className="suggestions-grid">
            {suggestions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎯</div>
                <h4>No automation suggestions yet</h4>
                <p>Keep working and Memora will identify workflows ready for automation.</p>
              </div>
            ) : (
              suggestions.map((suggestion) => (
                <div 
                  key={suggestion.id} 
                  className="suggestion-card"
                  onClick={() => handleWorkflowSelect(suggestion.id)}
                >
                  <div className="suggestion-header">
                    <h4>{suggestion.task_name}</h4>
                    <div className="suggestion-badge">
                      {suggestion.frequency}x this week
                    </div>
                  </div>
                  <div className="suggestion-details">
                    <div className="detail-item">
                      <span className="detail-label">Potential:</span>
                      <span className="detail-value">
                        {Math.round(suggestion.automation_potential * 100)}%
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Last done:</span>
                      <span className="detail-value">
                        {new Date(suggestion.last_performed).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="suggestion-actions">
                    <button className="btn-primary">
                      Automate This
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {selectedWorkflow && (
          <div className="automation-workspace">
            <div className="workspace-header">
              <h3>Automation Script</h3>
              <div className="workspace-actions">
                <button 
                  className="btn-secondary"
                  onClick={handlePreview}
                >
                  🔍 Preview
                </button>
                <button 
                  className="btn-primary"
                  onClick={handleExport}
                >
                  📥 Export Script
                </button>
              </div>
            </div>

            <div className="script-editor">
              <div className="script-header">
                <span className="script-title">
                  {selectedWorkflow.task?.name || 'Workflow Automation'}
                </span>
                <span className="script-confidence">
                  Confidence: {Math.round((selectedWorkflow.automation?.confidence || 0.8) * 100)}%
                </span>
              </div>
              
              <textarea
                value={automationScript}
                onChange={(e) => setAutomationScript(e.target.value)}
                className="script-textarea"
                placeholder="Automation script will appear here..."
                readOnly={!previewMode}
              />
            </div>

            {previewMode && (
              <div className="preview-controls">
                <button 
                  className="btn-secondary"
                  onClick={handleRunPreview}
                >
                  ▶️ Run Preview
                </button>
                <button 
                  className="btn-primary"
                  onClick={() => setPreviewMode(false)}
                >
                  ✏️ Edit Script
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="automation-help">
        <h4>💡 How it works</h4>
        <div className="help-steps">
          <div className="help-step">
            <span className="step-number">1</span>
            <span className="step-text">Memora watches your workflows</span>
          </div>
          <div className="help-step">
            <span className="step-number">2</span>
            <span className="step-text">Identifies repetitive tasks</span>
          </div>
          <div className="help-step">
            <span className="step-number">3</span>
            <span className="step-text">Generates automation scripts</span>
          </div>
          <div className="help-step">
            <span className="step-number">4</span>
            <span className="step-text">Export and run with AI tools</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AutomationPanel;
