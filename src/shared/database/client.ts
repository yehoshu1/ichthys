import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://ixoye:ixoye@localhost:5432/ixoye';

function getNumericEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const pool = new Pool({
    connectionString: databaseUrl,
    max: getNumericEnv('PG_POOL_MAX', 8),
    idleTimeoutMillis: getNumericEnv('PG_IDLE_TIMEOUT_MS', 30_000),
    connectionTimeoutMillis: getNumericEnv('PG_CONNECT_TIMEOUT_MS', 10_000),
    // 🎯 PERFORMANCE FIX: Add query and statement timeouts to prevent hanging queries
    query_timeout: getNumericEnv('PG_QUERY_TIMEOUT_MS', 30_000),
    statement_timeout: getNumericEnv('PG_STATEMENT_TIMEOUT_MS', 30_000),
    ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: true }
        : process.env.PG_SSL === 'true'
            ? { rejectUnauthorized: process.env.PG_SSL_REJECT_UNAUTHORIZED !== 'false' }
            : false,
});

// 🎯 PERFORMANCE FIX: Add connection validation and error handling
pool.on('error', (error) => {
    console.error('Unexpected PostgreSQL pool error:', error);
});

pool.on('connect', (client) => {
    client.on('error', (err) => {
        console.error('PostgreSQL client error:', err);
    });
});

pool.on('acquire', () => {
    // Track connection acquisition for monitoring
    if (process.env.NODE_ENV === 'development') {
        const metrics = {
            total: pool.totalCount,
            idle: pool.idleCount,
            waiting: pool.waitingCount
        };
        // Log if pool is under pressure
        if (metrics.waiting > 0) {
            console.warn('PostgreSQL pool contention:', metrics);
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

// 🎯 PERFORMANCE FIX: Pool health check function
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
        console.error('Pool health check failed:', error);
        return {
            healthy: false,
            metrics: getPoolMetrics()
        };
    }
}

// 🎯 PERFORMANCE FIX: Pool metrics for monitoring
export interface PoolMetrics {
    total: number;
    idle: number;
    waiting: number;
}

export function getPoolMetrics(): PoolMetrics {
    return {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
    };
}

// 🎯 PERFORMANCE FIX: Query wrapper with timeout and logging
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
