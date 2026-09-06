import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    console.error('   Set it in .env or pass it directly:');
    console.error('   DATABASE_URL=postgresql://user:pass@host:5432/dbname npm run db:backup');
    process.exit(1);
}

const BACKUP_DIR = './backups';
const MAX_BACKUPS = Number(process.env.BACKUP_RETENTION_COUNT ?? 10);

function getTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function ensureDir(dir: string): void {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        console.log(`Created backup directory: ${dir}`);
    }
}

function cleanupOldBackups(): void {
    if (!existsSync(BACKUP_DIR)) return;

    const backups = readdirSync(BACKUP_DIR)
        .filter((name) => name.endsWith('.dump'))
        .map((name) => ({
            name,
            path: join(BACKUP_DIR, name),
            time: statSync(join(BACKUP_DIR, name)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time);

    if (backups.length <= MAX_BACKUPS) return;

    for (const backup of backups.slice(MAX_BACKUPS)) {
        unlinkSync(backup.path);
        console.log(`Removed old backup: ${backup.name}`);
    }
}

function createBackup(): { dbBackup: string; schemaBackup: string } {
    ensureDir(BACKUP_DIR);

    const timestamp = getTimestamp();
    const dbBackupPath = join(BACKUP_DIR, `ichthys-${timestamp}.dump`);
    const schemaBackupPath = join(BACKUP_DIR, `schema-${timestamp}.sql`);

    execSync(`pg_dump --format=custom --file="${dbBackupPath}" "${DATABASE_URL}"`, {
        stdio: 'inherit',
    });

    execSync(`pg_dump --schema-only --file="${schemaBackupPath}" "${DATABASE_URL}"`, {
        stdio: 'inherit',
    });

    const stats = statSync(dbBackupPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`Backup size: ${sizeMB} MB`);

    cleanupOldBackups();

    return { dbBackup: dbBackupPath, schemaBackup: schemaBackupPath };
}

function listBackups(): void {
    if (!existsSync(BACKUP_DIR)) {
        console.log('No backups directory found.');
        return;
    }

    const files = readdirSync(BACKUP_DIR)
        .filter((name) => name.endsWith('.dump'))
        .map((name) => {
            const path = join(BACKUP_DIR, name);
            const stats = statSync(path);
            return {
                name,
                size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
                date: stats.mtime.toISOString(),
            };
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (files.length === 0) {
        console.log('No backups found.');
        return;
    }

    console.log('\nAvailable PostgreSQL Backups:');
    console.log('-'.repeat(80));
    for (const [index, file] of files.entries()) {
        const latest = index === 0 ? ' (latest)' : '';
        console.log(`${index + 1}. ${file.name}${latest}`);
        console.log(`   Size: ${file.size} | Date: ${file.date}`);
    }
}

const command = process.argv[2];

try {
    switch (command) {
        case 'list':
            listBackups();
            break;
        case 'create':
        default: {
            console.log('Creating PostgreSQL backup...\n');
            const { dbBackup, schemaBackup } = createBackup();
            console.log('\nBackup complete!');
            console.log(`DB: ${dbBackup}`);
            console.log(`Schema: ${schemaBackup}`);
            break;
        }
    }
} catch (error) {
    console.error('Backup failed:', error);
    process.exit(1);
}
