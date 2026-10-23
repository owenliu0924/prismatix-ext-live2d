#!/usr/bin/env bash
# Builds the PrismatiX CLI and SDK from an engine checkout (they are not on npm yet).
#   tools/build-engine-cli.sh <engine checkout>
set -euo pipefail

engine="$(cd "$1" && pwd)"
cd "$engine"
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @prismatix/authoring-sdk run build
pnpm run runtime:build
pnpm run cli:build
