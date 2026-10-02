import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * ARCHITECTURE GUARD — the success response envelope must always be complete.
 *
 * ❓ QUESTION: why does a test read source files instead of calling the API?
 *
 * 💡 ANSWER: because this exact defect cannot be caught any other way.
 *
 * The envelope is `{ success, data, error, meta }`. `error` is `null` on success and an object on
 * failure, and clients branch on that single field. It went missing from FIVE controllers
 * (branch, business, rbac, service, service-category) while the OpenAPI documents published for
 * those same endpoints declared the field as present — the API was contradicting its own contract.
 * The same drift had already happened once in `identity` (four of five endpoints) and once in
 * `staff`. See the header of `packages/shared/src/http/response.util.ts`.
 *
 * Why no existing check caught it:
 *   - TypeScript never sees the JSON that actually leaves the process.
 *   - biome/depcruise see syntax and import graphs, not response shapes.
 *   - `respondOk()` centralises the shape, but a helper only helps if call sites use it, and
 *     "remember to use the helper" is a habit, not a guarantee.
 *
 * So this test asserts the invariant directly, on every controller in every module. It is written
 * against the TypeScript AST rather than a regex so that it cannot be fooled by formatting,
 * nesting, or a `{` inside a string literal.
 *
 * The invariant: a controller may hand-write its success envelope (the remaining modules still do),
 * but if it does, the literal MUST carry `error`. Migrating the rest to `respondOk()` is tracked as
 * a follow-up; this test is what makes the migration safe to do incrementally.
 */

const MODULES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../packages/modules');
const REPO_ROOT = resolve(MODULES_DIR, '../..');

interface EnvelopeViolation {
  file: string;
  line: number;
}

/** Every `*.controller.ts` across every module that has an HTTP layer (stub modules have none). */
function listControllerFiles(): string[] {
  const files: string[] = [];

  for (const moduleEntry of readdirSync(MODULES_DIR, { withFileTypes: true })) {
    if (!moduleEntry.isDirectory()) continue;

    const controllersDir = join(MODULES_DIR, moduleEntry.name, 'src', 'api', 'controllers');

    let entries: string[];
    try {
      entries = readdirSync(controllersDir);
    } catch {
      continue; // module is a stub (`export {}`) — no controllers to check
    }

    for (const entry of entries) {
      if (entry.endsWith('.controller.ts')) files.push(join(controllersDir, entry));
    }
  }

  return files;
}

/** Matches `res.status(<n>).json({ ... })` — the hand-written envelope form. */
function isResStatusJsonCall(node: ts.CallExpression): boolean {
  const jsonAccess = node.expression;
  if (!ts.isPropertyAccessExpression(jsonAccess) || jsonAccess.name.text !== 'json') return false;

  const statusCall = jsonAccess.expression;
  if (!ts.isCallExpression(statusCall)) return false;
  if (!ts.isPropertyAccessExpression(statusCall.expression)) return false;

  const statusAccess = statusCall.expression;
  return (
    statusAccess.name.text === 'status' &&
    ts.isIdentifier(statusAccess.expression) &&
    statusAccess.expression.text === 'res'
  );
}

function findIncompleteEnvelopes(file: string): EnvelopeViolation[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const violations: EnvelopeViolation[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isResStatusJsonCall(node)) {
      const [body] = node.arguments;

      if (body && ts.isObjectLiteralExpression(body)) {
        const declaresSuccess = body.properties.some(
          (property) =>
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === 'success' &&
            property.initializer.kind === ts.SyntaxKind.TrueKeyword,
        );

        const declaresError = body.properties.some(
          (property) =>
            ts.isPropertyAssignment(property) &&
            ts.isIdentifier(property.name) &&
            property.name.text === 'error',
        );

        if (declaresSuccess && !declaresError) {
          violations.push({
            file,
            line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(source);
  return violations;
}

describe('API response envelope guard', () => {
  it('finds the controllers to guard (guards against a silently empty scan)', () => {
    const files = listControllerFiles();

    expect(files.length).toBeGreaterThanOrEqual(10);
    expect(files.some((file) => file.includes('business'))).toBe(true);
  });

  it('every hand-written success envelope declares `error`', () => {
    const violations = listControllerFiles().flatMap(findIncompleteEnvelopes);
    const report = violations
      .map((violation) => `  ${violation.file.replace(`${REPO_ROOT}/`, '')}:${violation.line}`)
      .join('\n');

    expect(
      violations,
      violations.length === 0
        ? ''
        : `These controllers hand-write a success envelope without \`error\` (use respondOk() from @salon/shared):\n${report}`,
    ).toEqual([]);
  });
});
