import {
    createPostgresPool,
    createSqliteClient,
    ensurePgMigrationStateTable,
    readSqliteRows,
    upsertRows,
} from './postgres-migration-utils';
import type { PoolClient } from 'pg';

interface DeltaTableConfig {
    table: string;
    cursorColumn: string;
}

const DELTA_TABLES: DeltaTableConfig[] = [
    { table: 'guild_config', cursorColumn: 'updated_at' },
    { table: 'message_template', cursorColumn: 'updated_at' },
    { table: 'welcome_trigger', cursorColumn: 'updated_at' },
    { table: 'user_join', cursorColumn: 'updated_at' },
    { table: 'verification_message_rule', cursorColumn: 'updated_at' },
    { table: 'verification_role_message', cursorColumn: 'updated_at' },
    { table: 'user_boost', cursorColumn: 'updated_at' },
    { table: 'level_profile', cursorColumn: 'updated_at' },
    { table: 'level_reward', cursorColumn: 'created_at' },
    { table: 'role_action', cursorColumn: 'updated_at' },
    { table: 'action_log', cursorColumn: 'executed_at' },
    { table: 'message_activity', cursorColumn: 'updated_at' },
    { table: 'guild_growth', cursorColumn: 'created_at' },
    { table: 'moderation_case', cursorColumn: 'created_at' },
    { table: 'moderation_settings', cursorColumn: 'updated_at' },
    { table: 'reaction_role_message', cursorColumn: 'updated_at' },
    { table: 'reaction_role', cursorColumn: 'updated_at' },
    { table: 'discord_user_cache', cursorColumn: 'updated_at' },
    { table: 'scheduled_role_action', cursorColumn: 'updated_at' },
    { table: 'birthday_config', cursorColumn: 'updated_at' },
    { table: 'birthday_entry', cursorColumn: 'updated_at' },
    { table: 'birthday_log', cursorColumn: 'created_at' },
    { table: 'message_alias', cursorColumn: 'updated_at' },
    { table: 'command_config', cursorColumn: 'updated_at' },
];

const BATCH_SIZE = Number(process.env.SQLITE_DELTA_BATCH_SIZE ?? 500);
const WATCH_MODE = process.argv.includes('--watch');
const WATCH_INTERVAL_SECONDS = Number(process.env.SQLITE_DELTA_INTERVAL_SECONDS ?? 15);

function toEpochMs(value: unknown): number {
    if (value == null) return 0;
    if (value instanceof Date) return value.getTime();
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const asNumber = Number(value);
        if (Number.isFinite(asNumber)) return asNumber;

        const parsed = new Date(value);
        if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
    }

    return 0;
}

async function getCursorState(
    client: PoolClient,
    table: string,
    cursorColumn: string
): Promise<number> {
    const result = await client.query(
        'SELECT last_synced_epoch_ms FROM migration_sync_state WHERE table_name = $1 AND cursor_column = $2',
        [table, cursorColumn]
    );

    return result.rows[0]?.last_synced_epoch_ms ? Number(result.rows[0].last_synced_epoch_ms) : 0;
}

async function setCursorState(
    client: PoolClient,
    table: string,
    cursorColumn: string,
    epochMs: number
): Promise<void> {
    await client.query(
        `
            INSERT INTO migration_sync_state (table_name, cursor_column, last_synced_epoch_ms, updated_at)
            VALUES ($1, $2, $3, now())
            ON CONFLICT (table_name)
            DO UPDATE
            SET cursor_column = EXCLUDED.cursor_column,
                last_synced_epoch_ms = EXCLUDED.last_synced_epoch_ms,
                updated_at = now()
        `,
        [table, cursorColumn, epochMs]
    );
}

async function runDeltaPass(): Promise<void> {
    const sqlite = createSqliteClient();
    const pgPool = createPostgresPool();
    const client = await pgPool.connect();

    try {
        await ensurePgMigrationStateTable(client);

        for (const config of DELTA_TABLES) {
            const { table, cursorColumn } = config;
            let cursor = await getCursorState(client, table, cursorColumn);
            let upsertedForTable = 0;

            while (true) {
                const rows = readSqliteRows(
                    sqlite,
                    table,
                    `"${cursorColumn}" > ? ORDER BY "${cursorColumn}" ASC LIMIT ?`,
                    [cursor, BATCH_SIZE]
                );

                if (rows.length === 0) {
                    break;
                }

                await upsertRows(client, table, rows);
                upsertedForTable += rows.length;

                const maxCursor = rows.reduce((max, row) => {
                    const value = toEpochMs(row[cursorColumn]);
                    return value > max ? value : max;
                }, cursor);

                if (maxCursor <= cursor) {
                    break;
                }

                cursor = maxCursor;
                await setCursorState(client, table, cursorColumn, cursor);
            }

            if (upsertedForTable > 0) {
                console.log(`${table}: ${upsertedForTable} row(s) delta-synced`);
            }
        }
    } finally {
        client.release();
        await pgPool.end();
        sqlite.close();
    }
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
    if (!WATCH_MODE) {
        await runDeltaPass();
        console.log('SQLite delta sync completed.');
        return;
    }

    console.log(`Starting SQLite delta watch mode (interval: ${WATCH_INTERVAL_SECONDS}s)...`);
    while (true) {
        await runDeltaPass();
        await sleep(WATCH_INTERVAL_SECONDS * 1000);
    }
}

main().catch((error) => {
    console.error('SQLite delta sync failed:', error);
    process.exit(1);
});
