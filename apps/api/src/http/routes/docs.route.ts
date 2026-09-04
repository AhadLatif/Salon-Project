import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { appointmentOpenApiRegistry } from '@salon/appointment';
import { branchOpenApiRegistry } from '@salon/branch';
import { businessOpenApiRegistry } from '@salon/business';
import { customerOpenApiRegistry } from '@salon/customer';
import { identityOpenApiRegistry } from '@salon/identity';
import { rbacOpenApiRegistry } from '@salon/rbac';
import { serviceOpenApiRegistry } from '@salon/service';
import { staffOpenApiRegistry } from '@salon/staff';
import { apiReference } from '@scalar/express-api-reference';
import { Router } from 'express';

export function createDocsRouter(): Router {
  const router = Router();

  // 1. Combine all module OpenAPI registries
  const generator = new OpenApiGeneratorV31([
    ...identityOpenApiRegistry.definitions,
    ...businessOpenApiRegistry.definitions,
    ...rbacOpenApiRegistry.definitions,
    ...branchOpenApiRegistry.definitions,
    ...serviceOpenApiRegistry.definitions,
    ...staffOpenApiRegistry.definitions,
    ...customerOpenApiRegistry.definitions,
    ...appointmentOpenApiRegistry.definitions,
  ]);

  // 2. Build the unified OpenAPI Specification document
  const openApiDocument = generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Salon Platform API',
      version: '1.0.0',
      description: 'Multi-tenant SaaS & Marketplace API Specifications',
    },
    servers: [
      {
        url: '/',
        description: 'Current API server',
      },
    ],
  });

  // 3. Serve raw OpenAPI JSON spec
  router.get('/docs/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });

  // 4. Mount Scalar Interactive API Docs UI
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
