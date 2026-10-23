#!/usr/bin/env bash
# Rebuilds what the engine's CLI generates from extension/: the Studio side's
# bundle (extension/dist/studio.js, from studio.ts) and the handler types
# (extension/prismatix-extension.d.ts, from the manifest). Both are committed,
# so a source copy of extension/ works in Studio and type-checks as it is.
#
#   tools/build-studio.sh <engine checkout, built>
#
# The CLI builds extensions inside a project, so this makes a scratch one.
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
engine="$(cd "$1" && pwd)"
cli=(node "$engine/packages/cli/dist/src/cli.js")
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

project="$work/project"
# `create` exits non-zero without a Player (DEVELOPMENT_NOTES item 18); judge it by the project file.
"${cli[@]}" create "$project" --template adv >/dev/null 2>&1 || true
[ -f "$project/prismatix.json" ] || { echo "could not create a scratch project in $project" >&2; exit 1; }
target="$project/Content/Extensions/live2d-cubism"
mkdir -p "$target"
(cd "$here/extension" && tar --exclude=node_modules --exclude=test --exclude=native --exclude=.engine -cf - .) | tar -xf - -C "$target"
node -e '
  const fs = require("fs");
  const file = process.argv[1];
  const project = JSON.parse(fs.readFileSync(file, "utf8"));
  project.extensions = ["Content/Extensions/live2d-cubism/live2d-cubism.pxextension"];
  fs.writeFileSync(file, JSON.stringify(project, null, 2));
' "$project/prismatix.json"

(cd "$project" && "${cli[@]}" extension build live2d-cubism && "${cli[@]}" extension types live2d-cubism)
mkdir -p "$here/extension/dist"
cp "$target/dist/studio.js" "$here/extension/dist/studio.js"
cp "$target/prismatix-extension.d.ts" "$here/extension/prismatix-extension.d.ts"
echo "wrote extension/dist/studio.js and extension/prismatix-extension.d.ts"
