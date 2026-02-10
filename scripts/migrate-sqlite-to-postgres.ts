import {
    TABLE_ORDER,
    createPostgresPool,
    createSqliteClient,
    readSqliteRows,
    upsertRows,
} from './postgres-migration-utils';

const CHUNK_SIZE = Number(process.env.SQLITE_IMPORT_CHUNK_SIZE ?? 500);

async function main(): Promise<void> {
    const sqlite = createSqliteClient();
    const pgPool = createPostgresPool();
    const client = await pgPool.connect();

    try {
        await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

        for (const table of TABLE_ORDER) {
            console.log(`Importing ${table}...`);
            const rows = readSqliteRows(sqlite, table);
            if (rows.length === 0) {
                console.log(`  ${table}: 0 rows`);
                continue;
            }

            let imported = 0;
            for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
                const chunk = rows.slice(index, index + CHUNK_SIZE);
                imported += await upsertRows(client, table, chunk);
            }

            console.log(`  ${table}: ${imported} row(s) upserted`);
        }

        console.log('SQLite -> PostgreSQL full import completed successfully.');
    } finally {
        client.release();
        await pgPool.end();
        sqlite.close();
    }
}

main().catch((error) => {
    console.error('SQLite import failed:', error);
    process.exit(1);
});
