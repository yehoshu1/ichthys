/**
 * Database Backup Script
 * 
 * Creates a timestamped backup of the SQLite database before deployments.
 * Run this before applying any schema changes to prevent data loss.
 * 
 * Usage:
 *   npm run db:backup
 *   or
 *   npx tsx scripts/backup-db.ts
 */

import { existsSync, copyFileSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

// Configuration
const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') || './data/ixoye.db';
const BACKUP_DIR = './backups';
const MAX_BACKUPS = 10; // Keep only last 10 backups

function getTimestamp(): string {
    const now = new Date();
    return now.toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19); // YYYY-MM-DDTHH-MM-SS
}

function ensureDir(dir: string): void {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        console.log(`📁 Created backup directory: ${dir}`);
    }
}

function cleanupOldBackups(): void {
    if (!existsSync(BACKUP_DIR)) return;

    const files = readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.db') || f.endsWith('.sql'))
        .map(f => ({
            name: f,
            path: join(BACKUP_DIR, f),
            time: statSync(join(BACKUP_DIR, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time); // Newest first

    // Remove old backups beyond MAX_BACKUPS
    const dbBackups = files.filter(f => f.name.endsWith('.db'));
    if (dbBackups.length > MAX_BACKUPS) {
        const toDelete = dbBackups.slice(MAX_BACKUPS);
        for (const file of toDelete) {
            unlinkSync(file.path);
            console.log(`🗑️  Removed old backup: ${file.name}`);
        }
    }
}

function createBackup(): { dbBackup: string; schemaBackup: string } {
    ensureDir(BACKUP_DIR);

    const timestamp = getTimestamp();
    const dbBackupName = `ixoye-${timestamp}.db`;
    const schemaBackupName = `schema-${timestamp}.sql`;
    const dbBackupPath = join(BACKUP_DIR, dbBackupName);
    const schemaBackupPath = join(BACKUP_DIR, schemaBackupName);

    // Check if database exists
    if (!existsSync(DB_PATH)) {
        throw new Error(`Database not found at: ${DB_PATH}`);
    }

    // Copy database file
    copyFileSync(DB_PATH, dbBackupPath);
    console.log(`✅ Database backed up: ${dbBackupName}`);

    // Dump schema using sqlite3
    try {
        execSync(`sqlite3 "${DB_PATH}" .schema > "${schemaBackupPath}"`);
        console.log(`✅ Schema dumped: ${schemaBackupName}`);
    } catch (error) {
        console.warn(`⚠️  Could not dump schema: ${error}`);
    }

    // Get database stats
    const stats = statSync(DB_PATH);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`📊 Database size: ${sizeMB} MB`);

    // Cleanup old backups
    cleanupOldBackups();

    return { dbBackup: dbBackupPath, schemaBackup: schemaBackupPath };
}

function listBackups(): void {
    if (!existsSync(BACKUP_DIR)) {
        console.log('No backups directory found.');
        return;
    }

    const files = readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.db'))
        .map(f => {
            const path = join(BACKUP_DIR, f);
            const stats = statSync(path);
            return {
                name: f,
                size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
                date: stats.mtime.toISOString(),
            };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (files.length === 0) {
        console.log('No backups found.');
        return;
    }

    console.log('\n📋 Available Backups:');
    console.log('-'.repeat(80));
    files.forEach((f, i) => {
        const marker = i === 0 ? ' (latest)' : '';
        console.log(`${i + 1}. ${f.name}${marker}`);
        console.log(`   Size: ${f.size} | Date: ${f.date}`);
    });
}

// Main execution
const command = process.argv[2];

try {
    switch (command) {
        case 'list':
            listBackups();
            break;
        case 'create':
        default:
            console.log('🔒 Creating database backup...\n');
            const { dbBackup, schemaBackup } = createBackup();
            console.log(`\n💾 Backup complete!`);
            console.log(`   DB: ${dbBackup}`);
            console.log(`   Schema: ${schemaBackup}`);
            console.log(`\n📝 To restore: cp ${dbBackup} ${DB_PATH}`);
            break;
    }
} catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
}
