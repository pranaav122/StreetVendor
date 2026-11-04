#!/bin/sh
set -eu

# psql variables quote identifiers/literals, including passwords containing SQL
# punctuation. Never enable shell tracing or echo this environment.
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --no-psqlrc --set ON_ERROR_STOP=1 <<'SQL'
\getenv database POSTGRES_DB
\getenv migration_password MIGRATION_PASSWORD
\getenv runtime_password RUNTIME_PASSWORD
SELECT 'CREATE ROLE msv_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='msv_migrator') \gexec
SELECT 'CREATE ROLE msv_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='msv_runtime') \gexec
ALTER ROLE msv_migrator PASSWORD :'migration_password';
ALTER ROLE msv_runtime PASSWORD :'runtime_password';
CREATE EXTENSION IF NOT EXISTS postgis;
REVOKE ALL ON DATABASE :"database" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"database" TO msv_migrator, msv_runtime;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO msv_migrator;
GRANT USAGE ON SCHEMA public TO msv_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE msv_migrator IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO msv_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE msv_migrator IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO msv_runtime;
SQL
