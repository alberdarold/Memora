# Screenpipe API Documentation

## Base URL
`http://localhost:3030`

## Available Endpoints

### 1. Health Check
- **URL:** `/health`
- **Method:** GET
- **Description:** Check if Screenpipe service is running
- **Response:**
```json
{
  "status": "healthy",
  "status_code": 200,
  "last_frame_timestamp": "2025-10-25T19:46:55.386394900Z",
  "last_audio_timestamp": "2025-10-25T19:46:57Z",
  "last_ui_timestamp": null,
  "frame_status": "ok",
  "audio_status": "ok"
}
```

### 2. Search Frames
- **URL:** `/search`
- **Method:** GET
- **Description:** Get captured frames with OCR data
- **Query Parameters:**
  - `limit` (optional): Number of frames to return (default: all)
  - `offset` (optional): Number of frames to skip (default: 0)
- **Response:**
```json
{
  "data": [
    {
      "type": "OCR",
      "content": {
        "frame_id": 57,
        "text": "OCR extracted text...",
        "timestamp": "2025-10-25T19:46:55.386394900Z",
        "file_path": "C:\\Users\\DISTRICTS\\.screenpipe\\data\\monitor_65537_2025-10-25_19-44-57.mp4",
        "offset_index": 55,
        "app_name": "Cursor",
        "window_name": "● screen-recording-mvp.plan.md - Memora - Cursor",
        "tags": [],
        "frame": null,
        "frame_name": "C:\\Users\\DISTRICTS\\.screenpipe\\data\\monitor_65537_2025-10-25_19-44-57.mp4",
        "browser_url": null,
        "focused": true
      }
    }
  ]
}
```

## Data Structure

### Frame Content
- `frame_id`: Unique identifier for the frame
- `text`: OCR extracted text from the frame
- `timestamp`: When the frame was captured (ISO 8601 format)
- `file_path`: Path to the video file containing the frame
- `offset_index`: Frame index within the video file
- `app_name`: Name of the active application
- `window_name`: Title of the active window
- `tags`: User-defined tags (array)
- `frame`: Frame data (null in current response)
- `frame_name`: Name of the frame file
- `browser_url`: URL if captured from browser (null if not)
- `focused`: Whether the window was focused when captured

## Usage Examples

### Get Recent Frames
```javascript
const response = await fetch('http://localhost:3030/search?limit=20');
const data = await response.json();
console.log('Recent frames:', data.data.length);
```

### Check Service Health
```javascript
const response = await fetch('http://localhost:3030/health');
const health = await response.json();
console.log('Service status:', health.status);
```

## Notes
- Screenpipe captures both screen and audio data
- OCR text is extracted automatically from each frame
- Data is stored locally in `~/.screenpipe/data/`
- The service runs continuously in the background
- All timestamps are in UTC




