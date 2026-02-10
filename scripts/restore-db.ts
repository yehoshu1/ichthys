/**
 * Database Restore Script
 * 
 * Restores the database from a backup file.
 * 
 * Usage:
 *   npm run db:restore [backup-file-name]
 *   or
 *   npx tsx scripts/restore-db.ts [backup-file-name]
 * 
 * If no backup file is specified, the most recent backup is used.
 */

import { existsSync, copyFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import * as readline from 'readline';

// Configuration
const DB_PATH = process.env.DATABASE_URL?.replace('file:', '') || './data/ixoye.db';
const BACKUP_DIR = './backups';

function getTimestamp(): string {
    const now = new Date();
    return now.toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, 19);
}

function getBackups(): { name: string; path: string; time: number }[] {
    if (!existsSync(BACKUP_DIR)) return [];

    return readdirSync(BACKUP_DIR)
        .filter(f => f.endsWith('.db'))
        .map(f => ({
            name: f,
            path: join(BACKUP_DIR, f),
            time: statSync(join(BACKUP_DIR, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);
}

function askQuestion(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function restoreBackup(backupName?: string): Promise<void> {
    const backups = getBackups();

    if (backups.length === 0) {
        throw new Error(`No backups found in ${BACKUP_DIR}`);
    }

    let selectedBackup: { name: string; path: string; time: number };

    if (backupName) {
        // Find specific backup
        const found = backups.find(b => b.name === backupName || b.name.includes(backupName));
        if (!found) {
            console.error(`❌ Backup not found: ${backupName}`);
            console.log('\n📋 Available backups:');
            backups.forEach((b, i) => console.log(`  ${i + 1}. ${b.name}`));
            throw new Error('Backup not found');
        }
        selectedBackup = found;
    } else {
        // Use most recent
        selectedBackup = backups[0];
        console.log(`📦 Using most recent backup: ${selectedBackup.name}`);
    }

    // Confirm with user
    console.log(`\n⚠️  WARNING: This will REPLACE the current database!`);
    console.log(`   Current DB: ${DB_PATH}`);
    console.log(`   Backup:     ${selectedBackup.path}`);
    
    const answer = await askQuestion('\nAre you sure? Type "yes" to continue: ');
    
    if (answer.toLowerCase() !== 'yes') {
        console.log('❌ Restore cancelled.');
        return;
    }

    // Create a safety backup of current state before restoring
    if (existsSync(DB_PATH)) {
        const safetyName = `pre-restore-${getTimestamp()}.db`;
        const safetyPath = join(BACKUP_DIR, safetyName);
        copyFileSync(DB_PATH, safetyPath);
        console.log(`\n💾 Created safety backup: ${safetyName}`);
    }

    // Perform restore
    copyFileSync(selectedBackup.path, DB_PATH);
    console.log(`\n✅ Database restored from: ${selectedBackup.name}`);
    console.log(`📝 Previous state saved as safety backup in ${BACKUP_DIR}`);
}

async function listBackups(): Promise<void> {
    const backups = getBackups();

    if (backups.length === 0) {
        console.log('No backups found.');
        return;
    }

    console.log('\n📋 Available Backups (newest first):');
    console.log('-'.repeat(80));
    backups.forEach((b, i) => {
        const stats = statSync(b.path);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        const marker = i === 0 ? ' <-- latest' : '';
        console.log(`${i + 1}. ${b.name}${marker}`);
        console.log(`   Size: ${sizeMB} MB | Date: ${stats.mtime.toISOString()}`);
    });
}

// Main execution
const command = process.argv[2];

(async () => {
    try {
        switch (command) {
            case 'list':
                await listBackups();
                break;
            case '--help':
            case '-h':
                console.log('Usage: npm run db:restore [backup-name]');
                console.log('       npm run db:restore:list');
                console.log('');
                console.log('If no backup name is provided, the most recent backup is used.');
                break;
            default:
                await restoreBackup(command);
                break;
        }
    } catch (error) {
        console.error('❌ Restore failed:', error);
        process.exit(1);
    }
})();
