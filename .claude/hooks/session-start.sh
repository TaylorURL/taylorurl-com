#!/bin/bash
#
# Points this clone at the tracked hooks, and gives it an identity that is not
# an AI vendor.
#
# A session starts on a fresh clone. `core.hooksPath` is local config and is
# not cloned, so the hooks under `.githooks/` are inert until something points
# git at them, and the session's own git identity is `Claude
# <noreply@anthropic.com>` until something changes it. Neither is the kind of
# thing anyone remembers before the first commit — two commits reached
# `develop` under that identity before anything noticed, and a protected branch
# does not let them be taken back out.
#
# Both are one line of config, and this is the one place in the repository that
# runs before an agent session's first commit.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"

git config core.hooksPath .githooks

# The identity every commit in this repository is authored by. It is only
# written over an AI vendor's: a person who has set their own name keeps it,
# which is what makes this safe to run on any clone rather than only a fresh
# one.
AUTHOR_NAME='Trenton Taylor'
AUTHOR_EMAIL='trenton.taylor.email@gmail.com'
AI_IDENTITY='anthropic|claude|openai|codex|copilot|windsurf|devin|bard|githubcopilot|cursor\.(sh|com)'

current="$(git config user.name || true) $(git config user.email || true)"

if [ -z "${current// /}" ] || printf '%s' "$current" | grep -qiE "$AI_IDENTITY"; then
  git config user.name "$AUTHOR_NAME"
  git config user.email "$AUTHOR_EMAIL"
  echo "session-start: git identity set to $AUTHOR_NAME <$AUTHOR_EMAIL>"
fi

echo "session-start: hooks are $(git config core.hooksPath)"
