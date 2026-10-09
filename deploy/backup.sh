#!/usr/bin/env bash
# Nightly PostgreSQL backup for the FitIt VM.
#
#   - pg_dump (custom format, compressed) from the running "db" container into BACKUP_DIR, one dated file per run
#   - the file is checked with pg_restore --list before it is accepted
#   - local files older than BACKUP_KEEP_DAYS are deleted
#   - optional copy to an R2 bucket (BACKUP_R2_*), optional ping of a monitoring URL (BACKUP_PING_URL)
#   - exits non-zero on any failure, so cron output and the monitoring URL show it
#
# Settings come from the environment first, then from the env file (FITIT_ENV_FILE, default /etc/fitit/fitit.env).
# Photos are not part of this backup: they live in R2, not in the database.
# Run it by hand with: deploy/backup.sh
set -euo pipefail
umask 077

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
compose_file=${FITIT_COMPOSE_FILE:-$script_dir/compose.yml}
env_file=${FITIT_ENV_FILE:-/etc/fitit/fitit.env}

log() {
  printf '%s backup: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"
}

if [ ! -r "$env_file" ]; then
  log "cannot read env file $env_file"
  exit 1
fi

# setting NAME [DEFAULT]: value from the process environment, else from the env file, else DEFAULT.
# The env file is only read, never executed.
setting() {
  local name=$1 default=${2-} line value
  if [ -n "${!name:-}" ]; then
    printf '%s' "${!name}"
    return
  fi
  line=$(grep -E "^${name}=" "$env_file" | tail -n 1 || true)
  value=${line#*=}
  if [ -z "$line" ] || [ -z "$value" ]; then
    value=$default
  fi
  printf '%s' "$value"
}

dc() {
  docker compose --env-file "$env_file" -f "$compose_file" "$@"
}

ping_monitor() {
  local suffix=${1-} url
  url=$(setting BACKUP_PING_URL)
  if [ -n "$url" ]; then
    curl -fsS -m 10 --retry 2 -o /dev/null "${url%/}${suffix}" || log "could not reach the monitoring URL"
  fi
}

partial=""
cleanup() {
  local code=$?
  if [ -n "$partial" ]; then
    rm -f -- "$partial"
  fi
  if [ "$code" -ne 0 ]; then
    log "FAILED with exit code $code"
    ping_monitor /fail
  fi
  exit "$code"
}
trap cleanup EXIT

backup_dir=$(setting BACKUP_DIR /var/backups/fitit)
keep_days=$(setting BACKUP_KEEP_DAYS 14)
case "$keep_days" in
  '' | *[!0-9]*)
    log "BACKUP_KEEP_DAYS must be a whole number, got '$keep_days'"
    exit 1
    ;;
esac

mkdir -p "$backup_dir"
if ! command -v flock >/dev/null 2>&1; then
  log "flock is not installed (util-linux)"
  exit 1
fi
exec 9>"$backup_dir/.lock"
if ! flock -n 9; then
  log "another backup is already running"
  exit 1
fi

stamp=$(date -u +%Y%m%d-%H%M%SZ)
target="$backup_dir/fitit-$stamp.dump"
partial="$target.partial"

log "dumping the database to $target"
# The database user and name come from the container's own environment; the local socket needs no password.
dc exec -T db sh -c 'exec pg_dump --format=custom --compress=6 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"' >"$partial"

if [ ! -s "$partial" ]; then
  log "the dump is empty"
  exit 1
fi
if ! dc exec -T db pg_restore --list <"$partial" >/dev/null; then
  log "the dump does not pass pg_restore --list"
  exit 1
fi
mv -- "$partial" "$target"
partial=""
log "dump ok: $(du -h "$target" | cut -f1)"

deleted=$(find "$backup_dir" -maxdepth 1 -type f -name 'fitit-*.dump' -mtime +"$keep_days" -print -delete | wc -l)
log "removed $deleted local dump(s) older than $keep_days days"

bucket=$(setting BACKUP_R2_BUCKET)
if [ -n "$bucket" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    log "BACKUP_R2_BUCKET is set but rclone is not installed (apt install rclone)"
    exit 1
  fi
  endpoint=$(setting BACKUP_R2_ENDPOINT)
  access_key=$(setting BACKUP_R2_ACCESS_KEY)
  secret_key=$(setting BACKUP_R2_SECRET_KEY)
  if [ -z "$endpoint" ] || [ -z "$access_key" ] || [ -z "$secret_key" ]; then
    log "BACKUP_R2_BUCKET is set, but BACKUP_R2_ENDPOINT, BACKUP_R2_ACCESS_KEY or BACKUP_R2_SECRET_KEY is empty"
    exit 1
  fi
  prefix=$(setting BACKUP_R2_PREFIX db/)
  log "uploading to r2:$bucket/$prefix"
  # rclone's connection-string remote ":s3:" configured through the environment, so no secret appears in the process list.
  RCLONE_S3_PROVIDER=Cloudflare \
    RCLONE_S3_ENDPOINT="$endpoint" \
    RCLONE_S3_ACCESS_KEY_ID="$access_key" \
    RCLONE_S3_SECRET_ACCESS_KEY="$secret_key" \
    RCLONE_S3_NO_CHECK_BUCKET=true \
    rclone copyto "$target" ":s3:$bucket/$prefix$(basename "$target")"
  log "upload ok"
fi

log "done"
ping_monitor
