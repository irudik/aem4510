#!/bin/bash
# Save a context snapshot to the session log before compaction
# Helps preserve key decisions when auto-compression triggers
# Fail open if jq is not installed
command -v jq >/dev/null 2>&1 || exit 0

INPUT=$(cat)
TRIGGER=$(echo "$INPUT" | jq -r '.trigger // "unknown"')

# Get the project directory from the hook's JSON payload
PROJECT_DIR=$(echo "$INPUT" | jq -r '.cwd // empty')
[ -z "$PROJECT_DIR" ] && exit 0

# Find most recent session log
LOG_DIR="$PROJECT_DIR/quality_reports/session_logs"
LATEST_LOG=$(ls -t "$LOG_DIR"/*.md 2>/dev/null | head -1)

if [ -n "$LATEST_LOG" ]; then
  {
    echo ""
    echo "---"
    echo "**Context compaction ($TRIGGER) at $(date '+%H:%M')**"
    echo "Check git log and quality_reports/plans/ for current state."
  } >> "$LATEST_LOG"
fi

exit 0
