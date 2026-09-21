const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const url = `${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Send cookies cross-origin
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Handle unauthorized specifically
      throw new Error('Unauthorized');
    }
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'API request failed');
  }

  // Not all APIs return JSON (like /api/auth/captcha returns an image)
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  
  if (contentType && contentType.includes('image/')) {
    return response.blob();
  }
  
  return response.text();
}
