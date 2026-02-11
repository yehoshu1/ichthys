import { SearchContext, SearchEntry, SearchSource } from "./types";

const TELEMETRY_ENDPOINT = "/api/search/telemetry";
const MAX_PAGE_LENGTH = 240;

export type SearchOpenMethod =
    | "click"
    | "focus"
    | "shortcut"
    | "mobile_button"
    | "docs_button"
    | "unknown";

export type SearchSelectMethod = "mouse" | "keyboard";

interface SearchTelemetryBasePayload {
    event: "search_open" | "search_query" | "search_select";
    mode: SearchContext["mode"];
    guildId?: string;
    page?: string;
    timestamp: number;
}

interface SearchOpenPayload extends SearchTelemetryBasePayload {
    event: "search_open";
    trigger: SearchOpenMethod;
    indexSize: number;
}

interface SearchQueryPayload extends SearchTelemetryBasePayload {
    event: "search_query";
    queryHash: string;
    queryLength: number;
    tokenCount: number;
    resultCount: number;
    topSources: SearchSource[];
}

interface SearchSelectPayload extends SearchTelemetryBasePayload {
    event: "search_select";
    selectedEntryId: string;
    selectedSource: SearchSource;
    selectedRank: number;
    selectionMethod: SearchSelectMethod;
    queryHash?: string;
    resultCount: number;
}

type SearchTelemetryPayload = SearchOpenPayload | SearchQueryPayload | SearchSelectPayload;

function normalizeQuery(query: string): string {
    return query.toLowerCase().trim().replace(/\s+/g, " ");
}

function getPagePath(): string | undefined {
    if (typeof window === "undefined") return undefined;
    const path = `${window.location.pathname}${window.location.search}`;
    return path.slice(0, MAX_PAGE_LENGTH);
}

function sendTelemetry(payload: SearchTelemetryPayload): void {
    if (typeof window === "undefined") return;

    const body = JSON.stringify(payload);

    try {
        if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
            const beaconBody = new Blob([body], { type: "application/json" });
            if (navigator.sendBeacon(TELEMETRY_ENDPOINT, beaconBody)) {
                return;
            }
        }
    } catch {
        // Fall back to fetch below.
    }

    void fetch(TELEMETRY_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "same-origin",
        keepalive: true,
        body,
    }).catch((error) => { console.warn(`Failed to send search telemetry:`, error); return undefined; });
}

export function hashSearchQuery(query: string): string {
    const normalized = normalizeQuery(query);
    let hash = 2166136261;
    for (let index = 0; index < normalized.length; index += 1) {
        hash ^= normalized.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}

export function normalizeSearchQuery(query: string): string {
    return normalizeQuery(query);
}

export function trackSearchOpen(
    context: SearchContext,
    options: {
        trigger: SearchOpenMethod;
        indexSize: number;
    }
): void {
    sendTelemetry({
        event: "search_open",
        mode: context.mode,
        guildId: context.guildId,
        page: getPagePath(),
        timestamp: Date.now(),
        trigger: options.trigger,
        indexSize: options.indexSize,
    });
}

export function trackSearchQuery(
    context: SearchContext,
    options: {
        queryHash: string;
        queryLength: number;
        tokenCount: number;
        resultCount: number;
        topSources: SearchSource[];
    }
): void {
    sendTelemetry({
        event: "search_query",
        mode: context.mode,
        guildId: context.guildId,
        page: getPagePath(),
        timestamp: Date.now(),
        queryHash: options.queryHash,
        queryLength: options.queryLength,
        tokenCount: options.tokenCount,
        resultCount: options.resultCount,
        topSources: options.topSources.slice(0, 3),
    });
}

export function trackSearchSelect(
    context: SearchContext,
    options: {
        entry: SearchEntry;
        rank: number;
        selectionMethod: SearchSelectMethod;
        resultCount: number;
        queryHash?: string;
    }
): void {
    sendTelemetry({
        event: "search_select",
        mode: context.mode,
        guildId: context.guildId,
        page: getPagePath(),
        timestamp: Date.now(),
        selectedEntryId: options.entry.id.slice(0, 220),
        selectedSource: options.entry.source,
        selectedRank: options.rank,
        selectionMethod: options.selectionMethod,
        resultCount: options.resultCount,
        queryHash: options.queryHash,
    });
}
