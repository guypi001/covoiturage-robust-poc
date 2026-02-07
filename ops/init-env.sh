#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ensure_env_file() {
  local target="$1"
  local example="${target}.example"

  if [[ -f "$target" ]]; then
    return 0
  fi

  if [[ -f "$example" ]]; then
    cp "$example" "$target"
    echo "Created $target from $example"
  else
    : > "$target"
    echo "Created empty $target"
  fi
}

ensure_env_file ".env"
ensure_env_file "services/bff/.env"
ensure_env_file "services/identity/.env"
ensure_env_file "services/ride/.env"
ensure_env_file "services/search/.env"
ensure_env_file "services/booking/.env"
ensure_env_file "services/payment/.env"
ensure_env_file "services/wallet/.env"
ensure_env_file "services/payouts/.env"
ensure_env_file "services/notification/.env"
ensure_env_file "services/messaging/.env"
ensure_env_file "services/config/.env"
