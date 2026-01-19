// Re-export shared database client for dashboard use
// This file exists to work around Next.js module resolution issues

export { db } from '../../shared/database/client';
export * from '../../shared/database/schema';
