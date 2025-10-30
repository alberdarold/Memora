import React, { useState, useEffect } from 'react';
import './SearchAndFilter.css';

function SearchAndFilter({ onSearch, onFilterChange }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    dateRange: 'today',
    appName: '',
    duration: '',
    status: 'all'
  });
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      // Load recent workflow names for suggestions
      const response = await fetch('http://localhost:3030/api/plugins/action-capture/workflows?limit=50');
      if (response.ok) {
        const data = await response.json();
        const workflowNames = [...new Set(data.workflows?.map(w => w.name) || [])];
        setSuggestions(workflowNames);
      }
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const handleSearch = () => {
    onSearch(searchQuery);
  };

  const handleFilterChange = (newFilters) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    onFilterChange(updatedFilters);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearFilters = () => {
    const clearedFilters = {
      dateRange: 'today',
      appName: '',
      duration: '',
      status: 'all'
    };
    setFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  const filteredSuggestions = suggestions.filter(suggestion =>
    suggestion.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="search-and-filter">
      <div className="search-section">
        <div className="search-bar">
          <div className="search-input-container">
            <input
              type="text"
              placeholder="Search workflows... (e.g., 'Excel', 'SharePoint', 'email')"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(e.target.value.length > 0);
              }}
              onKeyPress={handleKeyPress}
              className="search-input"
            />
            <button onClick={handleSearch} className="search-btn">
              🔍
            </button>
          </div>
          
          {showSuggestions && filteredSuggestions.length > 0 && (
            <div className="suggestions-dropdown">
              {filteredSuggestions.slice(0, 5).map((suggestion, index) => (
                <div
                  key={index}
                  className="suggestion-item"
                  onClick={() => {
                    setSearchQuery(suggestion);
                    setShowSuggestions(false);
                    onSearch(suggestion);
                  }}
                >
                  {suggestion}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="filters-section">
        <div className="filter-group">
          <label htmlFor="dateRange">Time Period:</label>
          <select
            id="dateRange"
            value={filters.dateRange}
            onChange={(e) => handleFilterChange({ dateRange: e.target.value })}
            className="filter-select"
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="appName">App:</label>
          <select
            id="appName"
            value={filters.appName}
            onChange={(e) => handleFilterChange({ appName: e.target.value })}
            className="filter-select"
          >
            <option value="">All Apps</option>
            <option value="Excel">Excel</option>
            <option value="Chrome">Chrome</option>
            <option value="Firefox">Firefox</option>
            <option value="Cursor">Cursor</option>
            <option value="VS Code">VS Code</option>
            <option value="Word">Word</option>
            <option value="PowerPoint">PowerPoint</option>
            <option value="Outlook">Outlook</option>
            <option value="Teams">Teams</option>
            <option value="Slack">Slack</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="duration">Duration:</label>
          <select
            id="duration"
            value={filters.duration}
            onChange={(e) => handleFilterChange({ duration: e.target.value })}
            className="filter-select"
          >
            <option value="">Any Duration</option>
            <option value="short">Under 1 minute</option>
            <option value="medium">1-5 minutes</option>
            <option value="long">5+ minutes</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="status">Status:</label>
          <select
            id="status"
            value={filters.status}
            onChange={(e) => handleFilterChange({ status: e.target.value })}
            className="filter-select"
          >
            <option value="all">All</option>
            <option value="completed">Completed</option>
            <option value="in_progress">In Progress</option>
          </select>
        </div>

        <button onClick={clearFilters} className="clear-filters-btn">
          Clear All
        </button>
      </div>

      <div className="quick-filters">
        <h4>Quick Filters</h4>
        <div className="quick-filter-buttons">
          <button 
            className="quick-filter-btn"
            onClick={() => {
              setSearchQuery('Excel');
              handleSearch();
            }}
          >
            📊 Excel Work
          </button>
          <button 
            className="quick-filter-btn"
            onClick={() => {
              setSearchQuery('email');
              handleSearch();
            }}
          >
            📧 Email Tasks
          </button>
          <button 
            className="quick-filter-btn"
            onClick={() => {
              setSearchQuery('SharePoint');
              handleSearch();
            }}
          >
            📁 SharePoint
          </button>
          <button 
            className="quick-filter-btn"
            onClick={() => {
              setSearchQuery('coding');
              handleSearch();
            }}
          >
            💻 Coding Work
          </button>
          <button 
            className="quick-filter-btn"
            onClick={() => {
              handleFilterChange({ duration: 'short' });
            }}
          >
            ⚡ Quick Tasks
          </button>
          <button 
            className="quick-filter-btn"
            onClick={() => {
              handleFilterChange({ status: 'in_progress' });
            }}
          >
            🔄 Active Work
          </button>
        </div>
      </div>
    </div>
  );
}

export default SearchAndFilter;




