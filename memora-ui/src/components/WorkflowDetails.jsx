import React, { useState, useEffect } from 'react';
import './WorkflowDetails.css';

function WorkflowDetails({ workflowId, onClose }) {
  const [workflow, setWorkflow] = useState(null);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedStep, setSelectedStep] = useState(0);

  useEffect(() => {
    if (workflowId) {
      loadWorkflowDetails();
    }
  }, [workflowId]);

  const loadWorkflowDetails = async () => {
    try {
      setLoading(true);
      
      // Load workflow details
      const workflowResponse = await fetch(`http://localhost:3031/api/plugins/action-capture/workflows/${workflowId}`);
      if (!workflowResponse.ok) {
        throw new Error('Failed to load workflow');
      }
      const workflowData = await workflowResponse.json();
      setWorkflow(workflowData.workflow);

      // Load actions
      const actionsResponse = await fetch(`http://localhost:3031/api/plugins/action-capture/workflows/${workflowId}/actions`);
      if (!actionsResponse.ok) {
        throw new Error('Failed to load actions');
      }
      const actionsData = await actionsResponse.json();
      setActions(actionsData.actions || []);
      
    } catch (err) {
      setError('Error loading workflow details: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true 
    });
  };

  const formatDuration = (startTime, endTime) => {
    if (!endTime) return 'ongoing';
    
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const diffMs = end - start;
    
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const getActionIcon = (actionType) => {
    switch (actionType) {
      case 'click': return '🖱️';
      case 'keypress': return '⌨️';
      case 'navigate': return '🌐';
      case 'focus': return '👁️';
      case 'scroll': return '📜';
      default: return '⚡';
    }
  };

  const handleAutomate = async () => {
    try {
      const response = await fetch(`http://localhost:3031/api/plugins/action-capture/workflows/${workflowId}/export`);
      if (response.ok) {
        const exportData = await response.json();
        
        // Create downloadable file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `workflow_${workflowId}_export.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('Workflow exported! You can now use this with AI automation tools.');
      } else {
        throw new Error('Failed to export workflow');
      }
    } catch (err) {
      alert('Error exporting workflow: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="workflow-details-overlay">
        <div className="workflow-details-content">
          <div className="loading">Loading workflow details...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="workflow-details-overlay">
        <div className="workflow-details-content">
          <div className="error">{error}</div>
          <button onClick={onClose} className="close-btn">Close</button>
        </div>
      </div>
    );
  }

  if (!workflow) {
    return null;
  }

  return (
    <div className="workflow-details-overlay" onClick={onClose}>
      <div className="workflow-details-content" onClick={(e) => e.stopPropagation()}>
        <div className="workflow-header">
          <div className="workflow-title">
            <h2>{workflow.name}</h2>
            <div className="workflow-meta">
              <span className="workflow-time">{formatTime(workflow.start_time)}</span>
              <span className="workflow-duration">{formatDuration(workflow.start_time, workflow.end_time)}</span>
              <span className="workflow-app">{workflow.app_context}</span>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="workflow-content">
          <div className="workflow-steps">
            <h3>Steps ({actions.length})</h3>
            <div className="steps-list">
              {actions.map((action, index) => (
                <div 
                  key={action.id} 
                  className={`step-item ${selectedStep === index ? 'selected' : ''}`}
                  onClick={() => setSelectedStep(index)}
                >
                  <div className="step-number">{index + 1}</div>
                  <div className="step-icon">{getActionIcon(action.type)}</div>
                  <div className="step-content">
                    <div className="step-action">{action.type}</div>
                    <div className="step-target">{action.target || 'No target'}</div>
                    <div className="step-time">{formatTime(action.timestamp)}</div>
                  </div>
                  {action.context && (
                    <div className="step-context">{action.context}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="workflow-preview">
            <h3>Step Details</h3>
            {actions[selectedStep] && (
              <div className="step-details">
                <div className="step-header">
                  <span className="step-icon-large">{getActionIcon(actions[selectedStep].type)}</span>
                  <div>
                    <h4>Step {selectedStep + 1}: {actions[selectedStep].type}</h4>
                    <p className="step-target-large">{actions[selectedStep].target}</p>
                  </div>
                </div>
                
                <div className="step-info">
                  <div className="info-item">
                    <label>Time:</label>
                    <span>{formatTime(actions[selectedStep].timestamp)}</span>
                  </div>
                  {actions[selectedStep].app && (
                    <div className="info-item">
                      <label>App:</label>
                      <span>{actions[selectedStep].app}</span>
                    </div>
                  )}
                  {actions[selectedStep].window && (
                    <div className="info-item">
                      <label>Window:</label>
                      <span>{actions[selectedStep].window}</span>
                    </div>
                  )}
                  {actions[selectedStep].coordinates && (
                    <div className="info-item">
                      <label>Coordinates:</label>
                      <span>{JSON.parse(actions[selectedStep].coordinates).x}, {JSON.parse(actions[selectedStep].coordinates).y}</span>
                    </div>
                  )}
                </div>

                {actions[selectedStep].context && (
                  <div className="step-context-large">
                    <label>Context:</label>
                    <p>{actions[selectedStep].context}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="workflow-actions">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn-primary" onClick={handleAutomate}>
            🤖 Automate This Workflow
          </button>
        </div>
      </div>
    </div>
  );
}

export default WorkflowDetails;
