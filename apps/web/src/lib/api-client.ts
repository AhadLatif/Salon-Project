import { createApiClient } from '@salon/api-client';

// The singleton API client instance pointing to the origin.
// The Next.js rewrite proxies /api/v1 to the backend.
export const api = createApiClient('');

let accessToken: string | null = null;
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

// openapi-fetch middleware
api.use({
  onRequest({ request }) {
    if (accessToken && !request.headers.has('Authorization')) {
      request.headers.set('Authorization', `Bearer ${accessToken}`);
    }
    // We must include credentials so the HttpOnly refresh cookie is sent
    if (!request.credentials) {
      Object.defineProperty(request, 'credentials', { value: 'include' });
    }
    return request;
  },
  async onResponse({ request, response }) {
    const url = request.url;
    // If it's a 401 and NOT a refresh or login request, we try to refresh.
    if (response.status === 401 && !url.includes('/auth/refresh') && !url.includes('/auth/login')) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          // Attempt silent refresh
          const refreshRes = await fetch('/api/v1/auth/refresh', {
            method: 'POST',
            credentials: 'include',
          });
          if (!refreshRes.ok) throw new Error('Refresh failed');

          const body = await refreshRes.json();
          if (!body.success) throw new Error('Refresh failed');

          const newToken = body.data.tokens.accessToken;
          setAccessToken(newToken);

          // Release queue
          refreshQueue.forEach((cb) => {
            cb(newToken);
          });
          refreshQueue = [];

          // Replay current request
          const newReq = new Request(request.url, request);
          newReq.headers.set('Authorization', `Bearer ${newToken}`);
          return fetch(newReq);
        } catch (_e) {
          refreshQueue = [];
          setAccessToken(null);
          // Don't auto-redirect here to keep pure; let the caller or SessionProvider handle unauthenticated state.
        } finally {
          isRefreshing = false;
        }
      } else {
        // Wait for the inflight refresh
        return new Promise<Response>((resolve) => {
          refreshQueue.push((newToken: string) => {
            const newReq = new Request(request.url, request);
            newReq.headers.set('Authorization', `Bearer ${newToken}`);
            resolve(fetch(newReq));
          });
        });
      }
    }
    return response;
  },
});
