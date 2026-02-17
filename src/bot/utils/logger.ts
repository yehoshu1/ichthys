import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define colors for each level
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

winston.addColors(colors);

// Format for console
const consoleFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize({ all: true }),
    winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
    )
);

// Format for files (JSON)
const fileFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
);

const logDir = path.join(process.cwd(), 'logs');
const todayDate = new Date().toISOString().slice(0, 10);

function ensureWritableLogFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
        fs.accessSync(filePath, fs.constants.W_OK);
        return;
    }

    const fileHandle = fs.openSync(filePath, 'a');
    fs.closeSync(fileHandle);
}

function createRotatingFileTransport(options: DailyRotateFile.DailyRotateFileTransportOptions): DailyRotateFile {
    const transport = new DailyRotateFile(options);
    transport.on('error', (error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`File logging transport error (${options.filename}): ${message}`);
    });
    return transport;
}

const transports: winston.transport[] = [
    // Console transport
    new winston.transports.Console({
        format: consoleFormat,
    }),
];

try {
    fs.mkdirSync(logDir, { recursive: true });
    fs.accessSync(logDir, fs.constants.W_OK);
    ensureWritableLogFile(path.join(logDir, `error-${todayDate}.log`));
    ensureWritableLogFile(path.join(logDir, `combined-${todayDate}.log`));

    transports.push(
        // Error log rotation
        createRotatingFileTransport({
            filename: path.join(logDir, 'error-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            level: 'error',
            format: fileFormat,
        }),

        // Combined log rotation
        createRotatingFileTransport({
            filename: path.join(logDir, 'combined-%DATE%.log'),
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d',
            format: fileFormat,
        })
    );
} catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`File logging disabled (cannot write to "${logDir}"): ${message}`);
}

// Create the logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels,
    transports,
    exitOnError: false,
});

export default logger;
