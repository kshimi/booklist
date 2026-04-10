#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

op run --env-file="$ENV_FILE" -- node "$SCRIPT_DIR/generate-ai-comments.js" "$@"
