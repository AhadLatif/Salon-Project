import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { appointmentOpenApiRegistry } from '@salon/appointment';
import { branchOpenApiRegistry } from '@salon/branch';
import { businessOpenApiRegistry } from '@salon/business';
import { customerOpenApiRegistry } from '@salon/customer';
import { identityOpenApiRegistry } from '@salon/identity';
import { paymentOpenApiRegistry } from '@salon/payment';
import { rbacOpenApiRegistry } from '@salon/rbac';
import { serviceOpenApiRegistry } from '@salon/service';
import { staffOpenApiRegistry } from '@salon/staff';

/**
 * Builds the unified OpenAPI 3.1 document from every module registry.
 *
 * WHY THIS IS ITS OWN FILE: the document has two consumers — the `/docs` route (served at runtime)
 * and `scripts/export-openapi.ts` (written to disk so `@salon/api-client` can generate types from
 * it). Building it in one place guarantees the frontend's generated contract is byte-for-byte the
 * spec the running API serves; the generator never has to boot a server or scrape `/docs`.
 */
export function buildOpenApiDocument(): ReturnType<OpenApiGeneratorV31['generateDocument']> {
  const generator = new OpenApiGeneratorV31([
    ...identityOpenApiRegistry.definitions,
    ...businessOpenApiRegistry.definitions,
    ...rbacOpenApiRegistry.definitions,
    ...branchOpenApiRegistry.definitions,
    ...serviceOpenApiRegistry.definitions,
    ...staffOpenApiRegistry.definitions,
    ...customerOpenApiRegistry.definitions,
    ...appointmentOpenApiRegistry.definitions,
    ...paymentOpenApiRegistry.definitions,
  ]);

  return generator.generateDocument({
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
    security: [
      {
        bearerAuth: [],
      },
    ],
  });
}
