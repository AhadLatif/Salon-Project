import type { NextConfig } from 'next';

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:3000';

const nextConfig: NextConfig = {
  transpilePackages: ['@salon/ui', '@salon/design-tokens'],
  /**
   * Same-origin proxy to the Express API.
   *
   * Why rewrites instead of calling the API directly from the browser:
   * - The backend mounts no CORS middleware (see `apps/api/src/app.ts`), so cross-origin
   *   fetches from `localhost:3001` would be rejected by the browser.
   * - Proxying keeps the refresh cookie flow same-origin (the HttpOnly refresh cookie set by
   *   the API is stored for our own host and replayed on `/api/v1/auth/*`), which is the
   *   hybrid auth contract recorded in `docs/30-frontend/10-design/05-security-and-auth.md`.
   * - The generated API client can then always use relative `/api/v1/...` paths in any env.
   */
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
