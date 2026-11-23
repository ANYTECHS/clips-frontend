
import axios from 'axios';


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


const UNSAFE_METHODS = ['post', 'put', 'patch', 'delete'];

function readCookie(name: string): string | null {
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}
if (typeof window !== 'undefined') {
  apiClient.interceptors.request.use((config) => {
    const method = (config.method || 'get').toLowerCase();
    const headers = config.headers as any;
    const existingKey = typeof headers?.get === 'function' ? headers.get('Idempotency-Key') : headers?.['Idempotency-Key'];
    if (UNSAFE_METHODS.includes(method) && !existingKey) {
      const key = crypto.randomUUID();
      if (typeof headers?.set === 'function') headers.set('Idempotency-Key', key);
      else headers['Idempotency-Key'] = key;
    }
    // Double-submit CSRF: echo the `_csrf` cookie issued by the backend.
    if (UNSAFE_METHODS.includes(method)) {
      const csrfToken = readCookie('_csrf');
      if (csrfToken) {
        if (typeof headers?.set === 'function') headers.set('X-CSRF-Token', csrfToken);
        else headers['X-CSRF-Token'] = csrfToken;
      }
    }
    return config;
  });
}


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
