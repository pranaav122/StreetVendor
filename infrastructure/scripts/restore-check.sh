#!/bin/sh
set -eu

target=${1:-}
dump=${2:-}
expected=${3:-0006_notifications}
suffix=${target#msv_restore_}
case "$suffix" in *[!0-9a-f]*|'') echo 'Unsafe restore target' >&2; exit 1;; esac
if [ "${#suffix}" -ne 32 ] || [ "$target" != "msv_restore_$suffix" ]; then
    echo 'Unsafe restore target' >&2; exit 1
fi
if [ ! -s "$dump" ]; then echo 'Backup file is missing or empty' >&2; exit 1; fi
pg_restore --list "$dump" >/dev/null

# Never reuse or overwrite an existing database. Install cleanup only AFTER this
# run successfully creates its own isolated target; a failed CREATE cannot drop it.
createdb --username "$POSTGRES_USER" --template template0 "$target"
cleanup() {
    result=$?
    trap - EXIT HUP INT TERM
    if ! dropdb --username "$POSTGRES_USER" --force "$target"; then
        echo 'Isolated restore cleanup failed; inspect the generated target' >&2
        exit 1
    fi
    exit "$result"
}
trap cleanup EXIT HUP INT TERM
pg_restore --username "$POSTGRES_USER" --dbname "$target" --single-transaction \
    --exit-on-error --no-owner --no-acl "$dump"
psql --username "$POSTGRES_USER" --dbname "$target" --no-psqlrc --quiet --tuples-only --no-align \
    --set ON_ERROR_STOP=1 --set expected="$expected" <<'SQL'
SELECT version_num = :'expected' AS revision_matches FROM public.alembic_version \gset
\if :revision_matches
\else
    \echo 'Restored migration revision does not match the expected release'
    \quit 1
\endif
SELECT json_build_object(
    'postgis', CASE WHEN PostGIS_Full_Version() LIKE '%POSTGIS%' THEN 'ok' ELSE 'invalid' END,
    'revision', (SELECT version_num FROM public.alembic_version),
    'users', (SELECT count(*) FROM public.users),
    'vendors', (SELECT count(*) FROM public.vendor_profiles),
    'visits', (SELECT count(*) FROM public.visit_requests),
    'categories', (SELECT count(*) FROM public.product_categories)
);
SQL
