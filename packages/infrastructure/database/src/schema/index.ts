// Keep Drizzle pointed at one root entry file.
// Each folder now exposes its own barrel, so new schema files can be added
// by updating the folder barrel instead of the root file.

export * from './business/index.js';
export * from './identity/index.js';
export * from './RBAC/index.js';

// Later you can add a new module by creating its own folder barrel and exporting it here:
// export * from './booking/index.js';
// export * from './inventory/index.js';
