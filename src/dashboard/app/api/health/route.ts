import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
    const startTime = Date.now();

    // Check Database
    let dbStatus = 'unknown';
    let dbLatency = -1;

    try {
        const dbStart = Date.now();
        // A simple query to check connection - count users or just select 1
        // In SQLite with Drizzle, we can try to run a raw query or just access a table
        // Drizzle's db.run(sql`SELECT 1`) is a good check
        await db.run(sql`SELECT 1`);
        dbLatency = Date.now() - dbStart;
        dbStatus = 'connected';
    } catch (error) {
        console.error('Health check DB error:', error);
        dbStatus = 'disconnected';
    }

    const uptime = process.uptime();
    const memory = process.memoryUsage();

    const status = dbStatus === 'connected' ? 'ok' : 'error';

    return NextResponse.json(
        {
            status,
            timestamp: new Date().toISOString(),
            uptime: Math.floor(uptime),
            database: {
                status: dbStatus,
                latencyMs: dbLatency
            },
            memory: {
                rss: Math.round(memory.rss / 1024 / 1024) + 'MB',
                heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + 'MB',
                heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + 'MB'
            },
            env: process.env.NODE_ENV
        },
        { status: status === 'ok' ? 200 : 503 }
    );
}
