#!/bin/bash
set -e

echo "=== Checking for secrets with gitleaks ==="
gitleaks detect --source . -v

echo "=== Checking for outdated dependencies ==="
OUTDATED=$(pnpm outdated 2>&1 || true)
if echo "$OUTDATED" | grep -qE "^│"; then
  echo "$OUTDATED"
  echo "ERROR: Outdated dependencies found"
  exit 1
fi
echo "All dependencies are up to date"

echo "=== Checking for vulnerabilities ==="
pnpm audit

echo "=== Health check passed ==="
