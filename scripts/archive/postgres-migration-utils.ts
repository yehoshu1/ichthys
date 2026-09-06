import Database from 'better-sqlite3';
import { Pool, PoolClient } from 'pg';

export const TABLE_ORDER = [
    'guild_config',
    'message_template',
    'welcome_trigger',
    'user_join',
    'verification_message_rule',
    'verification_role_message',
    'user_boost',
    'level_profile',
    'level_reward',
    'role_action',
    'action_log',
    'message_activity',
    'guild_growth',
    'moderation_case',
    'moderation_settings',
    'reaction_role_message',
    'reaction_role',
    'discord_user_cache',
    'scheduled_role_action',
    'birthday_config',
    'birthday_entry',
    'birthday_log',
    'message_alias',
    'command_config',
] as const;

const ARRAY_COLUMNS = new Set([
    'exclusive_role_ids',
    'allowed_channels',
    'allowed_roles',
    'enabled_roles',
    'disabled_roles',
    'enabled_channels',
    'disabled_channels',
    'roles_can_skip_max_limit',
]);

// Legacy SQLite columns that were intentionally removed from the Postgres schema.
const LEGACY_DROP_COLUMNS = new Set([
    'aliases',
]);

const JSON_COLUMNS = new Set([
    'join_message_embed',
    'leave_message_embed',
    'verification_message_embed',
    'boost_welcome_message_embed',
    'boost_re_boost_message_embed',
    'level_up_message_embed',
    'embed_data',
    'message_embed',
    'dm_message_embed',
    'metadata',
    'embed',
    'response_embed',
]);

const BOOLEAN_COLUMNS = new Set([
    'welcome_enabled',
    'verification_enabled',
    'verification_kick_dm_enabled',
    'boost_enabled',
    'boost_claim_required',
    'boost_role_removal_dm_enabled',
    'leveling_enabled',
    'level_up_notif_enabled',
    'enabled',
    'is_verified',
    'is_bot',
    'role_assigned',
    'role_removed',
    'notified_before_removal',
    'success',
    'active',
    'auto_mod_enabled',
    'word_filter_enabled',
    'invite_filter_enabled',
    'embed_enabled',
    'embed_thumbnail',
    'show_age',
    'auto_remove_role',
    'message_sent',
    'role_assigned',
    'case_sensitive',
    'delete_trigger',
    'auto_delete_invocation',
    'auto_delete_with_invocation_deletion',
]);

export type AnyRow = Record<string, unknown>;

export function resolveSqlitePath(): string {
    const source = process.env.SQLITE_DATABASE_URL ?? process.env.SQLITE_PATH ?? './data/ichthys.db';
    return source.startsWith('file:') ? source.replace('file:', '') : source;
}

export function createSqliteClient(): Database.Database {
    return new Database(resolveSqlitePath(), { readonly: true });
}

export function createPostgresPool(): Pool {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL is required for PostgreSQL migration scripts');
    }

    return new Pool({
        connectionString: databaseUrl,
        max: Number(process.env.PG_POOL_MAX ?? 10),
    });
}

export async function ensurePgMigrationStateTable(client: PoolClient): Promise<void> {
    await client.query(`
        CREATE TABLE IF NOT EXISTS migration_sync_state (
            table_name text PRIMARY KEY,
            cursor_column text NOT NULL,
            last_synced_epoch_ms bigint NOT NULL DEFAULT 0,
            updated_at timestamptz NOT NULL DEFAULT now()
        )
    `);
}

export function normalizeDiscordIdArray(value: unknown): string[] | null {
    if (value == null) return null;
    if (Array.isArray(value)) {
        const normalized = value.map((item) => String(item).trim()).filter(Boolean);
        return normalized.length > 0 ? normalized : null;
    }

    if (typeof value !== 'string') return null;
    const normalized = value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    return normalized.length > 0 ? normalized : null;
}

function normalizeJson(value: unknown): unknown {
    if (value == null) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        try {
            return JSON.parse(trimmed);
        } catch {
            return value;
        }
    }
    return value;
}

function normalizeBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        return normalized === 'true' || normalized === '1';
    }
    return false;
}

function isTimestampColumn(column: string): boolean {
    if (column === 'date') return true;
    if (column.endsWith('_at')) return true;
    if (column === 'last_member_sync') return true;
    if (column === 'last_text_xp_at') return true;
    if (column === 'voice_joined_at') return true;
    if (column === 'execute_at') return true;
    if (column === 'last_celebrated_year') return false;
    return false;
}

function normalizeTimestamp(value: unknown): Date | null {
    if (value == null) return null;
    if (value instanceof Date) return value;
    if (typeof value === 'number' && Number.isFinite(value)) {
        return new Date(value);
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const asNum = Number(trimmed);
        if (Number.isFinite(asNum)) {
            return new Date(asNum);
        }

        const parsed = new Date(trimmed);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    return null;
}

export function transformRow(row: AnyRow): AnyRow {
    const result: AnyRow = {};

    for (const [column, value] of Object.entries(row)) {
        if (LEGACY_DROP_COLUMNS.has(column)) {
            continue;
        }

        if (ARRAY_COLUMNS.has(column)) {
            result[column] = normalizeDiscordIdArray(value);
            continue;
        }

        if (JSON_COLUMNS.has(column)) {
            result[column] = normalizeJson(value);
            continue;
        }

        if (BOOLEAN_COLUMNS.has(column)) {
            result[column] = normalizeBoolean(value);
            continue;
        }

        if (isTimestampColumn(column)) {
            result[column] = normalizeTimestamp(value);
            continue;
        }

        result[column] = value;
    }

    return result;
}

export function readSqliteRows(sqlite: Database.Database, table: string, where = '', params: unknown[] = []): AnyRow[] {
    const sql = where ? `SELECT * FROM "${table}" WHERE ${where}` : `SELECT * FROM "${table}"`;
    const statement = sqlite.prepare(sql);
    const rows = statement.all(...params) as AnyRow[];
    return rows.map(transformRow);
}

export function getPrimaryKeyColumn(table: string): string {
    return table === 'discord_user_cache' ? 'user_id' : 'id';
}

function quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
}

function buildUpsertQuery(table: string, row: AnyRow): { sql: string; values: unknown[] } {
    const columns = Object.keys(row);
    if (columns.length === 0) {
        throw new Error(`Cannot upsert empty row for table ${table}`);
    }

    const primaryKey = getPrimaryKeyColumn(table);
    if (!columns.includes(primaryKey)) {
        throw new Error(`Primary key column ${primaryKey} missing in row for table ${table}`);
    }

    const quotedColumns = columns.map(quoteIdentifier).join(', ');
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const updateColumns = columns.filter((column) => column !== primaryKey);

    let sql = `INSERT INTO ${quoteIdentifier(table)} (${quotedColumns}) VALUES (${placeholders})`;

    if (updateColumns.length === 0) {
        sql += ` ON CONFLICT (${quoteIdentifier(primaryKey)}) DO NOTHING`;
    } else {
        const updateAssignments = updateColumns
            .map((column) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`)
            .join(', ');
        sql += ` ON CONFLICT (${quoteIdentifier(primaryKey)}) DO UPDATE SET ${updateAssignments}`;
    }

    return {
        sql,
        values: columns.map((column) => row[column]),
    };
}

export async function upsertRows(client: PoolClient, table: string, rows: AnyRow[]): Promise<number> {
    let count = 0;

    for (const row of rows) {
        const query = buildUpsertQuery(table, row);
        await client.query(query.sql, query.values);
        count += 1;
    }

    return count;
}
