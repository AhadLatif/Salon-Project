import { execSync } from 'node:child_process';

// Grab the argument passed after the script name
const args = process.argv.slice(2);
const migrationName = args[0];

if (!migrationName) {
  console.error('\n❌ ERROR: You absolutely must provide a name for the migration.');
  console.error('💡 USAGE: pnpm db:generate <name_of_migration>\n');
  process.exit(1);
}

console.log(`\n🚀 Generating migration: ${migrationName}...\n`);

try {
  // Executes Drizzle Kit and pipes the output directly to your terminal
  execSync(`npx drizzle-kit generate --name ${migrationName}`, { stdio: 'inherit' });
} catch (error) {
  console.error('\n❌ Migration generation failed.', error);
  process.exit(1);
}
