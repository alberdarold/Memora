import React, { useState, useEffect } from 'react';
import './StatsDashboard.css';

function StatsDashboard() {
  const [stats, setStats] = useState({
    workflows: 0,
    actions: 0,
    timeSpent: 0,
    automationReady: 0,
    streak: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      
      // Load workflows
      const workflowsResponse = await fetch('http://localhost:3031/api/plugins/action-capture/workflows');
      const workflowsData = await workflowsResponse.json();
      const workflows = workflowsData.workflows || [];

      // Load automation suggestions
      const suggestionsResponse = await fetch('http://localhost:3031/api/plugins/task-detector/automation-suggestions');
      const suggestionsData = await suggestionsResponse.json();
      const suggestions = suggestionsData.suggestions || [];

      // Calculate stats
      const totalActions = workflows.reduce((sum, w) => sum + (w.action_count || 0), 0);
      const totalTime = workflows.reduce((sum, w) => {
        if (w.start_time && w.end_time) {
          const start = new Date(w.start_time).getTime();
          const end = new Date(w.end_time).getTime();
          return sum + (end - start);
        }
        return sum;
      }, 0);

      setStats({
        workflows: workflows.length,
        actions: totalActions,
        timeSpent: Math.round(totalTime / (1000 * 60 * 60) * 10) / 10, // hours
        automationReady: suggestions.length,
        streak: calculateStreak(workflows)
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStreak = (workflows) => {
    // Simple streak calculation - count consecutive days with workflows
    const today = new Date();
    const dates = workflows.map(w => new Date(w.start_time).toDateString());
    const uniqueDates = [...new Set(dates)];
    
    let streak = 0;
    for (let i = 0; i < uniqueDates.length; i++) {
      const date = new Date(uniqueDates[i]);
      const daysDiff = Math.floor((today - date) / (1000 * 60 * 60 * 24));
      if (daysDiff === i) {
        streak++;
      } else {
        break;
      }
    }
    
    return streak;
  };

  if (loading) {
    return (
      <div className="stats-dashboard">
        <div className="loading">Loading statistics...</div>
      </div>
    );
  }

  return (
    <div className="stats-dashboard">
      <div className="stats-grid">
        <StatCard
          icon="📊"
          value={stats.workflows}
          label="workflows"
          subtitle="captured today"
        />
        <StatCard
          icon="⚡"
          value={stats.actions}
          label="actions"
          subtitle="recorded"
        />
        <StatCard
          icon="⏱️"
          value={stats.timeSpent}
          label="hours"
          subtitle="active time"
        />
        <StatCard
          icon="🤖"
          value={stats.automationReady}
          label="ready"
          subtitle="for automation"
        />
        <StatCard
          icon="🔥"
          value={stats.streak}
          label="day streak"
          subtitle="of activity"
        />
      </div>
      
      <div className="insights">
        <h3>Insights</h3>
        <div className="insight-list">
          {stats.automationReady > 0 && (
            <div className="insight-item">
              <span className="insight-icon">💡</span>
              <span className="insight-text">
                You have {stats.automationReady} workflows ready for automation!
              </span>
            </div>
          )}
          {stats.streak > 0 && (
            <div className="insight-item">
              <span className="insight-icon">🎯</span>
              <span className="insight-text">
                Great job! You've been active for {stats.streak} days in a row.
              </span>
            </div>
          )}
          {stats.workflows === 0 && (
            <div className="insight-item">
              <span className="insight-icon">🚀</span>
              <span className="insight-text">
                Start working and Memora will begin capturing your workflows automatically.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, value, label, subtitle }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
        <div className="stat-subtitle">{subtitle}</div>
      </div>
    </div>
  );
}

export default StatsDashboard;
