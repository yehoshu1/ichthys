/**
 * PostgreSQL pool monitoring and metrics
 */

import { Pool } from 'pg';
import logger from '../../bot/utils/logger';

export interface PoolMetrics {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
}

// Thresholds for alerting
const ALERT_THRESHOLDS = {
    waitingConnections: 5,
    poolUtilizationPercent: 90,
    checkIntervalMs: 60000 // 1 minute
};

let monitoringInterval: NodeJS.Timeout | null = null;

/**
 * Start monitoring pool metrics
 */
export function startPoolMonitoring(pool: Pool, intervalMs: number = ALERT_THRESHOLDS.checkIntervalMs): void {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
    }

    monitoringInterval = setInterval(() => {
        const metrics: PoolMetrics = {
            totalCount: pool.totalCount,
            idleCount: pool.idleCount,
            waitingCount: pool.waitingCount,
        };

        // Log metrics (visible in development, aggregated in production)
        logger.debug('PostgreSQL pool metrics', metrics);

        // 🎯 PERFORMANCE FIX: Alert on high connection usage
        if (metrics.waitingCount >= ALERT_THRESHOLDS.waitingConnections) {
            logger.warn(
                `High pool contention detected: ${metrics.waitingCount} waiting connections`,
                metrics
            );
        }

        const utilizationPercent = (metrics.totalCount - metrics.idleCount) / pool.options.max * 100;
        if (utilizationPercent >= ALERT_THRESHOLDS.poolUtilizationPercent) {
            logger.warn(
                `Pool near capacity: ${utilizationPercent.toFixed(1)}% utilized`,
                metrics
            );
        }
    }, intervalMs);

    logger.info(`PostgreSQL pool monitoring started (interval: ${intervalMs}ms)`);
}

/**
 * Stop pool monitoring
 */
export function stopPoolMonitoring(): void {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
        logger.info('PostgreSQL pool monitoring stopped');
    }
}

/**
 * Check pool health
 */
export async function checkPoolHealth(pool: Pool): Promise<{ healthy: boolean; error?: string }> {
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        return { healthy: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Pool health check failed:', error);
        return { healthy: false, error: errorMessage };
    }
}

/**
 * Get current pool metrics
 */
export function getPoolMetrics(pool: Pool): PoolMetrics {
    return {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
    };
}

/**
 * Format pool metrics for display
 */
export function formatPoolMetrics(metrics: PoolMetrics, maxConnections: number): string {
    const activeConnections = metrics.totalCount - metrics.idleCount;
    const utilizationPercent = maxConnections > 0
        ? (activeConnections / maxConnections * 100).toFixed(1)
        : '0.0';

    return [
        `Pool Status:`,
        `  Total: ${metrics.totalCount}/${maxConnections} (${utilizationPercent}% active)`,
        `  Idle: ${metrics.idleCount}`,
        `  Waiting: ${metrics.waitingCount}`,
    ].join('\n');
}
