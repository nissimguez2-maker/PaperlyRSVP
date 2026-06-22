#!/usr/bin/env bash
# Package the block theme into an installable zip for WordPress
# (Appearance → Themes → Add New → Upload Theme).
#
# Usage:  bash wordpress/scripts/make-theme-zip.sh
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # the wordpress/ dir
theme="paperly-weddings"
out="$here/$theme.zip"

cd "$here"
rm -f "$out"

# Exclude OS cruft; include everything the theme needs.
zip -r -q "$out" "$theme" \
  -x "*.DS_Store" -x "__MACOSX/*" -x "*/.*"

echo "Built $out"
unzip -l "$out" | tail -n +2 | head -n 40
