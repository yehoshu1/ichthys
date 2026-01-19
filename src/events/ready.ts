import { Client, Events } from 'discord.js';

export default {
    name: Events.ClientReady,
    once: true,
    execute(client: Client) {
        console.log(`✅ Logged in as ${client.user?.tag}`);
        console.log(`📊 Serving ${client.guilds.cache.size} guild(s):`);
        client.guilds.cache.forEach(guild => {
            console.log(`   - ${guild.name} (ID: ${guild.id})`);
        });
    },
};
