import { SearchEntry } from "./types";

function normalizeText(value: string): string {
    return value.toLowerCase().trim().replace(/\s+/g, " ");
}

function tokenize(value: string): string[] {
    return normalizeText(value)
        .split(" ")
        .map((part) => part.trim())
        .filter(Boolean);
}

function scoreTokenInEntry(entry: SearchEntry, token: string): number {
    const title = normalizeText(entry.title);
    const description = normalizeText(entry.description ?? "");
    const keywords = normalizeText(entry.keywords.join(" "));
    const valuePreview = normalizeText(entry.valuePreview ?? "");

    if (title === token) return 160;
    if (title.startsWith(token)) return 120;

    const titleParts = title.split(" ");
    if (titleParts.includes(token)) return 90;
    if (keywords.includes(token)) return 60;
    if (description.includes(token)) return 36;
    if (valuePreview.includes(token)) return 20;

    return 0;
}

function scoreEntry(entry: SearchEntry, query: string): number {
    const tokens = tokenize(query);
    if (tokens.length === 0) {
        return entry.priority;
    }

    let score = entry.priority;
    for (const token of tokens) {
        const tokenScore = scoreTokenInEntry(entry, token);
        if (tokenScore <= 0) {
            return 0;
        }
        score += tokenScore;
    }

    return score;
}

export function searchEntries(entries: SearchEntry[], query: string, limit = 40): SearchEntry[] {
    const scored = entries
        .map((entry) => ({ entry, score: scoreEntry(entry, query) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (b.entry.priority !== a.entry.priority) return b.entry.priority - a.entry.priority;
            const titleCompare = a.entry.title.localeCompare(b.entry.title);
            if (titleCompare !== 0) return titleCompare;
            return a.entry.id.localeCompare(b.entry.id);
        })
        .slice(0, limit);

    return scored.map((item) => item.entry);
}
