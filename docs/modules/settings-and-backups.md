# Settings, Import/Export, and Backups

## Purpose

This module handles configuration portability and operational safety:

- Export guild configuration to JSON
- Import/restore configuration from JSON
- Database-level backup and restore scripts

## Dashboard Location

- Page: `/dashboard/[guildId]/settings`

## API Endpoints

- `GET /api/guilds/[guildId]/settings/export`
- `POST /api/guilds/[guildId]/settings/import`

## CLI Backup/Restore Commands

- `npm run db:backup`
- `npm run db:backup:list`
- `npm run db:restore`
- `npm run db:restore:list`
- `npm run deploy:safe`

## File/Script References

- `scripts/backup-db.ts`
- `scripts/restore-db.ts`
- `scripts/deploy-with-backup.sh`

## Import/Export Notes

- Import is destructive for the target guild config domain.
- Validate JSON source before import.
- Keep export snapshots in versioned storage for rollback.

## Typical Workflow

1. Export current config before risky changes.
2. Test changes.
3. If needed, re-import prior config snapshot.
4. Use DB backup scripts before schema or migration operations.

## Common Failure Modes

- Import fails validation:
- JSON shape does not match expected config payload.
- Partial restore expectations:
- Import flow is full config overwrite, not selective merge.
- Backup script failures:
- Check filesystem permissions for `backups/` and `data/`.
