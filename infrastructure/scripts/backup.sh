#!/bin/sh
set -eu
umask 077

target=${1:-}
suffix=${target#/tmp/msv_backup_}
suffix=${suffix%.dump}
case "$suffix" in *[!0-9a-f]*|'') echo 'Unsafe backup file' >&2; exit 1;; esac
if [ "${#suffix}" -ne 32 ] || [ "$target" != "/tmp/msv_backup_$suffix.dump" ]; then
    echo 'Unsafe backup file' >&2; exit 1
fi
if [ -e "$target" ]; then echo 'Backup file already exists' >&2; exit 1; fi
database=${2:-$POSTGRES_DB}
case "$database" in *[!a-zA-Z0-9_]*|'') echo 'Unsafe database name' >&2; exit 1;; esac
# Write bytes inside Linux. Windows copies the finished file without text decoding.
if ! pg_dump --username "$POSTGRES_USER" --dbname "$database" \
    --format=custom --no-owner --no-acl --file "$target"; then
    rm -f -- "$target"
    exit 1
fi
