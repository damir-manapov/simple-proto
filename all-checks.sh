#!/bin/bash
set -e

echo "=== Running check.sh ==="
./check.sh

echo "=== Running health.sh ==="
./health.sh

echo "=== All checks completed successfully ==="
