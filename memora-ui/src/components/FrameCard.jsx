import React from 'react';
import './FrameCard.css';

function FrameCard({ frame, onClick }) {
  const timestamp = new Date(frame.content?.timestamp);
  const text = frame.content?.text || '';
  const appName = frame.content?.app_name || 'Unknown';
  
  return (
    <div className="frame-card" onClick={() => onClick(frame)}>
      {frame.content?.file_path && (
        <img 
          src={`file:///${frame.content.file_path}`}
          alt="Screen capture"
          className="frame-thumbnail"
        />
      )}
      
      <div className="frame-info">
        <p className="frame-app">{appName}</p>
        <p className="frame-text">{text.substring(0, 150)}...</p>
        <p className="frame-time">{timestamp.toLocaleString()}</p>
      </div>
    </div>
  );
}

export default FrameCard;




