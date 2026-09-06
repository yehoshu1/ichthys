import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import * as readline from 'readline';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    console.error('   Set it in .env or pass it directly:');
    console.error('   DATABASE_URL=postgresql://user:pass@host:5432/dbname npm run db:restore');
    process.exit(1);
}

const BACKUP_DIR = './backups';

interface BackupFile {
    name: string;
    path: string;
    time: number;
}

function getTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function getBackups(): BackupFile[] {
    if (!existsSync(BACKUP_DIR)) return [];

    return readdirSync(BACKUP_DIR)
        .filter((name) => name.endsWith('.dump'))
        .map((name) => ({
            name,
            path: join(BACKUP_DIR, name),
            time: statSync(join(BACKUP_DIR, name)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);
}

function askQuestion(prompt: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

function createSafetyBackup(): string {
    const safetyName = `pre-restore-${getTimestamp()}.dump`;
    const safetyPath = join(BACKUP_DIR, safetyName);
    execSync(`pg_dump --format=custom --file="${safetyPath}" "${DATABASE_URL}"`, { stdio: 'inherit' });
    return safetyName;
}

async function restoreBackup(backupName?: string): Promise<void> {
    const backups = getBackups();
    if (backups.length === 0) {
        throw new Error(`No backups found in ${BACKUP_DIR}`);
    }

    let selected = backups[0];

    if (backupName) {
        const found = backups.find((backup) => backup.name === backupName || backup.name.includes(backupName));
        if (!found) {
            console.error(`Backup not found: ${backupName}`);
            console.log('\nAvailable backups:');
            backups.forEach((backup, index) => console.log(`  ${index + 1}. ${backup.name}`));
            throw new Error('Backup not found');
        }
        selected = found;
    } else {
        console.log(`Using latest backup: ${selected.name}`);
    }

    console.log('\nWARNING: This will replace the current PostgreSQL database contents.');
    console.log(`Target DB: ${DATABASE_URL}`);
    console.log(`Backup:    ${selected.path}`);

    const answer = await askQuestion('\nType "yes" to continue: ');
    if (answer.toLowerCase() !== 'yes') {
        console.log('Restore cancelled.');
        return;
    }

    const safetyName = createSafetyBackup();
    console.log(`\nCreated safety backup: ${safetyName}`);

    execSync(
        `pg_restore --clean --if-exists --no-owner --no-privileges --dbname="${DATABASE_URL}" "${selected.path}"`,
        { stdio: 'inherit' }
    );

    console.log(`\nDatabase restored from: ${selected.name}`);
}

function listBackups(): void {
    const backups = getBackups();

    if (backups.length === 0) {
        console.log('No backups found.');
        return;
    }

    console.log('\nAvailable Backups (newest first):');
    console.log('-'.repeat(80));

    backups.forEach((backup, index) => {
        const stats = statSync(backup.path);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        const latest = index === 0 ? ' <-- latest' : '';
        console.log(`${index + 1}. ${backup.name}${latest}`);
        console.log(`   Size: ${sizeMB} MB | Date: ${stats.mtime.toISOString()}`);
    });
}

const command = process.argv[2];

(async () => {
    try {
        switch (command) {
            case 'list':
                listBackups();
                break;
            case '--help':
            case '-h':
                console.log('Usage: npm run db:restore [backup-name]');
                console.log('       npm run db:restore:list');
                console.log('If no name is provided, the latest backup is restored.');
                break;
            default:
                await restoreBackup(command);
                break;
        }
    } catch (error) {
        console.error('Restore failed:', error);
        process.exit(1);
    }
})();
