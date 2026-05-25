#!/usr/bin/env bash
# Cut a release: bump the version, tag it, push, and publish a GitHub
# Release. The deploy workflow fires off the published-release event
# (skipping prereleases) and ships the build to taplist.rampant.io.
#
# Usage:
#   npm run release -- <patch|minor|major|prerelease|prepatch|preminor|premajor|x.y.z>
#
# Examples:
#   npm run release -- patch          # 1.0.0 → 1.0.1
#   npm run release -- minor          # 1.0.1 → 1.1.0
#   npm run release -- 1.0.0          # explicit; useful for the first release
#   npm run release -- prerelease     # 1.0.0 → 1.0.0-0 (won't auto-deploy)

set -euo pipefail

BUMP="${1:-}"
if [[ -z "$BUMP" ]]; then
  echo "Usage: npm run release -- <patch|minor|major|prerelease|prepatch|preminor|premajor|x.y.z>" >&2
  exit 1
fi

# --- Pre-flight checks -------------------------------------------------------

CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "Refusing to release from '$CURRENT_BRANCH'. Switch to main first." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is dirty. Commit or stash changes before releasing." >&2
  exit 1
fi

git fetch --quiet origin main
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse '@{u}')
if [[ "$LOCAL" != "$REMOTE" ]]; then
  echo "main is out of sync with origin/main. Pull (or push pending commits) before releasing." >&2
  exit 1
fi

# --- Quality gates (mirrors CI) ---------------------------------------------

echo "→ lint"
npm run lint
echo "→ tests"
npm test -- --run
echo "→ build"
npm run build

# --- Bump, tag, push, release -----------------------------------------------

echo "→ npm version $BUMP"
# `npm version` writes the new version into package.json + package-lock,
# commits it, and creates a `v<version>` tag. The output is the new tag.
TAG=$(npm version "$BUMP")

echo "→ pushing commit + tag"
git push --follow-tags origin main

# Per semver, prerelease versions carry a `-` in the version string
# (e.g. `v1.0.0-rc.1`, `v1.0.0-0`). Detecting from the resulting tag is
# more reliable than parsing the bump argument — it correctly handles
# `prerelease`/`prepatch`/`preminor`/`premajor` plus explicit prerelease
# versions like `1.0.0-rc.1`.
PRERELEASE_FLAGS=()
if [[ "$TAG" == *-* ]]; then
  PRERELEASE_FLAGS=(--prerelease)
fi

echo "→ creating GitHub Release"
gh release create "$TAG" --generate-notes --title "$TAG" "${PRERELEASE_FLAGS[@]}"

if [[ ${#PRERELEASE_FLAGS[@]} -gt 0 ]]; then
  echo "Done. $TAG published as a prerelease — deploy workflow will skip it."
else
  echo "Done. $TAG published; deploy workflow will fire on the release event."
fi
