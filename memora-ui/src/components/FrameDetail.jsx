import React from 'react';
import './FrameDetail.css';

function FrameDetail({ frame, onClose }) {
  if (!frame) return null;
  
  return (
    <div className="frame-detail-overlay" onClick={onClose}>
      <div className="frame-detail" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>×</button>
        
        {frame.content?.file_path && (
          <img 
            src={`file:///${frame.content.file_path}`}
            alt="Screen capture"
            className="frame-image"
          />
        )}
        
        <div className="frame-metadata">
          <h3>Details</h3>
          <p><strong>App:</strong> {frame.content?.app_name}</p>
          <p><strong>Window:</strong> {frame.content?.window_name}</p>
          <p><strong>Time:</strong> {new Date(frame.content?.timestamp).toLocaleString()}</p>
          <p><strong>Text:</strong></p>
          <pre className="ocr-text">{frame.content?.text}</pre>
        </div>
      </div>
    </div>
  );
}

export default FrameDetail;




