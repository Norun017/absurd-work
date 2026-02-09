#!/bin/bash
# Monthly backup of discoveries.db to a private GitHub repo
# Usage: Run manually or set up as a cron job
#
# Setup:
# 1. Create a private repo on GitHub (e.g. "db-backups")
# 2. Clone it somewhere: git clone git@github.com:YOUR_USERNAME/db-backups.git /Users/nor.nrs/backups/db-backups
# 3. Update BACKUP_REPO below with the correct path
# 4. Add to cron: crontab -e
#    0 0 1 * * /Users/nor.nrs/Desktop/art-projects/every-icon-collective/server/backup-db.sh >> /tmp/db-backup.log 2>&1

set -e

# Config
DB_PATH="/Users/nor.nrs/Desktop/art-projects/every-icon-collective/server/discoveries.db"
BACKUP_REPO="/Users/nor.nrs/backups/db-backups"
DATE=$(date +%Y-%m-%d)

# Verify db exists
if [ ! -f "$DB_PATH" ]; then
  echo "[$DATE] Error: discoveries.db not found at $DB_PATH"
  exit 1
fi

# Verify backup repo exists
if [ ! -d "$BACKUP_REPO/.git" ]; then
  echo "[$DATE] Error: Backup repo not found at $BACKUP_REPO"
  echo "Run: git clone git@github.com:YOUR_USERNAME/db-backups.git $BACKUP_REPO"
  exit 1
fi

# Copy db using sqlite3 .backup for safety (handles locks)
sqlite3 "$DB_PATH" ".backup '$BACKUP_REPO/discoveries-$DATE.db'"

# Also keep a "latest" copy for convenience
cp "$BACKUP_REPO/discoveries-$DATE.db" "$BACKUP_REPO/discoveries-latest.db"

# Commit and push
cd "$BACKUP_REPO"
git add -A
git commit -m "Backup discoveries.db - $DATE" || echo "[$DATE] No changes to commit"
git push

echo "[$DATE] Backup complete"
