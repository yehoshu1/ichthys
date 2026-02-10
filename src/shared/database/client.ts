import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

// Create SQLite database connection
const sqlite = new Database(process.env.DATABASE_URL?.replace('file:', '') || './data/ixoye.db');

// Enable foreign keys
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('synchronous = NORMAL');
sqlite.pragma('busy_timeout = 5000');

function tableExists(tableName: string): boolean {
    const row = sqlite.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1"
    ).get(tableName) as { name?: string } | undefined;

    return row?.name === tableName;
}

function getTableColumns(tableName: string): Set<string> {
    const escapedTableName = tableName.replace(/'/g, "''");
    const rows = sqlite.prepare(`PRAGMA table_info('${escapedTableName}')`).all() as Array<{ name: string }>;
    return new Set(rows.map((row) => row.name));
}

function ensureColumn(tableName: string, columnName: string, addColumnSql: string): void {
    if (!tableExists(tableName)) {
        return;
    }

    const columns = getTableColumns(tableName);
    if (columns.has(columnName)) {
        return;
    }

    sqlite.exec(addColumnSql);
}

function runCompatibilityMigrations(): void {
    // Legacy compatibility: older instances may have command_config without max_limit.
    ensureColumn(
        'command_config',
        'max_limit',
        'ALTER TABLE command_config ADD COLUMN max_limit INTEGER;'
    );
}

runCompatibilityMigrations();

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });

export default db;
