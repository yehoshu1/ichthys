# Security Policy

## Reporting a Vulnerability

ΙΧΘΥΣ takes security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **Email**: Send details to the repository maintainer
2. **Do NOT open a public GitHub issue** for security vulnerabilities
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if you have one)

### What to Expect

- Acknowledgment within 48 hours
- Status update within 7 days
- Credit in release notes (if desired)

### Security Features

This project includes several security measures:

- **Webhook Security**: HMAC signature verification, HTTPS-only, SSRF protection
- **API Keys**: SHA-256 hashed storage, never exposed in responses
- **CSRF Protection**: Enabled with proxy support for Cloudflare
- **Rate Limiting**: In-memory with optional Redis backend
- **Database**: Parameterized queries via Drizzle ORM (SQL injection protected)
- **Secrets**: Webhook secrets and anonymous poll secrets encrypted with AES-256-GCM

### Environment Variables Security

Never commit your `.env` file. The following should always be set securely:

- `DISCORD_TOKEN` - Bot token from Discord Developer Portal
- `DISCORD_CLIENT_SECRET` - OAuth2 client secret
- `NEXTAUTH_SECRET` - Session encryption key (generate with `openssl rand -base64 32`)
- `WEBHOOK_SECRET_ENCRYPTION_KEY` - Minimum 16 characters for AES-256-GCM
- `ANONYMIZE_SECRET` - Minimum 16 characters for anonymous polls
- `DATABASE_URL` - Database connection string with strong password

### Security Best Practices for Self-Hosters

1. Use strong, unique passwords for PostgreSQL
2. Set `METRICS_TOKEN` to protect health endpoints in production
3. Use HTTPS for your dashboard (reverse proxy with TLS)
4. Keep Docker images and dependencies updated
5. Regularly backup your database
6. Restrict network access to PostgreSQL (don't expose port 5432 publicly)
7. Use environment variables, never hardcode secrets

### Disclosure Policy

When a vulnerability is fixed, we will:
1. Release a patched version
2. Publish a security advisory (if severity warrants)
3. Credit the reporter (unless they prefer anonymity)
