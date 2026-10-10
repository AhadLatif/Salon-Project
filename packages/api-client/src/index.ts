// @salon/api-client — generated OpenAPI client (from backend OpenAPI spec).
// Low-level contract types + request function. Feature-owned query/mutation
// hooks live in `features/*/api.ts` and wrap this client.

import createClient from 'openapi-fetch';
import type { paths } from './schema.js';

export type * from './schema.js';

/**
 * Creates an instance of the OpenAPI fetch client.
 *
 * @param baseUrl - The base URL of the API (e.g. 'http://localhost:3000/api/v1')
 */
export function createApiClient(baseUrl: string) {
  return createClient<paths>({ baseUrl });
}

export type ApiClient = ReturnType<typeof createApiClient>;
