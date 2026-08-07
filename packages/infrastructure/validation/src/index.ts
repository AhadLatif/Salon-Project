import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Extends Zod's prototype with the .openapi() method
extendZodWithOpenApi(z);

export { z };
