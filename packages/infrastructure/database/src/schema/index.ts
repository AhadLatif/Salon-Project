// Don't point Drizzle at every file individually.
// Create one barrel.

export * from './identity/user_auth_providers.js';
export * from './identity/user_sessions.js';
export * from './identity/user_tokens.js';
export * from './identity/users.js';

// Later we will simply add:

// export * from "./booking/appointments";
// export * from "./inventory/products";

// This keeps drizzle.config.ts unchanged forever.
