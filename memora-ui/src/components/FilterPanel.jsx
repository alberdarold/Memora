import React, { useState } from 'react';
import './FilterPanel.css';

function FilterPanel({ onFilterChange }) {
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    appName: ''
  });
  
  const handleChange = (field, value) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };
  
  return (
    <div className="filter-panel">
      <h3>Filters</h3>
      <div className="filter-group">
        <label>From Date:</label>
        <input
          type="datetime-local"
          value={filters.startDate}
          onChange={(e) => handleChange('startDate', e.target.value)}
        />
      </div>
      
      <div className="filter-group">
        <label>To Date:</label>
        <input
          type="datetime-local"
          value={filters.endDate}
          onChange={(e) => handleChange('endDate', e.target.value)}
        />
      </div>
      
      <div className="filter-group">
        <label>App Name:</label>
        <input
          type="text"
          value={filters.appName}
          onChange={(e) => handleChange('appName', e.target.value)}
          placeholder="Filter by app..."
        />
      </div>
      
      <button 
        className="clear-filters"
        onClick={() => {
          setFilters({ startDate: '', endDate: '', appName: '' });
          onFilterChange({ startDate: '', endDate: '', appName: '' });
        }}
      >
        Clear Filters
      </button>
    </div>
  );
}

export default FilterPanel;




