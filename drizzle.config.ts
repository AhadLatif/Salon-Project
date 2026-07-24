import "dotenv/config";

import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set.");
}

export default defineConfig({
  dialect: "postgresql",

  schema: "./packages/infrastructure/database/src/schema/**/*.ts",

  out: "./packages/infrastructure/database/migrations",

  dbCredentials: {
    url: databaseUrl,
  },

  verbose: true,
  strict: true,
});