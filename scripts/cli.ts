import { Command } from 'commander';
import { execSync } from 'child_process';
import { existsSync } from 'fs';

const program = new Command();

program
  .name('ixoye')
  .description('CLI to manage the Ixoye Discord Bot & Dashboard deployments, backups, and restores.')
  .version('0.1.0');

function runCommand(command: string) {
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`\n❌ Command failed: ${command}`);
    process.exit(1);
  }
}

program
  .command('deploy')
  .description('Build and deploy the application (docker-compose up -d --build)')
  .action(() => {
    console.log('🚀 Starting deployment...');
    if (!existsSync('.env')) {
      console.warn('⚠️  Warning: .env file not found. Ensure environment variables are set.');
    }
    
    runCommand('docker-compose up -d --build');
    console.log('✅ Deployment successful!');
  });

program
  .command('update')
  .description('Safely update the application (backup -> git pull -> build)')
  .action(() => {
    console.log('🔄 Starting update process...');
    
    console.log('\n📦 Step 1: Creating pre-update backup...');
    try {
      execSync('npm run db:backup', { stdio: 'inherit' });
    } catch (error) {
      console.error('❌ Pre-update backup failed! Aborting update to prevent data loss.');
      process.exit(1);
    }

    console.log('\n📥 Step 2: Pulling latest code...');
    runCommand('git pull');
    
    console.log('\n🔨 Step 3: Rebuilding and restarting containers...');
    runCommand('docker-compose up -d --build');
    
    console.log('\n🧹 Step 4: Cleaning up old Docker images...');
    runCommand('docker image prune -f');
    
    console.log('\n✅ Update successful!');
  });

program
  .command('backup')
  .description('Manually trigger a database backup')
  .action(() => {
    console.log('📦 Triggering manual backup...');
    runCommand('npm run db:backup');
  });

program
  .command('restore')
  .description('Restore the database from a backup (interactive if no file provided)')
  .argument('[file]', 'Optional: Backup file name to restore (e.g. pre-restore-xxx.dump)')
  .action((file) => {
    console.log('🔄 Triggering restore process...');
    const command = file ? `npm run db:restore "${file}"` : 'npm run db:restore';
    runCommand(command);
  });

program
  .command('logs')
  .description('View real-time logs from the docker containers')
  .action(() => {
    console.log('📄 Tailing logs (Ctrl+C to exit)...');
    runCommand('docker-compose logs -f ixoye');
  });

program.parse(process.argv);
