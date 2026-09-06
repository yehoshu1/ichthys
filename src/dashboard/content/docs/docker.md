---
title: "Docker Deployment"
description: "How to deploy Ixoye using Docker, Dokploy, or Coolify."
---

Ixoye is built to run flawlessly in containerized environments. A single `docker-compose.yml` file is provided that orchestrates the entire application, including the Node.js API/Dashboard, PostgreSQL database, Redis caching, and automated database backups.

## Using the Built-in CLI (Recommended)

The absolute easiest way to deploy and manage Ixoye on a VPS (like a DigitalOcean droplet or AWS EC2 instance) is using our built-in Node CLI wrapper. 

The CLI automatically handles database backups, code pulls, container rebuilding, and automatic rollbacks if a build fails.

### 1. Configure your environment
Create your `.env` file from the example:
```bash
cp .env.example .env
```
Ensure you set your domains properly so Traefik knows how to route traffic:
```bash
DOMAIN=bot.yourdomain.com
DASHBOARD_URL=https://bot.yourdomain.com
```

### 2. Deploy
Run the deployment command:
```bash
npm run cli -- deploy
```
The CLI will build the Docker images and start the services. 

### 3. Updating Safely
When there is a new update to Ixoye, simply run:
```bash
npm run cli -- update
```
This single command will:
1. Run a full PostgreSQL database backup.
2. `git pull` the latest code.
3. Rebuild and restart the Docker containers.
4. **Automatically rollback** the codebase and containers to the previous version if the build fails.

## Platform as a Service (Dokploy / Coolify)

Because Ixoye is entirely self-contained within its `docker-compose.yml` and `Dockerfile`, it is perfectly optimized for PaaS platforms like [Dokploy](https://dokploy.com/) or [Coolify](https://coolify.io/).

### Dokploy Integration
The `docker-compose.yml` file comes pre-configured with Traefik labels specifically designed for Dokploy's network.

To deploy on Dokploy:
1. Create a new **Compose** application in your Dokploy dashboard.
2. Link it to your GitHub repository.
3. In the environment variables section, paste your `.env` file.
4. Click **Deploy**. Dokploy will automatically route the domain you defined in `DOMAIN` and provision SSL certificates with zero extra setup.

### Coolify Integration
Coolify manages its own reverse proxy (Caddy/Traefik). 
To deploy on Coolify:
1. Create a new application from a GitHub repository.
2. Select **Docker Compose** as the build pack.
3. Tell Coolify that the container exposes port `4002`.
4. Type your domain name into the Coolify UI. Coolify will ignore the Traefik labels in the compose file and automatically generate its own secure proxy routing to port `4002`.

## Database Backups in Docker

Our Docker stack includes a dedicated `ichthys-pg-backup` container that automatically backs up your PostgreSQL database daily. 

If you need to manually trigger a backup or restore, use the CLI:
```bash
# Trigger a manual backup
npm run cli -- backup

# Interactively restore from a previous backup
npm run cli -- restore
```
