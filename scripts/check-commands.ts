/**
 * Script to check Discord command registration status
 * Usage: tsx scripts/check-commands.ts [guildId]
 */

import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { CANONICAL_COMMAND_IDS } from '../src/shared/constants/commands';

config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
    console.error('❌ Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment');
    process.exit(1);
}

const rest = new REST().setToken(token!);

async function checkCommands() {
    const guildId = process.argv[2];
    
    try {
        console.log('🔍 Checking Discord command registration status...\n');
        
        // Check global commands
        console.log('📡 Fetching GLOBAL commands...');
        const globalCommands = await rest.get(Routes.applicationCommands(clientId!)) as any[];
        console.log(`   Found ${globalCommands.length} global commands`);
        
        const globalCommandNames = new Set(globalCommands.map(c => c.name));
        const missingGlobal = CANONICAL_COMMAND_IDS.filter(id => !globalCommandNames.has(id));
        
        if (globalCommands.length > 0) {
            console.log('   Global commands:', globalCommands.map(c => c.name).join(', '));
        }
        
        if (missingGlobal.length > 0) {
            console.log(`   ⚠️  Missing from global: ${missingGlobal.join(', ')}`);
        }
        
        // Check guild-specific commands if guildId provided
        if (guildId) {
            console.log(`\n🏰 Fetching GUILD commands for ${guildId}...`);
            try {
                const guildCommands = await rest.get(
                    Routes.applicationGuildCommands(clientId!, guildId)
                ) as any[];
                console.log(`   Found ${guildCommands.length} guild-specific commands`);
                
                if (guildCommands.length > 0) {
                    console.log('   Guild commands:', guildCommands.map(c => c.name).join(', '));
                }
            } catch (error: any) {
                console.error(`   ❌ Error fetching guild commands: ${error.message}`);
                if (error.message.includes('Missing Access')) {
                    console.log('   💡 The bot is not in this guild or lacks permissions');
                }
            }
        }
        
        console.log('\n📊 Summary:');
        console.log(`   Total canonical commands: ${CANONICAL_COMMAND_IDS.length}`);
        console.log(`   Global commands registered: ${globalCommands.length}`);
        
        if (globalCommands.length === 0 && !guildId) {
            console.log('\n❌ No commands are registered!');
            console.log('   Run: npm run deploy');
            console.log('   Or for a specific guild: GUILD_ID=your_guild_id npm run deploy');
        } else if (missingGlobal.length > 0) {
            console.log(`\n⚠️  ${missingGlobal.length} commands are not registered globally`);
            console.log('   To register all commands globally: npm run deploy');
            console.log('   To register for a specific guild: GUILD_ID=your_guild_id npm run deploy');
        } else {
            console.log('\n✅ All canonical commands are registered globally!');
        }
        
        console.log('\n💡 About aliases:');
        console.log('   When you configure aliases in the dashboard, they are cloned from');
        console.log('   the base commands. The base commands must exist first.');
        
    } catch (error: any) {
        console.error('❌ Error checking commands:', error.message);
        if (error.message.includes('Invalid token')) {
            console.log('   💡 Your DISCORD_TOKEN may be invalid or expired');
        }
        process.exit(1);
    }
}

checkCommands();
