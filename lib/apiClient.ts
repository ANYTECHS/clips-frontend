
import axios from 'axios';

// On server: use the real backend URL directly
// On client: use the Next.js proxy route
const getApiBaseUrl = () => {
  if (typeof window === 'undefined') {
    // Server side: call backend directly
    return process.env.API_URL || 'https://clipcash-api.onrender.com';
  }
  // Client side: always use the proxy route to avoid CORS errors
  return '/api/proxy';
};

const API_BASE_URL = getApiBaseUrl();

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: typeof window !== 'undefined', // Only on client side
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for auto-refreshing tokens (only on client side)
if (typeof window !== 'undefined') {
  apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      // If error doesn't have config (e.g. network error), just reject
      if (!originalRequest) {
        return Promise.reject(error);
      }

      // If error is 401 and we haven't retried yet.
      // Skip refresh for wallet auth endpoints — a 401 there means
      // "no account found" or "bad signature", not an expired token.
      // Also skip for /users/me used as a session-existence check.
      const isWalletAuth = originalRequest.url?.includes('/auths/wallet/');
      const isSessionCheck = originalRequest.url?.includes('/users/me') && originalRequest._sessionCheck;
      const isAuthEndpoint = originalRequest.url?.includes('/auths/') || originalRequest.url?.includes('/auth/');
      if (
        error.response?.status === 401 &&
        !originalRequest._retry &&
        originalRequest.url !== '/auths/refresh' &&
        !isWalletAuth &&
        !isSessionCheck &&
        !isAuthEndpoint
      ) {
        originalRequest._retry = true;
        try {
          // Refresh also goes through our proxy
          await apiClient.post('/auths/refresh');
          return apiClient(originalRequest);
        } catch (refreshError) {
          const PUBLIC_PATHS = ['/', '/login', '/signup', '/clips', '/docs'];
          const currentPath = window.location.pathname;
          const isPublic = PUBLIC_PATHS.some(p => currentPath === p || currentPath.startsWith(p + '/'));
          if (typeof window !== 'undefined' && !isPublic) {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      }
      return Promise.reject(error);
    }
  );
}

export default apiClient;
