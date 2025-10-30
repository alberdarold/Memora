import React, { useState, useEffect } from 'react';
import WorkflowDetails from './WorkflowDetails';
import './ActivityTimeline.css';

function ActivityTimeline() {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(null);

  useEffect(() => {
    loadWorkflows();
    
    // Refresh data every 30 seconds to catch new recordings
    const interval = setInterval(() => {
      loadWorkflows();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const loadWorkflows = async () => {
    try {
      setLoading(true);
      
      // Fetch from both Screenpipe (actual recordings) and our plugins service (metadata)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const [screenpipeResponse, pluginsResponse] = await Promise.allSettled([
        fetch('http://localhost:3030/search?limit=1000&offset=0', { 
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        }),
        fetch('http://localhost:3031/api/plugins/action-capture/workflows', { 
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        })
      ]);
      
      clearTimeout(timeoutId);
      
      let workflows = [];
      
      // Process Screenpipe data (actual recordings)
      if (screenpipeResponse.status === 'fulfilled' && screenpipeResponse.value.ok) {
        const screenpipeData = await screenpipeResponse.value.json();
        
        // Group frames by file_path and time proximity to create workflows
        const frameGroups = {};
        (screenpipeData.data || []).forEach(frame => {
          const filePath = frame.content.file_path;
          if (!frameGroups[filePath]) {
            frameGroups[filePath] = [];
          }
          frameGroups[filePath].push(frame);
        });
        
        // Create workflows from grouped frames
        const screenpipeWorkflows = Object.entries(frameGroups).map(([filePath, frames]) => {
          // Sort frames by frame_id to get chronological order
          frames.sort((a, b) => a.content.frame_id - b.content.frame_id);
          
          const firstFrame = frames[0];
          const lastFrame = frames[frames.length - 1];
          
          // Extract timestamp from file path and convert to proper format
          const timestampMatch = filePath.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
          let startTime;
          
          if (timestampMatch) {
            // Convert "2025-10-25_21-23-57" to "2025-10-25T21:23:57.000Z"
            const timestampStr = timestampMatch[1].replace(/_/g, 'T').replace(/-/g, '-') + '.000Z';
            startTime = new Date(timestampStr);
          } else {
            // Fallback to current time
            startTime = new Date();
          }
          
          // Calculate duration based on frame count (assuming ~1 frame per second)
          const estimatedDuration = frames.length * 1000; // milliseconds
          
          // Validate startTime first
          if (isNaN(startTime.getTime())) {
            startTime = new Date();
          }
          
          // Calculate endTime
          const endTime = new Date(startTime.getTime() + estimatedDuration);
          
          // Validate endTime
          if (isNaN(endTime.getTime())) {
            endTime = new Date(startTime.getTime() + estimatedDuration);
          }
          
          // Extract meaningful text snippets for workflow name
          const textSamples = frames.slice(0, 3).map(f => f.content.text.substring(0, 100)).join(' ');
          const workflowName = firstFrame.content.window_name || 
            `${firstFrame.content.app_name} Session`;
          
          return {
            id: `screenpipe_${firstFrame.content.frame_id}`,
            name: workflowName,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            app_context: firstFrame.content.app_name || 'Unknown',
            status: 'completed',
            source: 'screenpipe',
            file_path: filePath,
            window_name: firstFrame.content.window_name,
            text_content: textSamples,
            frame_count: frames.length,
            estimated_duration: estimatedDuration,
             frames: frames.map(f => ({
               id: f.content.frame_id,
               text: f.content.text,
               timestamp: f.content.timestamp,
               app_name: f.content.app_name,
               window_name: f.content.window_name,
               focused: f.content.focused
             })),
             // Generate virtual actions based on text changes (simplified for performance)
             virtual_actions: frames.length > 1 ? generateSimpleActions(frames) : []
          };
        });
        
        workflows = [...workflows, ...screenpipeWorkflows];
        console.log(`📊 Loaded ${screenpipeWorkflows.length} Screenpipe workflows from ${Object.keys(frameGroups).length} recording files`);
      }
      
      // Process plugins service data (workflow metadata)
      if (pluginsResponse.status === 'fulfilled' && pluginsResponse.value.ok) {
        const pluginsData = await pluginsResponse.value.json();
        const pluginWorkflows = (pluginsData.workflows || []).map(workflow => ({
          ...workflow,
          source: 'plugins'
        }));
        workflows = [...workflows, ...pluginWorkflows];
        console.log(`📊 Loaded ${pluginWorkflows.length} plugin workflows`);
      }
      
      // Sort by timestamp (newest first)
      workflows.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
      
      setWorkflows(workflows);
      setError(null);
      console.log(`🎯 Total workflows loaded: ${workflows.length} (${workflows.filter(w => w.source === 'screenpipe').length} Screenpipe + ${workflows.filter(w => w.source === 'plugins').length} plugins)`);
    } catch (err) {
      console.error('Error loading workflows:', err);
      setError('Error loading workflows: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return 'Invalid time';
      }
      return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    } catch (error) {
      return 'Invalid time';
    }
  };

  const formatDuration = (startTime, endTime) => {
    try {
      if (!endTime) return 'ongoing';
      
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return 'Invalid duration';
      }
      
      const diffMs = end.getTime() - start.getTime();
      
      const minutes = Math.floor(diffMs / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);
      
      if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
      }
      return `${seconds}s`;
    } catch (error) {
      return 'Invalid duration';
    }
  };

  const getTaskIcon = (taskName) => {
    const name = taskName.toLowerCase();
    if (name.includes('excel')) return '📊';
    if (name.includes('email')) return '📧';
    if (name.includes('code') || name.includes('coding')) return '💻';
    if (name.includes('web') || name.includes('browser')) return '🌐';
    if (name.includes('document') || name.includes('word')) return '📄';
    return '⚡';
  };

  // Generate simple actions for better performance
  const generateSimpleActions = (frames) => {
    try {
      if (!frames || frames.length < 2) return [];
      
      const actions = [];
      const firstFrame = frames[0];
      const lastFrame = frames[frames.length - 1];
      
      // Just add basic actions without complex text analysis
      actions.push({
        id: `action_${firstFrame.content.frame_id}_start`,
        type: 'session_start',
        target: 'Workflow',
        value: firstFrame.content.app_name,
        timestamp: firstFrame.content.timestamp || new Date().toISOString(),
        description: `Started ${firstFrame.content.app_name} session`
      });
      
      if (frames.length > 10) {
        actions.push({
          id: `action_${lastFrame.content.frame_id}_activity`,
          type: 'activity',
          target: 'Content',
          value: `${frames.length} frames captured`,
          timestamp: lastFrame.content.timestamp || new Date().toISOString(),
          description: `Captured ${frames.length} frames of activity`
        });
      }
      
      return actions;
    } catch (error) {
      console.error('Error generating simple actions:', error);
      return [];
    }
  };

  // Generate virtual actions based on OCR text changes
  const generateVirtualActions = (frames) => {
    try {
      if (!frames || frames.length < 2) {
        return [];
      }
      
      const actions = [];
      
      for (let i = 1; i < frames.length; i++) {
      const prevFrame = frames[i - 1];
      const currentFrame = frames[i];
      
      const prevText = prevFrame.content.text || '';
      const currentText = currentFrame.content.text || '';
      
      // Detect text additions (typing)
      if (currentText.length > prevText.length) {
        const addedText = currentText.substring(prevText.length);
        if (addedText.trim().length > 0) {
          actions.push({
            id: `action_${currentFrame.content.frame_id}_type`,
            type: 'type',
            target: 'Text input',
            value: addedText.substring(0, 50) + (addedText.length > 50 ? '...' : ''),
            timestamp: currentFrame.content.timestamp || new Date().toISOString(),
            description: `Typed: "${addedText.substring(0, 30)}${addedText.length > 30 ? '...' : ''}"`
          });
        }
      }
      
      // Detect text deletions
      if (currentText.length < prevText.length) {
        const deletedLength = prevText.length - currentText.length;
        actions.push({
          id: `action_${currentFrame.content.frame_id}_delete`,
          type: 'delete',
          target: 'Text input',
          value: `${deletedLength} characters`,
          timestamp: currentFrame.content.timestamp || new Date().toISOString(),
          description: `Deleted ${deletedLength} characters`
        });
      }
      
      // Detect significant text changes (form filling, editing)
      if (currentText !== prevText && currentText.length > 10) {
        const similarity = calculateTextSimilarity(prevText, currentText);
        if (similarity < 0.8) { // Less than 80% similar
          actions.push({
            id: `action_${currentFrame.content.frame_id}_edit`,
            type: 'edit',
            target: 'Content',
            value: 'Text modified',
            timestamp: currentFrame.content.timestamp || new Date().toISOString(),
            description: 'Significant text change detected'
          });
        }
      }
      
      // Detect window/app changes
      if (prevFrame.content.app_name !== currentFrame.content.app_name) {
        actions.push({
          id: `action_${currentFrame.content.frame_id}_switch`,
          type: 'switch_app',
          target: 'Application',
          value: currentFrame.content.app_name,
          timestamp: currentFrame.content.timestamp || new Date().toISOString(),
          description: `Switched to ${currentFrame.content.app_name}`
        });
      }
    }
    
    return actions;
    } catch (error) {
      console.error('Error generating virtual actions:', error);
      return [];
    }
  };

  // Calculate text similarity (simple implementation)
  const calculateTextSimilarity = (text1, text2) => {
    const longer = text1.length > text2.length ? text1 : text2;
    const shorter = text1.length > text2.length ? text2 : text1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  };

  // Levenshtein distance calculation
  const levenshteinDistance = (str1, str2) => {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  if (loading) {
    return (
      <div className="activity-timeline">
        <div className="loading">Loading your activities...</div>
        <div className="loading-hint">This may take a moment while we process your recordings</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="activity-timeline">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="activity-timeline">
      <div className="timeline-header">
        <h2>TODAY</h2>
        <div className="stats">
          <span className="stat">
            <span className="stat-number">{workflows.length}</span>
            <span className="stat-label">workflows</span>
          </span>
          <button 
            className="refresh-btn"
            onClick={loadWorkflows}
            title="Refresh workflows"
          >
            🔄
          </button>
        </div>
      </div>

      <div className="timeline-content">
        {workflows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎯</div>
            <h3>No workflows captured yet</h3>
            <p>Start working and Memora will automatically detect and record your tasks.</p>
          </div>
        ) : (
          workflows.map((workflow) => (
            <ActivityCard 
              key={workflow.id} 
              workflow={workflow}
              formatTime={formatTime}
              formatDuration={formatDuration}
              getTaskIcon={getTaskIcon}
            />
          ))
        )}
      </div>

      {selectedWorkflowId && (
        <WorkflowDetails 
          workflowId={selectedWorkflowId}
          onClose={() => setSelectedWorkflowId(null)}
        />
      )}
    </div>
  );
}

function ActivityCard({ workflow, formatTime, formatDuration, getTaskIcon }) {
  const [expanded, setExpanded] = useState(false);
  const [actions, setActions] = useState([]);
  const [loadingActions, setLoadingActions] = useState(false);

  const loadActions = async () => {
    if (actions.length > 0) return;
    
    setLoadingActions(true);
    try {
      // For Screenpipe workflows, use virtual actions
      if (workflow.source === 'screenpipe' && workflow.virtual_actions) {
        setActions(workflow.virtual_actions);
      } else {
        // For plugin workflows, fetch from API
        const response = await fetch(`http://localhost:3031/api/plugins/action-capture/workflows/${workflow.id}/actions`);
        if (response.ok) {
          const data = await response.json();
          setActions(data.actions || []);
        }
      }
    } catch (err) {
      console.error('Error loading actions:', err);
    } finally {
      setLoadingActions(false);
    }
  };

  const handleExpand = () => {
    if (!expanded) {
      loadActions();
    }
    setExpanded(!expanded);
  };

  const handleAutomate = () => {
    // TODO: Implement automation export
    console.log('Automate workflow:', workflow.id);
  };

  return (
    <div className={`activity-card ${expanded ? 'expanded' : ''}`}>
      <div className="activity-main" onClick={handleExpand}>
        <div className="activity-time">
          {formatTime(workflow.start_time)}
        </div>
        
        <div className="activity-content">
          <div className="activity-title">
            <span className="activity-icon">
              {workflow.source === 'screenpipe' ? '🎥' : getTaskIcon(workflow.name)}
            </span>
            {workflow.name}
            {workflow.source === 'screenpipe' && (
              <span className="source-badge">Screenpipe</span>
            )}
          </div>
          
          <div className="activity-details">
            {workflow.app_context} · {formatDuration(workflow.start_time, workflow.end_time)}
            {workflow.action_count > 0 && (
              <span className="action-count">{workflow.action_count} actions</span>
            )}
            {workflow.frame_count > 0 && (
              <span className="frame-count">{workflow.frame_count} frames</span>
            )}
            {workflow.estimated_duration && (
              <span className="duration-badge">{Math.round(workflow.estimated_duration/1000)}s</span>
            )}
            {workflow.window_name && (
              <span className="window-name" title={workflow.window_name}>
                {workflow.window_name.length > 50 ? 
                  workflow.window_name.substring(0, 50) + '...' : 
                  workflow.window_name}
              </span>
            )}
          </div>
          
          {workflow.status === 'in_progress' && (
            <div className="status-badge ongoing">Ongoing</div>
          )}
        </div>
        
        <div className="activity-actions">
          <button 
            className="expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleExpand();
            }}
          >
            {expanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="activity-details-panel">
          {loadingActions ? (
            <div className="loading-actions">Loading actions...</div>
          ) : (
            <div className="actions-list">
              <h4>Actions ({actions.length})</h4>
               {actions.map((action, index) => (
                 <div key={action.id} className="action-item">
                   <span className="action-order">{index + 1}</span>
                   <span className="action-type">{action.type}</span>
                   <span className="action-target">
                     {action.description || action.target}
                     {action.value && ` - ${action.value}`}
                   </span>
                   <span className="action-time">{formatTime(action.timestamp)}</span>
                 </div>
               ))}
              
              <div className="workflow-actions">
                <button 
                  className="btn-secondary"
                  onClick={() => setSelectedWorkflowId(workflow.id)}
                >
                  View Details
                </button>
                <button className="btn-primary" onClick={handleAutomate}>
                  Automate This
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ActivityTimeline;
