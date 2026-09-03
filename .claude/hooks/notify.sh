#!/bin/bash
# macOS desktop notification when Claude needs attention
# Triggers on: permission prompts, idle prompts, auth events
# Fails open on non-macOS or missing dependencies

command -v jq >/dev/null 2>&1 || exit 0
command -v osascript >/dev/null 2>&1 || exit 0

INPUT=$(cat)
MESSAGE=$(echo "$INPUT" | jq -r '.message // "Claude needs attention"' | sed 's/[\"\\]/\\&/g')
TITLE=$(echo "$INPUT" | jq -r '.title // "Claude Code"' | sed 's/[\"\\]/\\&/g')
osascript -e "display notification \"$MESSAGE\" with title \"$TITLE\"" 2>/dev/null
exit 0
