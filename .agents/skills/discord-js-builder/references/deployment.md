# Discord.js Deployment Patterns

Reference for deploying commands and the bot.

## Command Registration

### Global vs Guild Commands

```typescript
// Guild commands (instant update, good for development)
await rest.put(
  Routes.applicationGuildCommands(clientId, guildId),
  { body: commands }
);

// Global commands (takes up to 1 hour to update, good for production)
await rest.put(
  Routes.applicationCommands(clientId),
  { body: commands }
);
```

### Complete Deploy Script

```typescript
import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { config } from 'dotenv';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Command } from './types/index.js';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const commands: unknown[] = [];

// Load all command data
const commandsPath = join(__dirname, 'commands');
const commandFiles = readdirSync(commandsPath).filter(file => 
  file.endsWith('.ts') || file.endsWith('.js')
);

for (const file of commandFiles) {
  const filePath = join(commandsPath, file);
  const command = (await import(filePath)).default as Command;
  
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
  } else {
    console.log(`[WARNING] Command at ${filePath} is missing required properties.`);
  }
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

// Command line arguments
const args = process.argv.slice(2);
const deployGlobal = args.includes('--global');
const deleteCommands = args.includes('--delete');

(async () => {
  try {
    if (deleteCommands) {
      console.log('Deleting all commands...');
      
      if (deployGlobal) {
        await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), { body: [] });
        console.log('Deleted all global commands.');
      } else {
        await rest.put(
          Routes.applicationGuildCommands(
            process.env.DISCORD_CLIENT_ID!,
            process.env.DISCORD_GUILD_ID!
          ),
          { body: [] }
        );
        console.log('Deleted all guild commands.');
      }
      return;
    }

    console.log(`Started refreshing ${commands.length} application (/) commands.`);

    if (deployGlobal) {
      const data = await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
        { body: commands }
      ) as unknown[];
      console.log(`Successfully reloaded ${data.length} global application (/) commands.`);
    } else {
      const data = await rest.put(
        Routes.applicationGuildCommands(
          process.env.DISCORD_CLIENT_ID!,
          process.env.DISCORD_GUILD_ID!
        ),
        { body: commands }
      ) as unknown[];
      console.log(`Successfully reloaded ${data.length} guild application (/) commands.`);
    }
  } catch (error) {
    console.error(error);
  }
})();
```

### Usage

```bash
# Deploy guild commands (development)
bun run deploy

# Deploy global commands (production)
bun run deploy -- --global

# Delete all commands
bun run deploy -- --delete

# Delete global commands
bun run deploy -- --global --delete
```

## Getting Command IDs

```typescript
import { REST, Routes } from 'discord.js';

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

// Get guild commands
const guildCommands = await rest.get(
  Routes.applicationGuildCommands(clientId, guildId)
);
console.log(guildCommands);

// Get global commands
const globalCommands = await rest.get(
  Routes.applicationCommands(clientId)
);
console.log(globalCommands);
```

## Updating Specific Commands

```typescript
// Update a specific guild command
const commandId = '1234567890123456789';
await rest.patch(
  Routes.applicationGuildCommand(clientId, guildId, commandId),
  { body: { description: 'New description' } }
);

// Delete a specific command
await rest.delete(
  Routes.applicationGuildCommand(clientId, guildId, commandId)
);
```

## Bot Intents

### Gateway Intents

```typescript
import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({
  intents: [
    // Guilds
    GatewayIntentBits.Guilds,
    
    // Members
    GatewayIntentBits.GuildMembers,  // Requires privileged intent
    
    // Moderation
    GatewayIntentBits.GuildModeration,
    
    // Messages
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMessageTyping,
    
    // Direct Messages
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
    GatewayIntentBits.DirectMessageTyping,
    
    // Voice
    GatewayIntentBits.GuildVoiceStates,
    
    // Presences
    GatewayIntentBits.GuildPresences,  // Requires privileged intent
    
    // Message content
    GatewayIntentBits.MessageContent,  // Requires privileged intent
    
    // Guild scheduled events
    GatewayIntentBits.GuildScheduledEvents,
    
    // Auto moderation
    GatewayIntentBits.AutoModerationConfiguration,
    GatewayIntentBits.AutoModerationExecution,
  ],
});
```

### Partials

```typescript
import { Client, GatewayIntentBits, Partials } from 'discord.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [
    Partials.Channel,
    Partials.GuildMember,
    Partials.Message,
    Partials.Reaction,
    Partials.User,
    Partials.ThreadMember,
    Partials.GuildScheduledEvent,
  ],
});
```

## Sharding

### Simple Sharding

```typescript
import { ShardingManager } from 'discord.js';
import { config } from 'dotenv';

config();

const manager = new ShardingManager('./dist/index.js', {
  token: process.env.DISCORD_TOKEN,
  totalShards: 'auto',
});

manager.on('shardCreate', shard => {
  console.log(`Launched shard ${shard.id}`);
});

manager.spawn();
```

### Advanced Sharding

```typescript
import { ShardingManager } from 'discord.js';
import { config } from 'dotenv';

config();

const manager = new ShardingManager('./dist/index.js', {
  token: process.env.DISCORD_TOKEN,
  totalShards: 'auto',
  shardList: 'auto',
  mode: 'process',  // or 'worker'
  respawn: true,
  timeout: 30000,
  spawnTimeout: 60000,
  shardsPerCluster: 2,
});

manager.on('shardCreate', shard => {
  console.log(`[SHARD] Launching shard ${shard.id}`);
  
  shard.on('ready', () => {
    console.log(`[SHARD] Shard ${shard.id} ready`);
  });
  
  shard.on('disconnect', () => {
    console.log(`[SHARD] Shard ${shard.id} disconnected`);
  });
  
  shard.on('reconnecting', () => {
    console.log(`[SHARD] Shard ${shard.id} reconnecting`);
  });
  
  shard.on('death', () => {
    console.log(`[SHARD] Shard ${shard.id} died`);
  });
});

(async () => {
  try {
    await manager.spawn();
    console.log('[MANAGER] All shards spawned');
  } catch (error) {
    console.error('[MANAGER] Error spawning shards:', error);
  }
})();
```

### Shard Broadcast

```typescript
// In main process
const results = await manager.broadcastEval(client => {
  return client.guilds.cache.size;
});
const totalGuilds = results.reduce((acc, count) => acc + count, 0);

// With context
const guildId = '123456789';
const result = await manager.broadcastEval(
  async (client, { guildId }) => {
    const guild = client.guilds.cache.get(guildId);
    return guild?.memberCount ?? 0;
  },
  { context: { guildId } }
);

// Fetch client property
const guildCount = await manager.fetchClientValues('guilds.cache.size');
const totalGuilds = guildCount.reduce((acc, count) => acc + (count as number), 0);
```

## Environment Setup

### Development

```env
# .env.development
DISCORD_TOKEN=your_dev_token
DISCORD_CLIENT_ID=your_dev_client_id
DISCORD_GUILD_ID=your_test_guild_id
NODE_ENV=development
LOG_LEVEL=debug
```

### Production

```env
# .env.production
DISCORD_TOKEN=your_production_token
DISCORD_CLIENT_ID=your_production_client_id
NODE_ENV=production
LOG_LEVEL=info
DATABASE_URL=your_database_url
REDIS_URL=your_redis_url
```

### Environment Validation

```typescript
import { config } from 'dotenv';

config();

const requiredEnvVars = [
  'DISCORD_TOKEN',
  'DISCORD_CLIENT_ID',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Optional with defaults
const LOG_LEVEL = process.env.LOG_LEVEL ?? 'info';
const NODE_ENV = process.env.NODE_ENV ?? 'development';
```

## Process Management

### Graceful Shutdown

```typescript
import { Client, Events } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  
  // Destroy client
  client.destroy();
  
  // Close database connections
  // await db.close();
  
  // Close other connections
  // await redis.quit();
  
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  shutdown('uncaughtException');
});
```

### Health Check

```typescript
import { createServer } from 'http';

const healthServer = createServer((req, res) => {
  if (req.url === '/health') {
    const isReady = client.isReady();
    res.writeHead(isReady ? 200 : 503);
    res.end(JSON.stringify({
      status: isReady ? 'healthy' : 'unhealthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(3000, () => {
  console.log('Health check server running on port 3000');
});
```

## Docker Deployment with Bun

### Dockerfile

```dockerfile
# Use Bun official image
FROM oven/bun:1 AS builder

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# Production stage
FROM oven/bun:1-slim AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production

COPY --from=builder /app/dist ./dist

USER bun

CMD ["bun", "dist/index.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  bot:
    build: .
    container_name: discord-bot
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./logs:/app/logs
      - ./data:/app/data
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

## PM2 Configuration

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'discord-bot',
      script: './dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
```

## Rate Limit Handling

```typescript
import { REST, Routes } from 'discord.js';

const rest = new REST({ 
  version: '10',
  timeout: 15000,
}).setToken(process.env.DISCORD_TOKEN!);

// REST events
rest.on('rateLimited', (info) => {
  console.warn(`Rate limited: ${info.method} ${info.route}`);
  console.warn(`Retry after: ${info.retryAfter}ms`);
});

rest.on('invalidRequestWarning', (info) => {
  console.warn(`Invalid requests: ${info.count} in ${info.remainingTime}ms`);
});
```

## Bun-Specific Tips

### Native TypeScript Support

Bun has native TypeScript support - no need for `tsx` or `ts-node`:

```bash
# Run TypeScript directly
bun src/index.ts

# Watch mode (hot reload)
bun --watch src/index.ts

# Run TypeScript with arguments
bun src/deploy-commands.ts --global
```

### Bun Shell for Scripts

Use Bun's shell API for running commands:

```typescript
import { $ } from 'bun';

// Run shell commands
await $`echo "Deploying commands..."`;
await $`bun run deploy`;
```

### Bun Test Runner

Use Bun's built-in test runner:

```typescript
// src/commands/ping.test.ts
import { describe, test, expect } from 'bun:test';

describe('ping command', () => {
  test('should have correct name', () => {
    const command = (await import('./ping.js')).default;
    expect(command.data.name).toBe('ping');
  });
});
```

```bash
# Run tests
bun test
```

### Bun SQLite (Optional)

Use Bun's built-in SQLite for databases:

```typescript
import { Database } from 'bun:sqlite';

const db = new Database('bot.db');

// Create table
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    xp INTEGER DEFAULT 0
  )
`);

// Query
const user = db.query('SELECT * FROM users WHERE id = ?').get(userId);
```
