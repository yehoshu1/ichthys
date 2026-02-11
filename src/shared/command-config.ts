export function parseCsvList(value: string[] | string | null | undefined): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
        return normalizeUniqueList(value);
    }

    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

export function normalizeUniqueList(values: string[]): string[] {
    const normalized = values
        .map((value) => value.trim())
        .filter(Boolean);
    return Array.from(new Set(normalized));
}

export function serializeCsvList(values: string[]): string[] | null {
    const normalized = normalizeUniqueList(values);
    return normalized.length > 0 ? normalized : null;
}

