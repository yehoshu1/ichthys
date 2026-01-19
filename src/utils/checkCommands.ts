import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';

config();

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

(async () => {
    try {
        console.log('Fetching registered commands...');

        let commands: any;
        if (process.env.GUILD_ID) {
            console.log(`Checking Guild ${process.env.GUILD_ID}...`);
            commands = await rest.get(
                Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID!, process.env.GUILD_ID)
            );
        } else {
            console.log('Checking Global commands...');
            commands = await rest.get(
                Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!)
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
