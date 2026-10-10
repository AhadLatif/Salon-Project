import { apiReference } from '@scalar/express-api-reference';
import { Router } from 'express';
import { buildOpenApiDocument } from '../openapi/openapi-document.js';

export function createDocsRouter(): Router {
  const router = Router();

  // 1. Build the unified OpenAPI document (shared with `scripts/export-openapi.ts`).
  const openApiDocument = buildOpenApiDocument();

  // 2. Serve raw OpenAPI JSON spec
  router.get('/docs/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });

  // 3. Mount Scalar Interactive API Docs UI
  router.use(
    '/docs',
    apiReference({
      spec: {
        content: openApiDocument,
      },
      theme: 'purple',
    }),
  );

  return router;
}
