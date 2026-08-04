import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
const migrationName = args[0];

if (!migrationName) {
  console.error('\n❌ ERROR: You absolutely must provide a name for the migration.');
  console.error('💡 USAGE: pnpm db:generate <name_of_migration>\n');
  process.exit(1);
}

const isValidMigrationName = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

if (!isValidMigrationName.test(migrationName)) {
  console.error(
    '\n❌ ERROR: Migration name must use lowercase snake_case and contain no spaces or shell metacharacters.',
  );
  console.error('💡 EXAMPLE: pnpm db:generate add_payment_gateway_idempotency\n');
  process.exit(1);
}

console.log(`\n🚀 Generating migration: ${migrationName}...\n`);

try {
  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  execFileSync(npxCommand, ['drizzle-kit', 'generate', '--name', migrationName], {
    stdio: 'inherit',
  });
} catch (error) {
  console.error('\n❌ Migration generation failed.', error);
  process.exit(1);
}
