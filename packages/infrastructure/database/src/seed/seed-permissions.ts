import { PERMISSION_CATALOG } from '@salon/shared';
import { closePool, db, permissions } from '../index.js';

export async function seedPermissions(): Promise<void> {
  console.info('🌱 Starting permission catalog seeding...');

  let insertedCount = 0;
  let skippedCount = 0;

  for (const perm of PERMISSION_CATALOG) {
    const result = await db
      .insert(permissions)
      .values({
        code: perm.code,
        module: perm.module,
        name: perm.name,
        description: perm.description,
      })
      .onConflictDoUpdate({
        target: permissions.code,
        set: {
          module: perm.module,
          name: perm.name,
          description: perm.description,
        },
      })
      .returning();

    if (result.length > 0) {
      insertedCount++;
    } else {
      skippedCount++;
    }
  }

  console.info(
    `✅ Permission catalog seeded successfully! Upserted: ${insertedCount}, Skipped: ${skippedCount}`,
  );
}

// Execute directly if called from command line
if (
  process.argv[1]?.endsWith('seed-permissions.ts') ||
  process.argv[1]?.endsWith('seed-permissions.js')
) {
  seedPermissions()
    .catch((err) => {
      console.error('❌ Failed to seed permissions:', err);
      process.exit(1);
    })
    .finally(async () => {
      await closePool();
    });
}
