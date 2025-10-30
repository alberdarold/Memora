const SCREENPIPE_URL = 'http://localhost:3030';

export const screenpipeAPI = {
  async search(query, limit = 50) {
    const url = new URL(`${SCREENPIPE_URL}/search`);
    if (query) {
      // For now, we'll do client-side filtering since Screenpipe doesn't seem to support query parameter
      // In the future, we might need to implement server-side search
    }
    if (limit) {
      url.searchParams.set('limit', limit);
    }
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to search: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // If query is provided, filter results client-side
    if (query) {
      data.data = data.data.filter(frame => 
        frame.content?.text?.toLowerCase().includes(query.toLowerCase()) ||
        frame.content?.app_name?.toLowerCase().includes(query.toLowerCase()) ||
        frame.content?.window_name?.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    return data;
  },
  
  async getRecentFrames(limit = 20) {
    const response = await fetch(`${SCREENPIPE_URL}/search?limit=${limit}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get recent frames: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  },
  
  async getHealth() {
    const response = await fetch(`${SCREENPIPE_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get health status: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  },
  
  async searchByDateRange(startDate, endDate, limit = 100) {
    const response = await fetch(`${SCREENPIPE_URL}/search?limit=${limit}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to search by date range: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Filter by date range client-side
    if (startDate || endDate) {
      data.data = data.data.filter(frame => {
        const frameDate = new Date(frame.content?.timestamp);
        if (startDate && frameDate < new Date(startDate)) return false;
        if (endDate && frameDate > new Date(endDate)) return false;
        return true;
      });
    }
    
    return data;
  },
  
  async searchByApp(appName, limit = 50) {
    const response = await fetch(`${SCREENPIPE_URL}/search?limit=${limit}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to search by app: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Filter by app name client-side
    if (appName) {
      data.data = data.data.filter(frame => 
        frame.content?.app_name?.toLowerCase().includes(appName.toLowerCase())
      );
    }
    
    return data;
  }
};




