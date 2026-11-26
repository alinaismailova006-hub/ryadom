#!/bin/bash
set -euo pipefail
umask 077
project_dir="$(cd "$(dirname "$0")" && pwd)"
workspace_dir="$(cd "$project_dir/../.." && pwd)"
state_dir="$project_dir/data/mysql-local"
default_mysql="$workspace_dir/work/mysql-8.4.11-macos15-arm64"
if [[ -s "$state_dir/server-path" ]]; then
  IFS= read -r default_mysql < "$state_dir/server-path"
fi
mysql_dir="${RYADOM_MYSQL_HOME:-$default_mysql}"
port=33306
if [[ ! -x "$mysql_dir/bin/mysqld" ]]; then
  echo "Не найден MySQL: $mysql_dir" >&2
  exit 1
fi

mkdir -p "$state_dir"
if [[ ! -f "$state_dir/credentials" ]]; then
  if [[ -e "$project_dir/.env" ]]; then
    echo "В проекте уже есть .env. Автоматическая настройка оставила его без изменений." >&2
    exit 1
  fi
  printf '%s\n%s\n' "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > "$state_dir/credentials"
fi
{
  IFS= read -r root_password
  IFS= read -r app_password
} < "$state_dir/credentials"

# Use a short socket path on macOS. The directory is private to this user.
if [[ ! -s "$state_dir/socket-dir" ]]; then
  mktemp -d /tmp/ryadom-db.XXXXXXXX > "$state_dir/socket-dir"
fi
IFS= read -r socket_dir < "$state_dir/socket-dir"
if [[ ! -d "$socket_dir" ]]; then
  mktemp -d /tmp/ryadom-db.XXXXXXXX > "$state_dir/socket-dir"
  IFS= read -r socket_dir < "$state_dir/socket-dir"
fi
socket_path="$socket_dir/mysql.sock"
log_file="$state_dir/mysql.log"
data_dir="$state_dir/data"
pid_file="$state_dir/mysql.pid"

if [[ ! -d "$data_dir/mysql" ]]; then
  init_dir="$(mktemp -d "$state_dir/initialize.XXXXXXXX")"
  if ! "$mysql_dir/bin/mysqld" --no-defaults --initialize-insecure --basedir="$mysql_dir" \
    --datadir="$init_dir" --log-error="$log_file"; then
    printf 'MySQL не смог создать базу. Журнал: %s\n' "$log_file" >&2
    exit 1
  fi
  mv "$init_dir" "$data_dir"
fi

app_config="$(mktemp "$socket_dir/client.XXXXXXXX")"
bootstrap="$(mktemp "$socket_dir/bootstrap.XXXXXXXX")"
trap 'rm -f "$app_config" "$bootstrap"' EXIT
printf '[client]\nuser=ryadom\npassword=%s\nhost=127.0.0.1\nport=%s\n' "$app_password" "$port" > "$app_config"

if ! "$mysql_dir/bin/mysql" --defaults-extra-file="$app_config" --connect-timeout=2 -Nse 'SELECT 1' ryadom >/dev/null 2>&1; then
  init_args=()
  if [[ ! -f "$state_dir/provisioned" ]]; then
    cat > "$bootstrap" <<SQL
ALTER USER 'root'@'localhost' IDENTIFIED BY '$root_password';
CREATE DATABASE IF NOT EXISTS ryadom CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
CREATE USER IF NOT EXISTS 'ryadom'@'127.0.0.1' IDENTIFIED BY '$app_password';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX ON ryadom.* TO 'ryadom'@'127.0.0.1';
SQL
    init_args=("--init-file=$bootstrap")
  fi
  if ! "$mysql_dir/bin/mysqld" --no-defaults --daemonize --basedir="$mysql_dir" --datadir="$data_dir" \
    --bind-address=127.0.0.1 --port="$port" --socket="$socket_path" --pid-file="$pid_file" \
    --log-error="$log_file" --mysqlx=OFF --skip-name-resolve "${init_args[@]}"; then
    printf 'MySQL не запустился. Журнал: %s\n' "$log_file" >&2
    exit 1
  fi
  "$mysql_dir/bin/mysql" --defaults-extra-file="$app_config" --connect-timeout=4 -Nse 'SELECT 1' ryadom >/dev/null
  touch "$state_dir/provisioned"
  printf '%s\n' "$mysql_dir" > "$state_dir/server-path"
fi

if [[ ! -e "$project_dir/.env" ]]; then
  printf 'MYSQL_HOST=127.0.0.1\nMYSQL_PORT=%s\nMYSQL_USER=ryadom\nMYSQL_PASSWORD=%s\nMYSQL_DATABASE=ryadom\n' \
    "$port" "$app_password" > "$project_dir/.env"
fi

echo "MySQL готов: база ryadom на 127.0.0.1:$port."
if [[ "${1:-}" == "--app" ]]; then
  rm -f "$app_config" "$bootstrap"
  trap - EXIT
  cd "$project_dir"
  exec npm run dev
fi
