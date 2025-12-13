#!/bin/bash
set -e

echo "=== Formatting code ==="
pnpm format

echo "=== Checking lint ==="
pnpm lint

echo "=== Type checking ==="
pnpm typecheck

echo "=== Running tests ==="
pnpm test

echo "=== All checks passed ==="
