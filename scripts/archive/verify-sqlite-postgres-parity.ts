import { createHash } from 'crypto';
import {
    TABLE_ORDER,
    createPostgresPool,
    createSqliteClient,
    getPrimaryKeyColumn,
    readSqliteRows,
    transformRow,
} from './postgres-migration-utils';

type AnyRow = Record<string, unknown>;

function canonicalizeValue(value: unknown): unknown {
    if (value == null) return null;

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.map((item) => canonicalizeValue(item));
    }

    if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, val]) => [key, canonicalizeValue(val)]);
        return Object.fromEntries(entries);
    }

    return value;
}

function canonicalizeRows(rows: AnyRow[], primaryKey: string): AnyRow[] {
    return rows
        .map((row) => {
            const normalized = Object.fromEntries(
                Object.entries(row)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, value]) => [key, canonicalizeValue(value)])
            ) as AnyRow;
            return normalized;
        })
        .sort((a, b) => String(a[primaryKey]).localeCompare(String(b[primaryKey])));
}

function hashRows(rows: AnyRow[]): string {
    const payload = JSON.stringify(rows);
    return createHash('sha256').update(payload).digest('hex');
}

async function main(): Promise<void> {
    const sqlite = createSqliteClient();
    const pgPool = createPostgresPool();
    const client = await pgPool.connect();

    let mismatchCount = 0;

    try {
        for (const table of TABLE_ORDER) {
            const primaryKey = getPrimaryKeyColumn(table);
            const sqliteRows = canonicalizeRows(readSqliteRows(sqlite, table), primaryKey);
            const pgResult = await client.query(`SELECT * FROM "${table}"`);
            const pgRows = canonicalizeRows(pgResult.rows.map((row) => transformRow(row as AnyRow)), primaryKey);

            const sqliteCount = sqliteRows.length;
            const pgCount = pgRows.length;
            const sqliteHash = hashRows(sqliteRows);
            const pgHash = hashRows(pgRows);

            const countMatches = sqliteCount === pgCount;
            const hashMatches = sqliteHash === pgHash;

            if (!countMatches || !hashMatches) {
                mismatchCount += 1;
                console.log(`\n[DIFF] ${table}`);
                console.log(`  SQLite count: ${sqliteCount}`);
                console.log(`  PG count:     ${pgCount}`);
                console.log(`  SQLite hash:  ${sqliteHash}`);
                console.log(`  PG hash:      ${pgHash}`);
            } else {
                console.log(`[OK] ${table}: ${sqliteCount} row(s)`);
            }
        }

        if (mismatchCount > 0) {
            throw new Error(`Parity verification failed for ${mismatchCount} table(s).`);
        }

        console.log('\nParity verification passed. SQLite and PostgreSQL datasets match.');
    } finally {
        client.release();
        await pgPool.end();
        sqlite.close();
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
