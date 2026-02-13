#!/bin/bash
# check-schema-sync.sh — Compares Prisma schema columns against production DB
# Used by git pre-push hook to prevent deploying code with unmigrated schema changes.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCHEMA_FILE="$REPO_ROOT/prisma/schema.prisma"
REMOTE_HOST="root@178.156.143.87"
DB_CONTAINER="newsroom-db-1"
DB_USER="newsroom"
DB_NAME="m3newsroom"

if [ ! -f "$SCHEMA_FILE" ]; then
  echo "Schema file not found: $SCHEMA_FILE"
  exit 0
fi

# Only check when pushing to main
while read -r local_ref local_sha remote_ref remote_sha; do
  if [[ "$remote_ref" != "refs/heads/main" ]]; then
    exit 0
  fi
done

echo "Checking schema sync with production..."

# Parse schema using the companion Node.js script
EXPECTED_COLUMNS=$(node "$REPO_ROOT/scripts/parse-schema-columns.js" "$SCHEMA_FILE" 2>/dev/null)

if [ -z "$EXPECTED_COLUMNS" ]; then
  echo "Could not parse schema. Skipping check."
  exit 0
fi

# Get all tables from schema
TABLES=$(echo "$EXPECTED_COLUMNS" | cut -d: -f1 | sort -u)

# Check SSH connectivity (timeout 5s)
if ! sshpass -p 'Sh4nn1tyw3b' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 "$REMOTE_HOST" "echo ok" >/dev/null 2>&1; then
  echo "Warning: Cannot reach production server. Skipping schema check."
  exit 0
fi

MISSING=""
for TABLE in $TABLES; do
  # Get actual columns from production
  ACTUAL=$(sshpass -p 'Sh4nn1tyw3b' ssh -o StrictHostKeyChecking=no "$REMOTE_HOST" \
    "docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -t -A -c \"SELECT column_name FROM information_schema.columns WHERE table_name = '$TABLE' ORDER BY column_name\"" 2>/dev/null)

  # Check each expected column
  EXPECTED_FOR_TABLE=$(echo "$EXPECTED_COLUMNS" | grep "^${TABLE}:" | cut -d: -f2)
  for COL in $EXPECTED_FOR_TABLE; do
    if ! echo "$ACTUAL" | grep -qx "$COL"; then
      MISSING="${MISSING}  - ${TABLE}.${COL}\n"
    fi
  done
done

if [ -n "$MISSING" ]; then
  echo ""
  echo "ERROR: Production database is missing columns that exist in schema.prisma:"
  echo ""
  printf "$MISSING"
  echo ""
  echo "Run the migration SQL on production BEFORE pushing:"
  echo "  ssh $REMOTE_HOST"
  echo "  docker exec $DB_CONTAINER psql -U $DB_USER -d $DB_NAME -c \"ALTER TABLE <table> ADD COLUMN <col> <type>;\""
  echo ""
  echo "To skip this check: git push --no-verify"
  exit 1
fi

echo "Schema in sync with production."
exit 0
