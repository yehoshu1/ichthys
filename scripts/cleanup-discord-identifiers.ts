/**
 * One-time cleanup for Discord role/channel identifiers across all guild-bound tables.
 *
 * Modes:
 * - Dry-run (default): computes and reports projected changes without mutating DB.
 * - Apply (--apply): creates a DB backup, then applies updates/deletions.
 *
 * Options:
 * - --guild <guildId>: limit cleanup to one guild.
 */

import Database from "better-sqlite3";
import { execSync } from "child_process";

type IdSet = Set<string>;

interface TableStats {
    rowsScanned: number;
    rowsUpdated: number;
    rowsDeleted: number;
    invalidValuesFound: number;
}

interface CleanupReport {
    mode: "dry-run" | "apply";
    guildsTotal: number;
    guildsProcessed: number;
    rowsScanned: number;
    rowsUpdated: number;
    rowsDeleted: number;
    invalidValuesFound: number;
    invalidValuesAddressed: number;
    skippedGuilds: Array<{ guildId: string; reason: string }>;
    tables: Record<string, TableStats>;
}

interface FieldRule {
    column: string;
    kind: "role" | "channel" | "role_csv" | "channel_csv" | "mention_role";
    required?: boolean;
}

interface TableProcessConfig {
    table: string;
    fields: FieldRule[];
}

interface RequiredNormalizationResult {
    valid: boolean;
    value: string | null;
    changed: boolean;
    invalid: number;
}

interface NullableNormalizationResult {
    value: string | null;
    changed: boolean;
    invalid: number;
}

interface CsvNormalizationResult {
    value: string | null;
    changed: boolean;
    invalid: number;
}

const GUILD_TABLES: string[] = [
    "guild_config",
    "welcome_trigger",
    "verification_message_rule",
    "verification_role_message",
    "level_reward",
    "role_action",
    "moderation_settings",
    "reaction_role_message",
    "reaction_role",
    "birthday_config",
    "message_alias",
    "command_config",
];

const TABLE_CONFIGS: TableProcessConfig[] = [
    {
        table: "guild_config",
        fields: [
            { column: "auto_role_id", kind: "role" },
            { column: "join_message_channel_id", kind: "channel" },
            { column: "leave_message_channel_id", kind: "channel" },
            { column: "unverified_role_id", kind: "role" },
            { column: "verification_role_id", kind: "role" },
            { column: "boost_announcement_channel_id", kind: "channel" },
            { column: "boost_role_id", kind: "role" },
            { column: "level_up_channel_id", kind: "channel" },
        ],
    },
    {
        table: "welcome_trigger",
        fields: [
            { column: "role_id", kind: "role", required: true },
            { column: "channel_id", kind: "channel" },
        ],
    },
    {
        table: "verification_message_rule",
        fields: [
            { column: "role_id", kind: "role", required: true },
            { column: "notify_channel_id", kind: "channel" },
        ],
    },
    {
        table: "verification_role_message",
        fields: [{ column: "role_id", kind: "role", required: true }],
    },
    {
        table: "level_reward",
        fields: [{ column: "role_id", kind: "role", required: true }],
    },
    {
        table: "role_action",
        fields: [
            { column: "role_id", kind: "role", required: true },
            { column: "channel_id", kind: "channel" },
            { column: "log_channel_id", kind: "channel" },
        ],
    },
    {
        table: "moderation_settings",
        fields: [
            { column: "log_channel_id", kind: "channel" },
            { column: "mute_role_id", kind: "role" },
        ],
    },
    {
        table: "reaction_role_message",
        fields: [{ column: "channel_id", kind: "channel", required: true }],
    },
    {
        table: "reaction_role",
        fields: [
            { column: "channel_id", kind: "channel", required: true },
            { column: "role_id", kind: "role", required: true },
            { column: "exclusive_role_ids", kind: "role_csv" },
        ],
    },
    {
        table: "birthday_config",
        fields: [
            { column: "channel_id", kind: "channel" },
            { column: "role_id", kind: "role" },
            { column: "mention_role_id", kind: "mention_role" },
        ],
    },
    {
        table: "message_alias",
        fields: [
            { column: "allowed_channels", kind: "channel_csv" },
            { column: "allowed_roles", kind: "role_csv" },
        ],
    },
    {
        table: "command_config",
        fields: [
            { column: "enabled_roles", kind: "role_csv" },
            { column: "disabled_roles", kind: "role_csv" },
            { column: "enabled_channels", kind: "channel_csv" },
            { column: "disabled_channels", kind: "channel_csv" },
            { column: "roles_can_skip_max_limit", kind: "role_csv" },
        ],
    },
];

function resolveDbPath(): string {
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl && databaseUrl.startsWith("file:")) {
        return databaseUrl.replace("file:", "");
    }
    return "./data/ixoye.db";
}

function parseArgs(args: string[]): { apply: boolean; guildId: string | null } {
    let apply = false;
    let guildId: string | null = null;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--apply") {
            apply = true;
            continue;
        }
        if (arg === "--guild") {
            guildId = args[i + 1] ?? null;
            i++;
        }
    }

    return { apply, guildId };
}

function ensureTableStats(report: CleanupReport, table: string): TableStats {
    if (!report.tables[table]) {
        report.tables[table] = {
            rowsScanned: 0,
            rowsUpdated: 0,
            rowsDeleted: 0,
            invalidValuesFound: 0,
        };
    }
    return report.tables[table];
}

function normalizeRequiredId(value: unknown, validIds: IdSet): RequiredNormalizationResult {
    if (typeof value !== "string") {
        return { valid: false, value: null, changed: true, invalid: 1 };
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return { valid: false, value: null, changed: true, invalid: 1 };
    }

    if (!validIds.has(trimmed)) {
        return { valid: false, value: null, changed: true, invalid: 1 };
    }

    return {
        valid: true,
        value: trimmed,
        changed: trimmed !== value,
        invalid: 0,
    };
}

function normalizeNullableId(value: unknown, validIds: IdSet): NullableNormalizationResult {
    if (value === null || value === undefined) {
        return { value: null, changed: false, invalid: 0 };
    }

    if (typeof value !== "string") {
        return { value: null, changed: true, invalid: 1 };
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return { value: null, changed: true, invalid: value.length > 0 ? 1 : 0 };
    }

    if (!validIds.has(trimmed)) {
        return { value: null, changed: true, invalid: 1 };
    }

    return {
        value: trimmed,
        changed: trimmed !== value,
        invalid: 0,
    };
}

function normalizeCsvIds(value: unknown, validIds: IdSet): CsvNormalizationResult {
    if (value === null || value === undefined) {
        return { value: null, changed: false, invalid: 0 };
    }

    if (typeof value !== "string") {
        return { value: null, changed: true, invalid: 1 };
    }

    const seen = new Set<string>();
    const normalized: string[] = [];
    let invalid = 0;

    const parts = value.split(",");
    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) {
            if (part.length > 0) invalid++;
            continue;
        }

        if (!validIds.has(trimmed)) {
            invalid++;
            continue;
        }

        if (!seen.has(trimmed)) {
            seen.add(trimmed);
            normalized.push(trimmed);
        }
    }

    const nextValue = normalized.length > 0 ? normalized.join(",") : null;
    return {
        value: nextValue,
        changed: nextValue !== value,
        invalid,
    };
}

function normalizeMentionRole(value: unknown, validRoleIds: IdSet): NullableNormalizationResult {
    if (value === null || value === undefined) {
        return { value: null, changed: false, invalid: 0 };
    }

    if (typeof value !== "string") {
        return { value: null, changed: true, invalid: 1 };
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return { value: null, changed: true, invalid: value.length > 0 ? 1 : 0 };
    }

    if (trimmed === "everyone" || trimmed === "here") {
        return {
            value: trimmed,
            changed: trimmed !== value,
            invalid: 0,
        };
    }

    if (!validRoleIds.has(trimmed)) {
        return { value: null, changed: true, invalid: 1 };
    }

    return {
        value: trimmed,
        changed: trimmed !== value,
        invalid: 0,
    };
}

function applyRowUpdate(
    db: Database.Database,
    table: string,
    rowId: string,
    updates: Record<string, unknown>,
    apply: boolean
): void {
    if (!apply || Object.keys(updates).length === 0) return;

    const setClause = Object.keys(updates)
        .map((column) => `${column} = @${column}`)
        .join(", ");

    const statement = db.prepare(`UPDATE ${table} SET ${setClause} WHERE id = @id`);
    statement.run({ id: rowId, ...updates });
}

function applyRowDelete(
    db: Database.Database,
    table: string,
    rowId: string,
    apply: boolean
): void {
    if (!apply) return;
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(rowId);
}

function processTableForGuild(
    db: Database.Database,
    report: CleanupReport,
    guildId: string,
    roleIds: IdSet,
    channelIds: IdSet,
    apply: boolean,
    config: TableProcessConfig
): void {
    const stats = ensureTableStats(report, config.table);
    const columns = config.fields.map((field) => field.column);
    const selectColumns = ["id", ...columns].join(", ");
    const rows = db.prepare(`SELECT ${selectColumns} FROM ${config.table} WHERE guild_id = ?`).all(guildId) as Array<Record<string, unknown>>;

    for (const row of rows) {
        stats.rowsScanned += 1;
        report.rowsScanned += 1;

        const rowId = typeof row.id === "string" ? row.id : null;
        if (!rowId) {
            stats.invalidValuesFound += 1;
            report.invalidValuesFound += 1;
            continue;
        }

        let invalidInRow = 0;
        let shouldDelete = false;
        const updates: Record<string, unknown> = {};

        for (const field of config.fields) {
            const rawValue = row[field.column];

            if (field.kind === "role") {
                if (field.required) {
                    const result = normalizeRequiredId(rawValue, roleIds);
                    invalidInRow += result.invalid;
                    if (!result.valid) {
                        shouldDelete = true;
                        continue;
                    }
                    if (result.changed) {
                        updates[field.column] = result.value;
                    }
                    continue;
                }

                const result = normalizeNullableId(rawValue, roleIds);
                invalidInRow += result.invalid;
                if (result.changed) {
                    updates[field.column] = result.value;
                }
                continue;
            }

            if (field.kind === "channel") {
                if (field.required) {
                    const result = normalizeRequiredId(rawValue, channelIds);
                    invalidInRow += result.invalid;
                    if (!result.valid) {
                        shouldDelete = true;
                        continue;
                    }
                    if (result.changed) {
                        updates[field.column] = result.value;
                    }
                    continue;
                }

                const result = normalizeNullableId(rawValue, channelIds);
                invalidInRow += result.invalid;
                if (result.changed) {
                    updates[field.column] = result.value;
                }
                continue;
            }

            if (field.kind === "role_csv") {
                const result = normalizeCsvIds(rawValue, roleIds);
                invalidInRow += result.invalid;
                if (result.changed) {
                    updates[field.column] = result.value;
                }
                continue;
            }

            if (field.kind === "channel_csv") {
                const result = normalizeCsvIds(rawValue, channelIds);
                invalidInRow += result.invalid;
                if (result.changed) {
                    updates[field.column] = result.value;
                }
                continue;
            }

            if (field.kind === "mention_role") {
                const result = normalizeMentionRole(rawValue, roleIds);
                invalidInRow += result.invalid;
                if (result.changed) {
                    updates[field.column] = result.value;
                }
            }
        }

        if (invalidInRow > 0) {
            stats.invalidValuesFound += invalidInRow;
            report.invalidValuesFound += invalidInRow;
        }

        if (shouldDelete) {
            stats.rowsDeleted += 1;
            report.rowsDeleted += 1;
            if (invalidInRow > 0) {
                report.invalidValuesAddressed += invalidInRow;
            }
            applyRowDelete(db, config.table, rowId, apply);
            continue;
        }

        if (Object.keys(updates).length > 0) {
            stats.rowsUpdated += 1;
            report.rowsUpdated += 1;
            if (invalidInRow > 0) {
                report.invalidValuesAddressed += invalidInRow;
            }
            applyRowUpdate(db, config.table, rowId, updates, apply);
        }
    }
}

function collectGuildIds(db: Database.Database, guildFilter: string | null): string[] {
    if (guildFilter) {
        return [guildFilter];
    }

    const guildIds = new Set<string>();
    for (const table of GUILD_TABLES) {
        const rows = db.prepare(`SELECT DISTINCT guild_id AS guildId FROM ${table}`).all() as Array<{ guildId: unknown }>;
        for (const row of rows) {
            if (typeof row.guildId === "string" && row.guildId.trim().length > 0) {
                guildIds.add(row.guildId.trim());
            }
        }
    }

    return [...guildIds].sort();
}

async function fetchGuildReferenceData(
    guildId: string,
    token: string
): Promise<{ ok: true; roleIds: IdSet; channelIds: IdSet } | { ok: false; reason: string }> {
    try {
        const [rolesResponse, channelsResponse] = await Promise.all([
            fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
                headers: { Authorization: `Bot ${token}` },
            }),
            fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
                headers: { Authorization: `Bot ${token}` },
            }),
        ]);

        if (!rolesResponse.ok || !channelsResponse.ok) {
            return {
                ok: false,
                reason: `roles=${rolesResponse.status}, channels=${channelsResponse.status}`,
            };
        }

        const rolesPayload = await rolesResponse.json() as Array<{ id?: unknown; name?: unknown }>;
        const channelsPayload = await channelsResponse.json() as Array<{ id?: unknown; type?: unknown }>;

        const roleIds = new Set<string>();
        for (const role of rolesPayload) {
            if (typeof role.id !== "string") continue;
            if (role.name === "@everyone") continue;
            roleIds.add(role.id);
        }

        const channelIds = new Set<string>();
        for (const channel of channelsPayload) {
            if (typeof channel.id !== "string") continue;
            if (channel.type !== 0) continue; // text channels only
            channelIds.add(channel.id);
        }

        return { ok: true, roleIds, channelIds };
    } catch (error) {
        return {
            ok: false,
            reason: error instanceof Error ? error.message : String(error),
        };
    }
}

function printReport(report: CleanupReport): void {
    const invalidAfter = Math.max(0, report.invalidValuesFound - report.invalidValuesAddressed);

    console.log("");
    console.log("Discord Identifier Cleanup Report");
    console.log("=".repeat(44));
    console.log(`Mode: ${report.mode}`);
    console.log(`Guilds total: ${report.guildsTotal}`);
    console.log(`Guilds processed: ${report.guildsProcessed}`);
    console.log(`Guilds skipped: ${report.skippedGuilds.length}`);
    console.log(`Rows scanned: ${report.rowsScanned}`);
    console.log(`Rows updated: ${report.rowsUpdated}`);
    console.log(`Rows deleted: ${report.rowsDeleted}`);
    console.log(`Invalid values before: ${report.invalidValuesFound}`);
    console.log(`Invalid values addressed: ${report.invalidValuesAddressed}`);
    console.log(`Invalid values after (processed guilds): ${invalidAfter}`);

    console.log("");
    console.log("Per-table stats:");
    const tableNames = Object.keys(report.tables).sort();
    for (const table of tableNames) {
        const stats = report.tables[table];
        if (
            stats.rowsScanned === 0
            && stats.rowsUpdated === 0
            && stats.rowsDeleted === 0
            && stats.invalidValuesFound === 0
        ) {
            continue;
        }
        console.log(
            `- ${table}: scanned=${stats.rowsScanned}, updated=${stats.rowsUpdated}, deleted=${stats.rowsDeleted}, invalid=${stats.invalidValuesFound}`
        );
    }

    if (report.skippedGuilds.length > 0) {
        console.log("");
        console.log("Skipped guilds:");
        for (const skipped of report.skippedGuilds) {
            console.log(`- ${skipped.guildId}: ${skipped.reason}`);
        }
    }

    console.log("");
    if (report.mode === "dry-run") {
        console.log("Dry-run complete. Re-run with --apply to persist these changes.");
    } else {
        console.log("Apply run complete.");
    }
}

async function main(): Promise<void> {
    const { apply, guildId } = parseArgs(process.argv.slice(2));
    const token = process.env.DISCORD_TOKEN;
    if (!token) {
        throw new Error("DISCORD_TOKEN is required to validate live guild data.");
    }

    if (guildId && !/^\d{17,20}$/.test(guildId)) {
        throw new Error(`Invalid guild id: ${guildId}`);
    }

    if (apply) {
        console.log("Creating backup before apply...");
        execSync("npm run db:backup", { stdio: "inherit" });
    }

    const dbPath = resolveDbPath();
    const db = new Database(dbPath);
    db.pragma("foreign_keys = ON");

    try {
        const guildIds = collectGuildIds(db, guildId);
        const report: CleanupReport = {
            mode: apply ? "apply" : "dry-run",
            guildsTotal: guildIds.length,
            guildsProcessed: 0,
            rowsScanned: 0,
            rowsUpdated: 0,
            rowsDeleted: 0,
            invalidValuesFound: 0,
            invalidValuesAddressed: 0,
            skippedGuilds: [],
            tables: {},
        };

        for (const tableConfig of TABLE_CONFIGS) {
            ensureTableStats(report, tableConfig.table);
        }

        if (guildIds.length === 0) {
            console.log("No guild data found to process.");
            printReport(report);
            return;
        }

        for (const currentGuildId of guildIds) {
            const guildData = await fetchGuildReferenceData(currentGuildId, token);
            if (!guildData.ok) {
                report.skippedGuilds.push({ guildId: currentGuildId, reason: guildData.reason });
                continue;
            }

            const execute = (): void => {
                for (const tableConfig of TABLE_CONFIGS) {
                    processTableForGuild(
                        db,
                        report,
                        currentGuildId,
                        guildData.roleIds,
                        guildData.channelIds,
                        apply,
                        tableConfig
                    );
                }
            };

            if (apply) {
                const tx = db.transaction(execute);
                tx();
            } else {
                execute();
            }

            report.guildsProcessed += 1;
        }

        printReport(report);
    } finally {
        db.close();
    }
}

main().catch((error) => {
    console.error("Cleanup failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
});
