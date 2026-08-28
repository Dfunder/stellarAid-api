# Database Backup Strategy (#649)

## Automated Backups

### Managed PostgreSQL (recommended: Render / Railway / Neon / AWS RDS)
- Enable automated daily snapshots in your cloud dashboard
- Set retention to 7 days minimum (30 days for production)
- Enable point-in-time recovery (PITR) where available

### Self-hosted PostgreSQL
Add to cron on the database host:
```bash
# Daily backup at 02:00 UTC
0 2 * * * pg_dump "$DATABASE_URL" | gzip > /backups/stellarAid_$(date +%Y%m%d).sql.gz
# Prune backups older than 30 days
0 3 * * * find /backups -name "*.sql.gz" -mtime +30 -delete
```

## Environment Variables
| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | required |
| `BACKUP_RETENTION_DAYS` | How long to keep backups | 30 |

## Restoration
```bash
gunzip -c /backups/stellarAid_YYYYMMDD.sql.gz | psql "$DATABASE_URL"
```

## Testing
Verify restoration monthly against a staging database.
