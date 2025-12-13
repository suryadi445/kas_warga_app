#!/usr/bin/env bash
# Simple deploy helper. Requires firebase CLI and proper auth.
set -euo pipefail
PROJECT_ID=${1:-$FIREBASE_PROJECT}
if [ -z "$PROJECT_ID" ]; then
  echo "Usage: $0 <FIREBASE_PROJECT>" >&2
  exit 1
fi
npm --prefix $(dirname "$0") install --legacy-peer-deps
npx firebase deploy --only functions:dailyDashboardSummary --project "$PROJECT_ID"
