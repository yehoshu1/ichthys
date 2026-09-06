import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';

config();

const SNOWFLAKE_PATTERN = /^\d{17,19}$/;
const PLACEHOLDER_VALUES = new Set([
    '',
    'your_guild_id_here',
    'your_test_guild_id',
]);

function getRequiredEnv(name: 'DISCORD_TOKEN' | 'DISCORD_CLIENT_ID'): string {
    const value = process.env[name]?.trim();
    if (!value) {
        console.error(`Missing required environment variable: ${name}`);
        process.exit(1);
    }

    return value;
}

function getTargetGuildId(): string | null {
    const rawGuildId = process.env.GUILD_ID?.trim();
    if (!rawGuildId || PLACEHOLDER_VALUES.has(rawGuildId)) {
        if (rawGuildId) {
            console.warn(`Ignoring placeholder GUILD_ID value "${rawGuildId}" and checking global commands instead.`);
        }
        return null;
    }

    if (!SNOWFLAKE_PATTERN.test(rawGuildId)) {
        console.error(`Invalid GUILD_ID "${rawGuildId}". Expected a Discord snowflake (17-19 digits).`);
        process.exit(1);
    }

    return rawGuildId;
}

const discordToken = getRequiredEnv('DISCORD_TOKEN');
const clientId = getRequiredEnv('DISCORD_CLIENT_ID');
const targetGuildId = getTargetGuildId();
const rest = new REST().setToken(discordToken);

(async () => {
    try {
        console.log('Fetching registered commands...');

        let commands: any;
        if (targetGuildId) {
            console.log(`Checking Guild ${targetGuildId}...`);
            commands = await rest.get(
                Routes.applicationGuildCommands(clientId, targetGuildId)
            );
        } else {
            console.log('Checking Global commands...');
            commands = await rest.get(
                Routes.applicationCommands(clientId)
            );
        }

        console.log(`Found ${commands.length} commands:`);
        commands.forEach((cmd: any) => {
            console.log(`- /${cmd.name}: ${cmd.description}`);
            if (cmd.options) {
                cmd.options.forEach((opt: any) => {
                    console.log(`  -- ${opt.name} (${opt.type})`);
                    if (opt.choices) {
                        console.log(`     Choices: ${opt.choices.map((c: any) => c.name).join(', ')}`);
                    }
                });
            }
        });

    } catch (error) {
        console.error('Error fetching commands:', error);
    }
})();
