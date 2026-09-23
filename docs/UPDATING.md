# Updating ΙΧΘΥΣ (Ixoye)

This guide explains how to safely update the bot and dashboard to new versions.

## Table of Contents

- [Before You Update](#before-you-update)
- [Update Methods](#update-methods)
  - [Docker (Recommended)](#docker-recommended)
  - [Manual Update](#manual-update)
  - [Using the CLI Tool](#using-the-cli-tool)
- [Database Migrations](#database-migrations)
- [Rollback Procedure](#rollback-procedure)
- [Version History](#version-history)

---

## Before You Update

### ✅ Pre-Update Checklist

- [ ] **Read the release notes** - Check for breaking changes
- [ ] **Create a backup** - Always backup before updating
- [ ] **Note your current version** - So you can downgrade if needed
- [ ] **Test in a staging environment** (if possible) - Don't update production first

### Create a Backup

```bash
# Docker
docker compose exec ixoye npm run db:backup

# Manual
npm run db:backup

# Verify backup was created
ls -lh backups/
```

---

## Update Methods

### Docker (Recommended)

#### Option 1: Using the CLI Tool (Safest)

The CLI tool automatically backs up your database, pulls the latest code, rebuilds containers, and rolls back on failure:

```bash
npm run cli -- update
```

This command:
1. Creates a database backup
2. Pulls the latest code from Git
3. Rebuilds Docker containers
4. Restarts services
5. Cleans up old Docker images
6. Rolls back automatically if anything fails

#### Option 2: Manual Docker Update

```bash
# 1. Pull latest code
git pull

# 2. Rebuild and restart containers
docker compose up -d --build

# 3. View logs to verify startup
docker compose logs -f ixoye
```

### Manual Update

For non-Docker deployments:

```bash
# 1. Create backup
npm run db:backup

# 2. Pull latest code
git pull

# 3. Install new dependencies
npm install

# 4. Run database migrations (see below)

# 5. Rebuild the bot
npm run build

# 6. Rebuild the dashboard
npm run dashboard:build

# 7. Restart services
pm2 restart all

# 8. Verify everything is working
pm2 status
```

---

## Database Migrations

### When to Run Migrations

Run database migrations when:
- Updating between versions that include schema changes
- The release notes mention database changes
- You see a prompt to run migrations

### Migration Commands

```bash
# Check for pending migrations
npm run db:generate

# Apply migrations
npm run db:migrate

# Or for Docker
docker compose exec ixoye npm run db:migrate
```

### Migration Safety

- **Always backup first** - Migrations can fail, and you need a way back
- **Review migrations before applying** - Check `drizzle/` folder for new migration files
- **Test on a copy first** - If possible, test migrations on a staging database

### If Migration Fails

1. **Don't panic** - Your data is still in the backup
2. **Check the error** - Often a simple fix (missing extension, constraint violation)
3. **Restore from backup if needed:**
   ```bash
   npm run db:restore
   ```
4. **Ask for help** - Include the error message and migration file

---

## Rollback Procedure

If an update causes problems, here's how to roll back:

### Docker Rollback

#### Option 1: Using Git (if you have previous commit)

```bash
# 1. Find the previous commit
git log --oneline -5

# 2. Reset to previous commit
git reset --hard <previous-commit-hash>

# 3. Rebuild and restart
docker compose up -d --build
```

#### Option 2: Restore Database from Backup

```bash
# List available backups
npm run db:backup:list

# Restore specific backup
npm run db:restore ./backups/ixoye-2026-01-15T12-00-00Z.dump

# Restart application
docker compose restart ixoye
```

### Manual Rollback

```bash
# 1. Stop the application
pm2 stop all

# 2. Git checkout previous version
git checkout <previous-version>

# 3. Reinstall dependencies
npm install

# 4. Rebuild
npm run build
npm run dashboard:build

# 5. Restore database if needed
npm run db:restore

# 6. Restart
pm2 restart all
```

---

## Version History

### Upgrading Between Versions

#### v0.1.x → v0.2.0

**Changes:**
- Dashboard port changed from 3000 to 4002
- CSRF protection improved (may need proxy configuration)
- Database schema updated (run migrations)

**Before updating:**
1. Backup your database
2. Update `PORT` in `.env` if you were using non-default port
3. Run `npm run db:migrate`

**After updating:**
1. Update any reverse proxy configuration for new port
2. Verify dashboard is accessible at new port
3. Re-deploy commands: `npm run deploy`

---

## Post-Update Verification

After updating, verify everything is working:

### 1. Check Service Status
```bash
# Docker
docker compose ps

# PM2
pm2 status
```

### 2. Check Logs for Errors
```bash
# Docker
docker compose logs --tail 50 ixoye

# PM2
pm2 logs --lines 50
```

### 3. Verify Bot is Online
- Check Discord: Is the bot showing as online in your server?
- Try a basic command: `/ping`

### 4. Verify Dashboard
- Access the dashboard URL
- Log in with Discord
- Check that server data is loading

### 5. Test Key Features
- Test a slash command
- Create a test event
- Verify webhooks are working (if configured)

---

## Troubleshooting Update Issues

### Issue: Update fails with "Database migration error"

**Solution:**
1. Check the specific error in logs
2. Restore from backup: `npm run db:restore`
3. Reset to previous version
4. Report the issue with the migration error

### Issue: Dashboard shows old version after update

**Solution:**
1. Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)
2. Clear browser cache
3. Restart the dashboard process
4. Check build completed successfully

### Issue: Bot commands stopped working

**Solution:**
1. Re-deploy commands: `npm run deploy`
2. Wait up to 1 hour if deployed globally
3. Check bot token is still valid

---

## Best Practices

1. **Backup regularly** - Don't just backup before updates
2. **Test updates in staging** - If you have multiple servers, test on a less critical one first
3. **Read release notes** - Breaking changes are documented
4. **Update dependencies periodically** - Run `npm update` occasionally (test first!)
5. **Monitor after updates** - Watch logs for the first hour after updating
6. **Keep backups accessible** - Know how to restore before you need to

---

## Emergency Contacts

If you encounter a critical issue after updating:

1. **Restore from backup** - Your safest option
2. **Check logs** - For specific error messages
3. **Open an issue** - Include version info and error logs
4. **Ask in community** - If there's a community channel
