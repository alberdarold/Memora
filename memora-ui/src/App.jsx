import React, { useState, useEffect } from 'react';
import ActivityTimeline from './components/ActivityTimeline';
import StatsDashboard from './components/StatsDashboard';
import SearchAndFilter from './components/SearchAndFilter';
import AutomationPanel from './components/AutomationPanel';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('timeline');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🎯</span>
            <h1>Memora</h1>
            <span className="logo-tag">Basic</span>
            {isRecording && (
              <div className="recording-indicator">
                <span className="recording-dot">🔴</span>
                <span className="recording-text">Recording</span>
                <span className="recording-duration">{Math.floor(recordingDuration / 1000)}s</span>
                <span className="sound-indicator">🔊</span>
              </div>
            )}
          </div>
          
          <nav className="nav">
            <button 
              className={`nav-item ${currentView === 'timeline' ? 'active' : ''}`}
              onClick={() => setCurrentView('timeline')}
            >
              <span className="nav-icon">📅</span>
              Timeline
            </button>
            <button 
              className={`nav-item ${currentView === 'stats' ? 'active' : ''}`}
              onClick={() => setCurrentView('stats')}
            >
              <span className="nav-icon">📊</span>
              Stats
            </button>
            <button 
              className={`nav-item ${currentView === 'workflows' ? 'active' : ''}`}
              onClick={() => setCurrentView('workflows')}
            >
              <span className="nav-icon">⚡</span>
              Workflows
            </button>
            <button 
              className={`nav-item ${currentView === 'export' ? 'active' : ''}`}
              onClick={() => setCurrentView('export')}
            >
              <span className="nav-icon">🤖</span>
              Export
            </button>
          </nav>
        </div>
      </header>
      
      <main className="main-content">
        {currentView === 'timeline' && (
          <>
            <SearchAndFilter onSearch={() => {}} onFilterChange={() => {}} />
            <ActivityTimeline />
          </>
        )}
        {currentView === 'stats' && <StatsDashboard />}
        {currentView === 'workflows' && (
          <>
            <SearchAndFilter onSearch={() => {}} onFilterChange={() => {}} />
            <div className="coming-soon">Workflows view coming soon...</div>
          </>
        )}
        {currentView === 'export' && <AutomationPanel />}
      </main>
    </div>
  );
}

export default App;
