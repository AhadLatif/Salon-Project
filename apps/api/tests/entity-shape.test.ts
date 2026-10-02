import { type Dirent, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * ARCHITECTURE GUARD — domain entities are shapes, not objects.
 *
 * ❓ QUESTION: why is a `class` in `domain/entities/` a build failure?
 *
 * 💡 ANSWER: because in this codebase an entity class never earned its keep, and it had a specific
 * failure mode. All eight entity classes (identity x2, business, branch, service x2, staff, rbac) held
 * their state in a TypeScript-`private` `props` bag behind getters. TypeScript erases `private` at
 * runtime, so the instance on the heap was physically `{ props: {...} }`, and `JSON.stringify` walks
 * own enumerable properties while never calling prototype getters. Every response therefore depended
 * on someone remembering to call `toPrimitives()` — forget it and the API emits `{"props":{...}}`, a
 * silently wrong payload that no type check can reach. Each class also carried `toPrimitives()` /
 * `toJSON()`, so a row was copied twice (row -> props -> primitives) and the response shape was
 * defined inside the domain instead of at the boundary.
 *
 * THE RULE (Option 3): a domain entity is an `interface` describing a persisted shape. Behaviour that
 * belongs to a type lives in `domain/policies/` as pure invariant functions — the appointment status
 * FSM and the payment money arithmetic already work exactly that way. A `class` is permitted ONLY when
 * it owns a state invariant across operations, and then it must be listed in
 * ALLOWED_ENTITY_CLASSES below with a one-line justification, so "justified" becomes a reviewable fact
 * rather than an opinion. That is the conversation that was missing when four different entity dialects
 * accumulated across eight modules.
 */

const MODULES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../packages/modules');
const REPO_ROOT = resolve(MODULES_DIR, '../..');

/**
 * Entity classes allowed to exist, each with the justification for being an object rather than a
 * shape. Empty on purpose: after the conversion every module uses interfaces.
 *
 * To add one, append e.g.
 *   { file: 'appointment/src/domain/entities/appointment.entity.ts', className: 'Appointment', why: '...' }
 */
const ALLOWED_ENTITY_CLASSES: ReadonlyArray<{
  file: string;
  className: string;
  why: string;
}> = [];

interface EntityClassViolation {
  file: string;
  className: string;
}

/** Every `.ts` file under each module's `src/domain/entities/`, recursively. */
function listEntityFiles(): string[] {
  const files: string[] = [];

  const walk = (dir: string): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // module has no domain/entities folder (infrastructure packages, etc.)
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.name.endsWith('.ts')) files.push(fullPath);
    }
  };

  let modules: Dirent[];
  try {
    modules = readdirSync(MODULES_DIR, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const module of modules) {
    if (module.isDirectory()) walk(join(MODULES_DIR, module.name, 'src', 'domain', 'entities'));
  }

  return files;
}

/** Exported class declarations found in one file. */
function findExportedClasses(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const classNames: string[] = [];

  const hasExportModifier = (node: ts.ClassDeclaration): boolean =>
    (node.modifiers ?? []).some(
      (modifier) =>
        modifier.kind === ts.SyntaxKind.ExportKeyword ||
        modifier.kind === ts.SyntaxKind.DefaultKeyword,
    );

  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && node.name && hasExportModifier(node)) {
      classNames.push(node.name.text);
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return classNames;
}

describe('domain entity shape guard', () => {
  it('finds the entity files to guard (guards against a silently empty scan)', () => {
    const files = listEntityFiles();

    // Sanity floor: the scan must actually reach the modules it is meant to police.
    expect(files.length).toBeGreaterThanOrEqual(8);
    expect(files.some((file) => file.includes('business'))).toBe(true);
    expect(files.some((file) => file.includes('identity'))).toBe(true);
  });

  it('domain entities declare shapes, not classes', () => {
    const violations: EntityClassViolation[] = listEntityFiles().flatMap((file) =>
      findExportedClasses(file).map((className) => ({ file, className })),
    );

    const relative = (file: string): string => file.replace(`${REPO_ROOT}/packages/modules/`, '');

    const allowed = new Set(
      ALLOWED_ENTITY_CLASSES.map((entry) => `${entry.file}::${entry.className}`),
    );
    const unapproved = violations.filter(
      (violation) => !allowed.has(`${relative(violation.file)}::${violation.className}`),
    );

    const report = unapproved
      .map(
        (violation) =>
          `  packages/modules/${relative(violation.file)} -> class ${violation.className}`,
      )
      .join('\n');

    expect(
      unapproved,
      unapproved.length === 0
        ? ''
        : [
            'These domain entities are classes. Use an `interface` describing the persisted shape, and',
            'move invariants into a pure function in `domain/policies/`.',
            'If a class genuinely owns a state invariant across operations, add it to',
            'ALLOWED_ENTITY_CLASSES in this file with a one-line justification:',
            report,
          ].join('\n'),
    ).toEqual([]);
  });
});
