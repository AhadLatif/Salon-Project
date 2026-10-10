import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { buildOpenApiDocument } from '../http/openapi/openapi-document.js';

/**
 * Writes the OpenAPI document to disk — the input of `@salon/api-client`'s type generation.
 *
 *   pnpm --filter @salon/api openapi:export --out <path/to/openapi.json>
 *
 * `--out` is required (no default) so the backend never hard-codes where a frontend package lives;
 * the consumer decides where its own input file goes.
 *
 * Output is pretty-printed with a trailing newline so the committed spec produces readable diffs —
 * reviewing a contract change should be as easy as reviewing code.
 */
async function main(): Promise<void> {
  const { values } = parseArgs({ options: { out: { type: 'string' } } });

  if (!values.out) {
    throw new Error('Missing required --out <path> argument');
  }

  const outPath = resolve(values.out);
  const document = buildOpenApiDocument();

  await writeFile(outPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  process.stdout.write(`OpenAPI document written to ${outPath}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
