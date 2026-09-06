import { SearchEntry } from "./types";

const SETTINGS_CACHE_TTL_MS = 60_000;
const MAX_SETTINGS_ENTRIES = 2_500;
const MAX_VALUE_PREVIEW_LENGTH = 180;
const MAX_CACHE_GUILDS = 200;

interface SettingsCacheEntry {
    entries: SearchEntry[];
    expiresAt: number;
    cachedAt: number;
}

const settingsCache = new Map<string, SettingsCacheEntry>();
const inFlight = new Map<string, Promise<SearchEntry[]>>();

function cleanupCache(now: number): void {
    for (const [guildId, entry] of settingsCache.entries()) {
        if (entry.expiresAt <= now) {
            settingsCache.delete(guildId);
        }
    }

    if (settingsCache.size <= MAX_CACHE_GUILDS) {
        return;
    }

    const ordered = Array.from(settingsCache.entries()).sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    const overflow = settingsCache.size - MAX_CACHE_GUILDS;
    for (let index = 0; index < overflow; index += 1) {
        const [guildId] = ordered[index] ?? [];
        if (guildId) {
            settingsCache.delete(guildId);
        }
    }
}

function truncateValue(value: string): string {
    if (value.length <= MAX_VALUE_PREVIEW_LENGTH) {
        return value;
    }
    return `${value.slice(0, MAX_VALUE_PREVIEW_LENGTH - 1)}…`;
}

function readableSegment(segment: string): string {
    return segment
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .trim()
        .replace(/^./, (value) => value.toUpperCase());
}

function buildEntryTitle(pathSegments: string[]): string {
    const groupLabels: Record<string, string> = {
        config: "Server Config",
        welcomeTriggers: "Welcome Trigger",
        messageTemplates: "Message Template",
        levelRewards: "Level Reward",
        roleActions: "Role Action",
        verificationRules: "Verification Rule",
        verificationRoleMessages: "Verification Role Message",
        moderationSettings: "Moderation Settings",
        birthdayConfig: "Birthday Config",
        birthdayEntries: "Birthday Entry",
        messageAliases: "Message Alias",
        commandConfigs: "Command Config",
    };

    const [root, maybeIndex, ...rest] = pathSegments;
    const rootLabel = groupLabels[root] ?? readableSegment(root);

    if (maybeIndex && /^\d+$/.test(maybeIndex)) {
        const itemNumber = Number(maybeIndex) + 1;
        const suffix = rest.map(readableSegment).join(" / ");
        return suffix ? `${rootLabel} #${itemNumber} / ${suffix}` : `${rootLabel} #${itemNumber}`;
    }

    const suffix = [maybeIndex, ...rest].filter(Boolean).map(readableSegment).join(" / ");
    return suffix ? `${rootLabel} / ${suffix}` : rootLabel;
}

function mapSettingsPathToHref(path: string, guildId: string): string {
    if (path.startsWith("config.welcome")) {
        return `/dashboard/${guildId}/welcome?tab=general`;
    }
    if (path.startsWith("welcomeTriggers")) {
        return `/dashboard/${guildId}/welcome?tab=triggers`;
    }
    if (path.startsWith("messageTemplates")) {
        return `/dashboard/${guildId}/welcome?tab=templates`;
    }
    if (
        path.startsWith("config.verification")
        || path.startsWith("verificationRules")
        || path.startsWith("verificationRoleMessages")
    ) {
        return `/dashboard/${guildId}/verification`;
    }
    if (
        path.startsWith("config.leveling")
        || path.startsWith("config.textXp")
        || path.startsWith("config.voiceXp")
        || path.startsWith("config.levelUp")
        || path.startsWith("levelRewards")
    ) {
        return `/dashboard/${guildId}/leveling?tab=settings`;
    }
    if (path.startsWith("config.boost")) {
        return `/dashboard/${guildId}/boosts`;
    }
    if (path.startsWith("moderationSettings")) {
        return `/dashboard/${guildId}/moderation?tab=settings`;
    }
    if (path.startsWith("birthdayConfig") || path.startsWith("birthdayEntries")) {
        return `/dashboard/${guildId}/birthdays?tab=settings`;
    }
    if (path.startsWith("messageAliases")) {
        return `/dashboard/${guildId}/aliases`;
    }
    if (path.startsWith("commandConfigs")) {
        return `/dashboard/${guildId}/commands?tab=aliases`;
    }
    if (path.startsWith("roleActions")) {
        return `/dashboard/${guildId}/role-actions`;
    }

    return `/dashboard/${guildId}/settings?focus=${encodeURIComponent(path)}`;
}

function pushPrimitiveEntry(
    entries: SearchEntry[],
    guildId: string,
    pathSegments: string[],
    primitive: string | number | boolean
): void {
    if (entries.length >= MAX_SETTINGS_ENTRIES) {
        return;
    }

    const path = pathSegments.join(".");
    const valueString = truncateValue(String(primitive).trim());
    const valuePreview = valueString.length > 0 ? valueString : undefined;

    entries.push({
        id: `settings:${path}:${entries.length}`,
        source: "settings",
        title: buildEntryTitle(pathSegments),
        description: `Setting path: ${path}`,
        href: mapSettingsPathToHref(path, guildId),
        keywords: [
            path,
            ...pathSegments,
            valueString,
        ].filter(Boolean),
        valuePreview,
        priority: 55,
    });
}

function flattenSettings(
    entries: SearchEntry[],
    guildId: string,
    value: unknown,
    pathSegments: string[]
): void {
    if (entries.length >= MAX_SETTINGS_ENTRIES) {
        return;
    }

    if (value === null || value === undefined) {
        return;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        pushPrimitiveEntry(entries, guildId, pathSegments, value);
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            flattenSettings(entries, guildId, item, [...pathSegments, String(index)]);
        });
        return;
    }

    if (typeof value === "object") {
        Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
            flattenSettings(entries, guildId, child, [...pathSegments, key]);
        });
    }
}

async function fetchGuildSettingsExport(guildId: string): Promise<Record<string, unknown>> {
    const response = await fetch(`/api/guilds/${guildId}/settings/export`, {
        cache: "no-store",
        credentials: "same-origin",
    });

    if (!response.ok) {
        let errorMessage = "";
        try {
            const payload = await response.json() as { error?: string };
            errorMessage = typeof payload?.error === "string" ? payload.error : "";
        } catch {
            // Ignore parse failures for non-JSON responses.
        }
        throw new Error(`SETTINGS_EXPORT_${response.status}${errorMessage ? `:${errorMessage}` : ""}`);
    }

    const text = await response.text();
    const parsed = JSON.parse(text) as Record<string, unknown>;
    return parsed;
}

async function buildGuildSettingsEntries(guildId: string): Promise<SearchEntry[]> {
    const payload = await fetchGuildSettingsExport(guildId);
    const entries: SearchEntry[] = [];
    const skipRootKeys = new Set(["version", "timestamp", "guildId"]);

    Object.entries(payload).forEach(([key, value]) => {
        if (skipRootKeys.has(key)) {
            return;
        }
        flattenSettings(entries, guildId, value, [key]);
    });

    return entries;
}

export async function getGuildSettingsSearchEntries(guildId: string): Promise<SearchEntry[]> {
    const now = Date.now();
    cleanupCache(now);

    const cached = settingsCache.get(guildId);
    if (cached && cached.expiresAt > now) {
        return cached.entries;
    }

    const existingPromise = inFlight.get(guildId);
    if (existingPromise) {
        return existingPromise;
    }

    const staleEntries = cached?.entries;
    const promise = buildGuildSettingsEntries(guildId)
        .then((entries) => {
            settingsCache.set(guildId, {
                entries,
                expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS,
                cachedAt: Date.now(),
            });
            return entries;
        })
        .catch((error) => {
            if (staleEntries && staleEntries.length > 0) {
                return staleEntries;
            }
            throw error;
        })
        .finally(() => {
            inFlight.delete(guildId);
        });

    inFlight.set(guildId, promise);
    return promise;
}
