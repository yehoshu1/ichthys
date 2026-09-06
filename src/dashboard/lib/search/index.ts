import { searchEntries } from "./score";
import { getGuildSettingsSearchEntries } from "./settings-source";
import { buildStaticSearchEntries } from "./static-sources";
import { SearchContext, SearchEntry, SearchIndexBuildResult, SearchResultGroup, SearchSource } from "./types";

const GROUP_ORDER: SearchSource[] = ["settings", "feature", "docs"];
const GROUP_LABELS: Record<SearchSource, string> = {
    settings: "Settings",
    feature: "Features",
    docs: "Docs",
};

function toSettingsWarning(error: unknown): string {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("SETTINGS_EXPORT_429")) {
        return "Settings search is temporarily rate-limited. Showing features and docs results only.";
    }
    if (message.startsWith("SETTINGS_EXPORT_401")) {
        return "Your session expired for settings search. Showing features and docs results only.";
    }
    if (message.startsWith("SETTINGS_EXPORT_403")) {
        return "You no longer have permission to search this guild's settings.";
    }
    return "Could not load guild settings right now. Showing features and docs results only.";
}

export async function buildSearchIndex(context: SearchContext): Promise<SearchIndexBuildResult> {
    const staticEntries = buildStaticSearchEntries(context);

    if (context.mode !== "dashboard" || !context.guildId) {
        return { entries: staticEntries };
    }

    try {
        const settingsEntries = await getGuildSettingsSearchEntries(context.guildId);
        return {
            entries: [...settingsEntries, ...staticEntries],
        };
    } catch (error) {
        return {
            entries: staticEntries,
            warning: toSettingsWarning(error),
        };
    }
}

export function querySearchEntries(entries: SearchEntry[], query: string, limit = 40): SearchEntry[] {
    return searchEntries(entries, query, limit);
}

export function groupSearchResults(entries: SearchEntry[]): SearchResultGroup[] {
    const grouped = new Map<SearchSource, SearchEntry[]>();
    for (const entry of entries) {
        const items = grouped.get(entry.source) ?? [];
        items.push(entry);
        grouped.set(entry.source, items);
    }

    return GROUP_ORDER
        .map((source) => ({
            source,
            label: GROUP_LABELS[source],
            items: grouped.get(source) ?? [],
        }))
        .filter((group) => group.items.length > 0);
}

export * from "./types";
