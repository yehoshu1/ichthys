import fs from 'fs';
import path from 'path';
import { CANONICAL_COMMAND_IDS as STATIC_CANONICAL_COMMAND_IDS } from './constants/commands';

const CACHE_TTL_MS = 60_000;

let cachedCommands: { expiresAt: number; ids: string[] } | null = null;

function extractCommandId(fileContent: string): string | null {
    const match = fileContent.match(
        /new\s+SlashCommandBuilder\s*\(\s*\)[\s\S]*?\.setName\s*\(\s*(['"`])([a-z0-9_-]+)\1\s*\)/
    );
    return match?.[2] ?? null;
}

function findCommandDirectory(): string | null {
    const candidates = [
        path.resolve(process.cwd(), 'src/bot/commands'),
        path.resolve(process.cwd(), 'dist/bot/commands'),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }

    return null;
}

function readCommandIdsFromFiles(): string[] {
    const commandsDir = findCommandDirectory();
    if (!commandsDir) {
        return Array.from(STATIC_CANONICAL_COMMAND_IDS);
    }

    const files = fs
        .readdirSync(commandsDir)
        .filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

    const ids = new Set<string>();

    for (const file of files) {
        const filePath = path.join(commandsDir, file);
        try {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const commandId = extractCommandId(fileContent);
            if (commandId) {
                ids.add(commandId);
            }
        } catch {
            // ignore unreadable files and continue catalog build
        }
    }

    if (ids.size === 0) {
        return Array.from(STATIC_CANONICAL_COMMAND_IDS);
    }

    return Array.from(ids).sort((a, b) => a.localeCompare(b));
}

export function getCanonicalCommandIds(): string[] {
    const now = Date.now();
    if (cachedCommands && cachedCommands.expiresAt > now) {
        return cachedCommands.ids;
    }

    const ids = readCommandIdsFromFiles();
    cachedCommands = {
        ids,
        expiresAt: now + CACHE_TTL_MS,
    };

    return ids;
}

export function getCanonicalCommandIdSet(): Set<string> {
    return new Set(getCanonicalCommandIds());
}
