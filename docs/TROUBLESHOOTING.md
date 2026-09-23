# Troubleshooting Guide

Common issues and solutions for ΙΧΘΥΣ (Ixoye) Discord Bot.

## Table of Contents

- [Bot Won't Start](#bot-wont-start)
- [Dashboard Issues](#dashboard-issues)
- [Database Problems](#database-problems)
- [Discord Command Issues](#discord-command-issues)
- [Permission Errors](#permission-errors)
- [Docker Issues](#docker-issues)
- [Performance Issues](#performance-issues)
- [Getting Help](#getting-help)

---

## Bot Won't Start

### Symptom: Bot crashes immediately on startup

**Check the logs:**
```bash
# Docker
docker compose logs ixoye --tail 100

# Manual
cat logs/bot.log
```

**Common causes and solutions:**

#### 1. Missing or Invalid Discord Token
```
❌ Missing required environment variables: DISCORD_TOKEN
```
**Solution:** Set `DISCORD_TOKEN` in your `.env` file. Get it from Discord Developer Portal → Your Application → Bot → Reset Token.

#### 2. Invalid Token Format
```
Error: Invalid token provided
```
**Solution:** Your token may have been reset. Generate a new one from Discord Developer Portal. **Note:** If you reset a token, the old one stops working immediately.

#### 3. Missing Required Environment Variables
```
❌ Missing required environment variables: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET
```
**Solution:** Copy `.env.example` to `.env` and fill in all required values.

#### 4. Database Connection Failed
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Solutions:**
- Ensure PostgreSQL is running
- Check `DATABASE_URL` format: `postgresql://user:password@host:port/database`
- For Docker, use `POSTGRES_HOST=postgres` (not `localhost`)

---

## Dashboard Issues

### Symptom: Can't access dashboard at http://localhost:4002

**Check if the service is running:**
```bash
# Docker
docker compose ps

# Manual
pm2 status
```

**Check logs:**
```bash
docker compose logs ixoye --tail 50
```

### Symptom: "Unauthorized" or login loop

**Solutions:**

1. **Check `NEXTAUTH_URL`** - Must match the URL you're accessing the dashboard at
   ```bash
   # If accessing via localhost:4002
   NEXTAUTH_URL=http://localhost:4002
   
   # If accessing via domain
   NEXTAUTH_URL=https://yourdomain.com
   ```

2. **Clear browser cookies** - Old session data may conflict

3. **Check OAuth redirect URI** - In Discord Developer Portal:
   - Go to OAuth2 → General
   - Ensure redirect URI matches: `https://yourdomain.com/oauth/callback`

### Symptom: Dashboard shows "No servers found"

**Cause:** You haven't authorized the bot with your Discord account yet.

**Solution:**
1. Click "Sign in with Discord" on the dashboard
2. Authorize the application
3. Ensure you've selected the servers you want to manage
4. The bot should appear in the server list

### Symptom: Dashboard API returns 401/403 errors

**Cause:** Authentication issue or insufficient permissions.

**Solutions:**
1. Re-login to the dashboard
2. Check that your Discord account has admin access to the server
3. Verify the bot is in the server and has proper permissions

---

## Database Problems

### Symptom: "Database connection error" in logs

**Check your DATABASE_URL:**
```bash
# Verify format
echo $DATABASE_URL
# Should be: postgresql://username:password@host:port/database
```

**Test the connection:**
```bash
# Docker
docker compose exec postgres pg_isready

# Manual
psql $DATABASE_URL -c "SELECT 1"
```

### Symptom: Migration fails with "column already exists"

**Cause:** Schema drift between code and database.

**Solutions:**

1. **Check current schema:**
   ```bash
   npm run db:studio
   ```

2. **For development** (resets schema - WARNING: deletes data):
   ```bash
   # Drop and recreate
   npm run db:push -- --force
   ```

3. **For production** (preserves data):
   - Review the migration file in `drizzle/`
   - Manually fix the schema issue
   - Or restore from backup and try again

### Symptom: Database full or out of disk space

**Check disk usage:**
```bash
df -h
```

**Solutions:**
1. Clean up old Docker images: `docker image prune -f`
2. Remove old database backups if not needed
3. Increase disk space if needed

---

## Discord Command Issues

### Symptom: Slash commands don't appear in Discord

**Wait time:**
- **Global commands:** Up to 1 hour to propagate
- **Guild commands:** Instant

**Solutions:**

1. **For testing**, deploy to specific guild:
   ```bash
   GUILD_ID=your_guild_id_here npm run deploy
   ```

2. **Verify command deployment:**
   ```bash
   npm run deploy:check
   ```

3. **Check bot permissions** - Ensure bot has these in your server:
   - Send Messages
   - Use Slash Commands (application commands)

### Symptom: Command returns "Unknown Application"

**Cause:** Commands deployed to wrong application or token mismatch.

**Solutions:**
1. Verify `DISCORD_CLIENT_ID` matches the application you deployed commands to
2. Re-deploy commands:
   ```bash
   npm run deploy
   ```

### Symptom: Command interaction fails with "Missing Access"

**Cause:** Bot lacks permissions to perform the action.

**Solutions:**
1. Check bot's role position in server settings (must be higher than roles it modifies)
2. Grant necessary permissions to bot:
   - Manage Roles (for role commands)
   - Kick Members / Ban Members (for moderation)
   - Manage Channels (for channel operations)

---

## Permission Errors

### Symptom: "Missing Permissions" when bot tries to act

**Common permission requirements by feature:**

| Feature | Required Permissions |
|---------|---------------------|
| Welcome messages | Send Messages, Manage Channels (optional) |
| Verification | Send Messages, Manage Roles, Kick Members |
| Boost management | Manage Roles, Send Messages |
| Leveling | Send Messages, Manage Roles (for level rewards) |
| Events | Send Messages, Create Events (via app) |
| Moderation | Kick Members, Ban Members, Manage Messages, Mute Members |
| Reaction roles | Manage Roles, Add Reactions |

**Solutions:**

1. **Check bot role hierarchy:**
   - Go to Server Settings → Roles
   - Bot's role must be higher than any role it tries to assign

2. **Grant bot permissions:**
   - Go to Server Settings → Roles → Bot Role
   - Enable all necessary permissions

3. **Check channel-specific permissions** - Bot may be blocked in specific channels

### Symptom: Bot can't send messages to specific channels

**Cause:** Channel permissions block the bot.

**Solution:**
- Go to Channel Settings → Permissions
- Ensure bot role has "Send Messages" allowed
- Check for any explicit "Deny" rules

---

## Docker Issues

### Symptom: `docker compose up` fails with "port already in use"

**Solution:**
```bash
# Find what's using port 4002
lsof -i :4002
# or
netstat -tlnp | grep 4002

# Stop the conflicting service or change PORT in .env
```

### Symptom: Container exits immediately with no logs

**Check logs:**
```bash
docker compose logs ixoye
docker compose logs postgres
docker compose logs redis
```

**Common issues:**
- Missing environment variables
- Database not ready (wait for healthcheck)
- Invalid configuration

### Symptom: PostgreSQL container won't start

**Check logs:**
```bash
docker compose logs postgres
```

**Common causes:**
- Port 5432 already in use
- Volume permission issues
- Invalid POSTGRES_PASSWORD

### Symptom: Volumes not persisting data

**Check volume configuration:**
```bash
docker volume ls
docker compose down -v  # WARNING: Deletes all data!
```

**Solutions:**
- Ensure volumes are defined in `docker-compose.yml`
- Don't use `docker compose down -v` in production (deletes data)

---

## Performance Issues

### Symptom: Bot responds slowly or times out

**Check resource usage:**
```bash
# Docker
docker stats

# System
htop
free -h
```

**Solutions:**

1. **Increase Node.js memory limit** (in `ecosystem.config.js`):
   ```javascript
   max_memory_restart: '1G'  // or higher
   ```

2. **Check database performance:**
   - Slow queries? Check PostgreSQL logs
   - Add indexes if needed
   - Consider increasing `PG_POOL_MAX` for high-traffic servers

3. **Reduce cache sizes** (in `.env`):
   ```bash
   DISCORD_MESSAGE_CACHE_LIMIT=100  # Lower if memory constrained
   CACHE_MAX_ENTRIES=500            # Lower if memory constrained
   ```

### Symptom: High memory usage

**Solutions:**

1. Check for memory leaks in logs
2. Restart the application periodically via PM2
3. Reduce in-memory cache sizes
4. Monitor with `/api/metrics` endpoint (if `METRICS_TOKEN` is set)

### Symptom: Database connection pool exhaustion

**Solutions:**

1. Increase pool size in `.env`:
   ```bash
   PG_POOL_MAX=16  # Default is 8, increase for busy servers
   ```

2. Check for slow queries holding connections
3. Ensure application is properly closing connections

---

## Getting Help

### Before asking for help

Please gather the following information:

1. **What are you trying to do?**
2. **What happened instead?**
3. **What do the logs say?** (`docker compose logs` or check `logs/` folder)
4. **What version are you running?** (Check `package.json` version)
5. **How are you running it?** (Docker, manual, PM2, etc.)
6. **Relevant environment variables** (hide secrets!)

### Where to get help

1. **Check documentation first** - Many issues are covered in these docs
2. **Search existing issues** - Your problem may already be reported
3. **Open a new issue** - Include all the information above

### Log Locations

| Deployment Type | Log Location |
|----------------|--------------|
| Docker | `docker compose logs ixoye` |
| PM2 | `~/.pm2/logs/` or configured log path |
| Manual | `logs/` directory in project folder |

---

## Quick Diagnostic Commands

```bash
# Check everything is running
docker compose ps

# View recent logs
docker compose logs --tail 100

# Test database connection
docker compose exec postgres pg_isready

# Check disk space
df -h

# Check memory usage
free -h

# Verify environment variables are set (hide secrets!)
env | grep -E "^(DISCORD|NEXTAUTH|DATABASE|PORT)" | sed 's/=.*/=.../'
```
