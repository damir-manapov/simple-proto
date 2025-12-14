# simple-proto

Simple prototype of the system using pnpm monorepo.

## Prerequisites

- Node.js >= 20
- pnpm >= 9

## Setup

```bash
pnpm install
```

## Scripts

- `pnpm build` - Build all packages
- `pnpm test` - Run tests in all packages
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Run ESLint with auto-fix
- `pnpm format` - Format code with Prettier
- `pnpm format:check` - Check code formatting
- `pnpm typecheck` - Run TypeScript type checking

## Quality Scripts

- `./check.sh` - Run formatting, linting, type checking, and tests
- `./health.sh` - Check for security vulnerabilities and outdated dependencies
- `./all-checks.sh` - Run both check.sh and health.sh

## Project Structure

```
packages/
  calc/       - Calculator utilities (add, subtract)
  proto/      - NestJS application prototype
  storage/    - In-memory storage with collection-based entity management
```

## Running the NestJS App

```bash
# Development mode with hot reload
pnpm --filter @simple-proto/proto start:dev

# Production build
pnpm --filter @simple-proto/proto build
pnpm --filter @simple-proto/proto start
```

## Tools Required for Health Checks

The `health.sh` script requires `gitleaks` to be installed:

```bash
# Install gitleaks (not in project root)
cd /tmp
wget https://github.com/gitleaks/gitleaks/releases/download/v8.21.2/gitleaks_8.21.2_linux_x64.tar.gz
tar -xzf gitleaks_8.21.2_linux_x64.tar.gz
sudo mv gitleaks /usr/local/bin/
rm gitleaks_8.21.2_linux_x64.tar.gz LICENSE README.md
cd -
```
