export function toSearchSlug(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

export function toCommandAnchor(command: string): string {
    return `cmd-${toSearchSlug(command.replace(/^\//, ""))}`;
}
