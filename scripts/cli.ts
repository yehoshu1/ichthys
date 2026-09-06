import { Command } from 'commander';
import { execSync, spawn } from 'child_process';
import { existsSync, mkdirSync, appendFileSync } from 'fs';

const program = new Command();
const LOG_FILE = 'logs/cli.log';

// Ensure logs directory exists
if (!existsSync('logs')) {
  mkdirSync('logs', { recursive: true });
}

// Logger helpers
function logInfo(msg: string) {
  console.log(msg);
  appendFileSync(LOG_FILE, `[INFO] ${new Date().toISOString()} - ${msg}\n`);
}

function logError(msg: string) {
  console.error(msg);
  appendFileSync(LOG_FILE, `[ERROR] ${new Date().toISOString()} - ${msg}\n`);
}

// Report tracking
const report = {
  command: '',
  startTime: Date.now(),
  steps: [] as { name: string; status: 'success' | 'failed' | 'skipped' }[],
  error: null as string | null,
};

function printReport() {
  const duration = ((Date.now() - report.startTime) / 1000).toFixed(1);
  const statusIcon = report.error ? '❌ FAILED' : '✅ SUCCESS';
  
  console.log('\n========================================');
  console.log('📋 IXOYE CLI REPORT');
  console.log('========================================');
  console.log(`Command: ${report.command}`);
  console.log(`Status:  ${statusIcon}`);
  console.log(`Time:    ${duration}s\n`);
  
  if (report.steps.length > 0) {
    console.log('Steps:');
    report.steps.forEach((step, idx) => {
      let icon = step.status === 'success' ? '✅' : step.status === 'failed' ? '❌' : '⏭️';
      console.log(` ${idx + 1}. ${step.name.padEnd(15)} ${icon} ${step.status}`);
    });
  }

  if (report.error) {
    console.log(`\nError Details:\n${report.error}`);
  }
  
  console.log(`\nLog saved to: ${LOG_FILE}`);
  console.log('========================================\n');
}

// Run a command asynchronously, stream output to terminal & log file, and capture errors
function runCommandAsync(name: string, command: string): Promise<void> {
  return new Promise((resolve) => {
    appendFileSync(LOG_FILE, `\n> Executing: ${command}\n`);
    
    const child = spawn(command, { shell: true });
    let outputBuffer = '';

    child.stdout.on('data', (data) => {
      process.stdout.write(data);
      appendFileSync(LOG_FILE, data);
      outputBuffer += data.toString();
    });

    child.stderr.on('data', (data) => {
      process.stderr.write(data);
      appendFileSync(LOG_FILE, data);
      outputBuffer += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        report.steps.push({ name, status: 'success' });
        resolve();
      } else {
        report.steps.push({ name, status: 'failed' });
        // Grab the last 500 characters of the output for the error report
        const tailOutput = outputBuffer.length > 500 ? '...' + outputBuffer.slice(-500) : outputBuffer;
        const errMsg = `Command failed with exit code ${code}\n--- Last Output ---\n${tailOutput.trim()}`;
        
        logError(errMsg);
        report.error = errMsg;
        printReport();
        process.exit(1);
      }
    });
  });
}

program
  .name('ixoye')
  .description('CLI to manage the Ixoye Discord Bot & Dashboard deployments, backups, and restores.')
  .version('0.1.0')
  .hook('preAction', (thisCommand) => {
    report.command = thisCommand.name();
    appendFileSync(LOG_FILE, `\n\n--- NEW RUN: ${report.command} at ${new Date().toISOString()} ---\n`);
  });

program
  .command('deploy')
  .description('Build and deploy the application (docker-compose up -d --build)')
  .action(async () => {
    logInfo('🚀 Starting deployment...');
    if (!existsSync('.env')) {
      logInfo('⚠️  Warning: .env file not found. Ensure environment variables are set.');
    }
    await runCommandAsync('Docker Build', 'docker-compose up -d --build');
    logInfo('✅ Deployment successful!');
    printReport();
  });

program
  .command('update')
  .description('Safely update the application (backup -> git pull -> build) with auto-rollback')
  .action(async () => {
    logInfo('🔄 Starting update process...');
    
    let prevCommit = '';
    try {
      prevCommit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    } catch (e) {
      logInfo('⚠️  Could not determine current git commit. Rollback may be limited.');
    }

    logInfo('\n📦 Step 1: Creating pre-update backup...');
    try {
      execSync('npm run db:backup', { stdio: 'pipe' }); // Use pipe so it doesn't interrupt standard flow if successful
      report.steps.push({ name: 'Backup', status: 'success' });
    } catch (error: any) {
      report.steps.push({ name: 'Backup', status: 'failed' });
      report.error = `Pre-update backup failed! Aborting update.\n${error.message}`;
      logError(report.error);
      printReport();
      process.exit(1);
    }

    logInfo('\n📥 Step 2: Pulling latest code...');
    await runCommandAsync('Git Pull', 'git pull');
    
    logInfo('\n🔨 Step 3: Rebuilding and restarting containers...');
    try {
      // Using execSync here to allow catch block for rollback logic, but we still want live streaming.
      // Since runCommandAsync exits the process on failure, we'll implement a custom spawn wrapper just for this step.
      await new Promise<void>((resolve, reject) => {
        const child = spawn('docker-compose up -d --build', { shell: true });
        child.stdout.on('data', (d) => { process.stdout.write(d); appendFileSync(LOG_FILE, d); });
        child.stderr.on('data', (d) => { process.stderr.write(d); appendFileSync(LOG_FILE, d); });
        child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`Exit code ${code}`)));
      });
      report.steps.push({ name: 'Rebuild', status: 'success' });
    } catch (error: any) {
      report.steps.push({ name: 'Rebuild', status: 'failed' });
      logError('\n❌ Update failed during build/start! Initiating automatic rollback...');
      if (prevCommit) {
        logInfo(`⏪ Reverting code to previous commit: ${prevCommit.substring(0, 7)}`);
        execSync(`git reset --hard ${prevCommit}`, { stdio: 'inherit' });
        logInfo('🔨 Rebuilding previous stable containers...');
        execSync('docker-compose up -d --build', { stdio: 'inherit' });
        report.steps.push({ name: 'Rollback', status: 'success' });
      }
      report.error = 'Code rollback complete. If database migrations were partially applied, you may need to restore the DB manually using: npm run cli -- restore';
      logError(report.error);
      printReport();
      process.exit(1);
    }
    
    logInfo('\n🧹 Step 4: Cleaning up old Docker images...');
    try {
      execSync('docker image prune -f', { stdio: 'pipe' });
      report.steps.push({ name: 'Cleanup', status: 'success' });
    } catch (e) {
      report.steps.push({ name: 'Cleanup', status: 'skipped' });
    }
    
    logInfo('\n✅ Update successful!');
    printReport();
  });

program
  .command('backup')
  .description('Manually trigger a database backup')
  .action(async () => {
    logInfo('📦 Triggering manual backup...');
    await runCommandAsync('DB Backup', 'npm run db:backup');
    printReport();
  });

program
  .command('restore')
  .description('Restore the database from a backup (interactive if no file provided)')
  .argument('[file]', 'Optional: Backup file name to restore (e.g. pre-restore-xxx.dump)')
  .action(async (file) => {
    logInfo('🔄 Triggering restore process...');
    const command = file ? `npm run db:restore "${file}"` : 'npm run db:restore';
    await runCommandAsync('DB Restore', command);
    printReport();
  });

program
  .command('logs')
  .description('View real-time logs from the docker containers')
  .action(async () => {
    logInfo('📄 Tailing logs (Ctrl+C to exit)...');
    await runCommandAsync('Docker Logs', 'docker-compose logs -f ixoye');
  });

program.parse(process.argv);
