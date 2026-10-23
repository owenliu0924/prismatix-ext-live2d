#!/usr/bin/env bash
# Validates the extension in a scratch project, packs it into .pxext files with
# the engine's CLI, and proves the result installs into a second project.
#
#   tools/package.sh <engine checkout, built> <signing key .pem> <output folder>
#
# Needs a library for every platform you want in the package in
# extension/native/<platform>/ (CI gathers them; locally you have your own).
# PX_OWNER sets the package owner (default owenliu0924).
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
engine="$(cd "$1" && pwd)"
key="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"
out="$3"
owner="${PX_OWNER:-owenliu0924}"
cli=(node "$engine/packages/cli/dist/src/cli.js")
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

new_project() {
  # `create` writes the project, then looks for a Player and exits non-zero when
  # there is none (DEVELOPMENT_NOTES item 18), so judge it by the project file.
  "${cli[@]}" create "$1" --template adv >/dev/null 2>&1 || true
  [ -f "$1/prismatix.json" ] || { echo "could not create a scratch project in $1" >&2; exit 1; }
}

echo "== scratch project with the extension"
project="$work/project"
new_project "$project"
mkdir -p "$project/Content/Extensions/live2d-cubism"
(cd "$here/extension" && tar --exclude=node_modules --exclude=test --exclude=tsconfig.check.json --exclude=.engine -cf - .) |
  tar -xf - -C "$project/Content/Extensions/live2d-cubism"
node -e '
  const fs = require("fs");
  const file = process.argv[1];
  const project = JSON.parse(fs.readFileSync(file, "utf8"));
  project.extensions = ["Content/Extensions/live2d-cubism/live2d-cubism.pxextension"];
  fs.writeFileSync(file, JSON.stringify(project, null, 2));
' "$project/prismatix.json"

echo "== libraries that will be packed"
find "$project/Content/Extensions/live2d-cubism/native" -type f | sed "s#$project/##" | sort

echo "== validate"
(cd "$project" && "${cli[@]}" validate .)

echo "== pack"
(cd "$project" && "${cli[@]}" extension pack live2d-cubism --owner "$owner" --signing-key "$key")
mkdir -p "$out"
cp "$project"/dist/extensions/*.pxext "$out"/

echo "== install into a second project"
second="$work/second"
new_project "$second"
main="$(ls "$out"/"$owner"-live2d-cubism-*.pxext | grep -v -- '-native-' | head -1)"
(cd "$second" && "${cli[@]}" extension inspect "$main" &&
  "${cli[@]}" extension add "$main" --allow-native --yes &&
  "${cli[@]}" extension verify &&
  "${cli[@]}" validate .)
echo "== packed:"
ls -l "$out"
