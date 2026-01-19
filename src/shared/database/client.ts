import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

// Create SQLite database connection
const sqlite = new Database(process.env.DATABASE_URL?.replace('file:', '') || './data/ixoye.db');

// Enable foreign keys
sqlite.pragma('foreign_keys = ON');

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });

// Log queries in development
if (process.env.NODE_ENV === 'development') {
    sqlite.exec('PRAGMA journal_mode = WAL;'); // Better performance
}

export default db;
