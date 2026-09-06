export type SearchSource = "settings" | "feature" | "docs";

export type SearchMode = "dashboard" | "docs";

export interface SearchContext {
    mode: SearchMode;
    guildId?: string;
}

export interface SearchEntry {
    id: string;
    source: SearchSource;
    title: string;
    description?: string;
    href: string;
    keywords: string[];
    valuePreview?: string;
    priority: number;
}

export interface SearchResultGroup {
    source: SearchSource;
    label: string;
    items: SearchEntry[];
}

export interface SearchIndexBuildResult {
    entries: SearchEntry[];
    warning?: string;
}
