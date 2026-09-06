import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
// eslint-disable-next-line no-restricted-imports
const consoleLogger = { error: console.error.bind(console), warn: console.warn.bind(console), debug: console.debug.bind(console) };

function buildDatabaseUrl(): string {
    if (process.env.DATABASE_URL) {
        return process.env.DATABASE_URL;
    }

    const host = process.env.POSTGRES_HOST;
    const port = process.env.POSTGRES_PORT;
    const db = process.env.POSTGRES_DB;
    const user = process.env.POSTGRES_USER;
    const password = process.env.POSTGRES_PASSWORD;

    if (!host || !port || !db || !user || !password) {
        throw new Error(
            'Database configuration missing. Set DATABASE_URL or all of POSTGRES_HOST, POSTGRES_PORT, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD.'
        );
    }

    const encodedUser = encodeURIComponent(user);
    const encodedPassword = encodeURIComponent(password);

    return `postgresql://${encodedUser}:${encodedPassword}@${host}:${port}/${db}`;
}

const databaseUrl = buildDatabaseUrl();

function getNumericEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveSslConfig(): false | { rejectUnauthorized: boolean } {
    const pgSsl = process.env.PG_SSL?.toLowerCase();
    if (pgSsl === 'true') {
        return { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false' };
    }

    if (pgSsl === 'false') {
        return false;
    }

    if (process.env.NODE_ENV === 'production') {
        return { rejectUnauthorized: true };
    }

    return false;
}

export const pool = new Pool({
    connectionString: databaseUrl,
    max: getNumericEnv('PG_POOL_MAX', 8),
    idleTimeoutMillis: getNumericEnv('PG_IDLE_TIMEOUT_MS', 30_000),
    connectionTimeoutMillis: getNumericEnv('PG_CONNECT_TIMEOUT_MS', 10_000),
    query_timeout: getNumericEnv('PG_QUERY_TIMEOUT_MS', 30_000),
    statement_timeout: getNumericEnv('PG_STATEMENT_TIMEOUT_MS', 30_000),
    ssl: resolveSslConfig(),
});

pool.on('error', (error) => {
    consoleLogger.error('Unexpected PostgreSQL pool error:', error);
});

pool.on('connect', (client) => {
    client.on('error', (err) => {
        consoleLogger.error('PostgreSQL client error:', err);
    });
});

pool.on('acquire', () => {
    if (process.env.NODE_ENV === 'development') {
        const metrics = {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount
        };
        if (metrics.waiting > 0) {
            consoleLogger.warn('PostgreSQL pool contention:', metrics);
        }
    }
});

export const db = drizzle(pool, { schema });

let shutdownHookRegistered = false;

function registerShutdownHook(): void {
    if (shutdownHookRegistered) return;
    shutdownHookRegistered = true;

    const shutdown = async () => {
        await pool.end().catch((error) => {
            consoleLogger.error('Error closing PostgreSQL pool:', error);
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

export interface PoolMetrics {
    total: number;
    idle: number;
    waiting: number;
}

export async function checkPoolHealth(): Promise<{ healthy: boolean; metrics: PoolMetrics }> {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();

        return {
            healthy: true,
            metrics: getPoolMetrics()
        };
    } catch (error) {
        consoleLogger.error('Pool health check failed:', error);
        return {
            healthy: false,
            metrics: getPoolMetrics()
        };
    }
}

export function getPoolMetrics(): PoolMetrics {
    return {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
    };
}

export async function executeWithTimeout<T>(
    queryFn: () => Promise<T>,
    timeoutMs: number = 30000,
    operationName: string = 'query'
): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
            reject(new Error(`Query timeout: ${operationName} exceeded ${timeoutMs}ms`));
        }, timeoutMs);
    });

    return Promise.race([queryFn(), timeoutPromise]);
}

// Default export for convenience
export default db;
