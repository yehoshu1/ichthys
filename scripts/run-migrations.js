#!/usr/bin/env node

const path = require('path');
const { execSync } = require('child_process');
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { migrate } = require('drizzle-orm/node-postgres/migrator');

function buildDatabaseUrl() {
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

function getNumericEnv(name, fallback) {
    const raw = process.env[name];
    if (!raw) return fallback;

    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveSslConfig() {
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

function createBackup(databaseUrl) {
    if (process.env.NODE_ENV !== 'production') {
        console.log('Skipping backup (not in production).');
        return;
    }

    const backupDir = path.resolve(__dirname, '..', 'backups');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const dumpPath = path.join(backupDir, `pre-migrate-${ts}.dump`);

    try {
        const { mkdirSync } = require('fs');
        mkdirSync(backupDir, { recursive: true });
    } catch {
        // directory already exists
    }

    console.log(`Creating pre-migration backup: ${dumpPath}`);
    try {
        execSync(
            `pg_dump --format=custom --file="${dumpPath}" "${databaseUrl}"`,
            { stdio: 'inherit', timeout: 120_000 }
        );
        console.log('Backup created successfully.');
    } catch (error) {
        console.error('Backup failed. Aborting migration to protect production data.');
        process.exit(1);
    }
}

async function main() {
    const databaseUrl = buildDatabaseUrl();

    createBackup(databaseUrl);

    const pool = new Pool({
        connectionString: databaseUrl,
        max: getNumericEnv('PG_POOL_MAX', 8),
        idleTimeoutMillis: getNumericEnv('PG_IDLE_TIMEOUT_MS', 30_000),
        connectionTimeoutMillis: getNumericEnv('PG_CONNECT_TIMEOUT_MS', 10_000),
        query_timeout: getNumericEnv('PG_QUERY_TIMEOUT_MS', 30_000),
        statement_timeout: getNumericEnv('PG_STATEMENT_TIMEOUT_MS', 30_000),
        ssl: resolveSslConfig(),
    });

    try {
        const db = drizzle(pool);
        await migrate(db, {
            migrationsFolder: path.resolve(__dirname, '..', 'drizzle'),
        });
        console.log('Database migrations applied successfully.');
    } finally {
        await pool.end();
    }
}

main().catch((error) => {
    console.error('Database migration failed:', error);
    process.exit(1);
});
