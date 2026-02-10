import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://ixoye:ixoye@localhost:5432/ixoye';

export const pool = new Pool({
    connectionString: databaseUrl,
    max: Number(process.env.PG_POOL_MAX ?? 20),
    idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30_000),
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS ?? 10_000),
});

pool.on('error', (error) => {
    console.error('Unexpected PostgreSQL pool error:', error);
});

export const db = drizzle(pool, { schema });

let shutdownHookRegistered = false;

function registerShutdownHook(): void {
    if (shutdownHookRegistered) return;
    shutdownHookRegistered = true;

    const shutdown = async () => {
        await pool.end().catch((error) => {
            console.error('Error closing PostgreSQL pool:', error);
        });
    };

    process.once('SIGINT', () => {
        void shutdown().finally(() => process.exit(0));
    });

    process.once('SIGTERM', () => {
        void shutdown().finally(() => process.exit(0));
    });
}

registerShutdownHook();

export default db;
