import fs from 'fs';
import path from 'path';
import { CANONICAL_COMMAND_IDS } from '../src/shared/constants/commands';

function extractCommandId(filePath: string): string | null {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(
        /new\s+SlashCommandBuilder\s*\(\s*\)[\s\S]*?\.setName\s*\(\s*(['"`])([a-z0-9_-]+)\1\s*\)/
    );
    return match?.[2] ?? null;
}

function main(): void {
    const commandsDir = path.resolve(process.cwd(), 'src/bot/commands');
    if (!fs.existsSync(commandsDir)) {
        console.error('Commands directory not found:', commandsDir);
        process.exit(1);
    }

    const commandIds = fs
        .readdirSync(commandsDir)
        .filter((file) => file.endsWith('.ts'))
        .map((file) => extractCommandId(path.join(commandsDir, file)))
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => a.localeCompare(b));

    const canonical = [...CANONICAL_COMMAND_IDS].sort((a, b) => a.localeCompare(b));
    const canonicalSet = new Set<string>(canonical as string[]);
    const commandSet = new Set(commandIds);

    const missingInCanonical = commandIds.filter((id) => !canonicalSet.has(id));
    const staleInCanonical = canonical.filter((id) => !commandSet.has(id));

    if (missingInCanonical.length === 0 && staleInCanonical.length === 0) {
        console.log('✅ Command catalog is in sync.');
        return;
    }

    if (missingInCanonical.length > 0) {
        console.error('❌ Missing in CANONICAL_COMMAND_IDS:', missingInCanonical.join(', '));
    }

    if (staleInCanonical.length > 0) {
        console.error('❌ Stale in CANONICAL_COMMAND_IDS:', staleInCanonical.join(', '));
    }

    process.exit(1);
}

main();
