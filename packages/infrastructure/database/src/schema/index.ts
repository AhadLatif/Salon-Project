// Keep Drizzle pointed at one root entry file.
// Each folder now exposes its own barrel, so new schema files can be added
// by updating the folder barrel instead of the root file.

export * from './appointment/index.js';
export * from './audit/index.js';
export * from './business/index.js';
export * from './customer/index.js';
export * from './identity/index.js';
export * from './media/index.js';
export * from './notification/index.js';
export * from './payment/index.js';
export * from './RBAC/index.js';
export * from './review/index.js';
export * from './service/index.js';
export * from './shared/index.js';
export * from './staff/index.js';

// Later you can add a new module by creating its own folder barrel and exporting it here:
// export * from './booking/index.js';
// export * from './inventory/index.js';
