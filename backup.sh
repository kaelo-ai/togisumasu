#!/bin/sh
# Back up the Togisumasu database from the running container into ./backups (keeps the last 14).
# Schedule it daily with cron:  15 2 * * *  cd /opt/togisumasu && ./backup.sh >> backups/backup.log 2>&1
set -e
cd "$(dirname "$0")"
mkdir -p backups
STAMP=$(date +%F-%H%M)
docker exec togisumasu sh -c "rm -f /data/backup.sqlite && node --no-warnings -e \"new (require('node:sqlite').DatabaseSync)('/data/togisumasu.sqlite').exec(\\\"VACUUM INTO '/data/backup.sqlite'\\\")\""
docker cp togisumasu:/data/backup.sqlite "backups/togisumasu-$STAMP.sqlite"
docker exec togisumasu rm -f /data/backup.sqlite
ls -1t backups/togisumasu-*.sqlite | tail -n +15 | xargs -r rm --
echo "Saved backups/togisumasu-$STAMP.sqlite"
