/**
 * Winston logger for dashboard
 * Provides structured logging with rotation
 */

import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import fs from "fs";

const isDevelopment = process.env.NODE_ENV === "development";
const logDir = path.join(process.cwd(), "logs");

// Console format for development
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp, ...metadata }) => {
        let msg = `${timestamp} ${level}: ${message}`;
        if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
        }
        return msg;
    })
);

// File format for production (JSON)
const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Create transports array
const transports: winston.transport[] = [
    // Console output
    new winston.transports.Console({
        format: isDevelopment ? consoleFormat : fileFormat,
        level: isDevelopment ? "debug" : "info",
    }),
];

// Add file transports in production
if (!isDevelopment) {
    try {
        fs.mkdirSync(logDir, { recursive: true });
        fs.accessSync(logDir, fs.constants.W_OK);

        transports.push(
            // Error log
            new DailyRotateFile({
                filename: path.join(logDir, "dashboard-error-%DATE%.log"),
                datePattern: "YYYY-MM-DD",
                zippedArchive: true,
                maxSize: "20m",
                maxFiles: "14d",
                level: "error",
                format: fileFormat,
            }),
            // Combined log
            new DailyRotateFile({
                filename: path.join(logDir, "dashboard-combined-%DATE%.log"),
                datePattern: "YYYY-MM-DD",
                zippedArchive: true,
                maxSize: "20m",
                maxFiles: "14d",
                format: fileFormat,
            })
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`Dashboard file logging disabled (cannot write to "${logDir}"): ${message}`);
    }
}

// Create the logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || "info",
    defaultMeta: {
        service: "ichthys-dashboard",
        environment: process.env.NODE_ENV || "development",
    },
    transports,
    // Exit on error: false prevents the logger from crashing the process
    exitOnError: false,
});

// Helper functions for common log patterns
export const logAPIRequest = (
    method: string,
    route: string,
    userId: string,
    guildId?: string,
    duration?: number
) => {
    logger.info("API Request", {
        method,
        route,
        userId,
        guildId,
        duration,
    });
};

export const logAPIError = (
    error: Error,
    method: string,
    route: string,
    userId?: string,
    guildId?: string
) => {
    logger.error("API Error", {
        error: error.message,
        stack: error.stack,
        method,
        route,
        userId,
        guildId,
    });
};

export const logSecurityEvent = (
    event: string,
    userId: string,
    guildId?: string,
    details?: Record<string, any>
) => {
    logger.warn("Security Event", {
        event,
        userId,
        guildId,
        ...details,
    });
};

export const logDBOperation = (
    operation: string,
    table: string,
    guildId?: string,
    duration?: number,
    error?: Error
) => {
    if (error) {
        logger.error("Database Error", {
            operation,
            table,
            guildId,
            duration,
            error: error.message,
        });
    } else {
        logger.debug("Database Operation", {
            operation,
            table,
            guildId,
            duration,
        });
    }
};

export default logger;
