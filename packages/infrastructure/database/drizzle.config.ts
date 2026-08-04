import { resolve } from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Tell dotenv to look 3 folders up for the root .env
config({ path: resolve(__dirname, '../../../.env') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is not set.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts', // Ensure this path correctly points to your exported tables
  out: './migrations',
  dbCredentials: {
    url: databaseUrl,
  },
  verbose: true,
  strict: true,
});
