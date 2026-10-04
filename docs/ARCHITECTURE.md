# RAES Architecture

## Monorepo

RAES uses a pnpm monorepo.

Structure:

- `apps/platform`: Citizen Platform
- `apps/raes-api`: RAES Core API
- `packages`: shared packages when justified
- `supabase`: RAES Core database migrations/configuration
- `docs`: project knowledge and decisions

## Backend

RAES API:

- Next.js App Router
- TypeScript
- Route Handlers
- Zod request validation
- Supabase JS client
- PostgreSQL/Supabase

Development port:

- platform: 3000
- RAES API: 3001

## Database access

`apps/raes-api` is server-side and uses a privileged Supabase secret.

The secret must never be exposed to browsers.

The current database access model intentionally uses RLS as defense in depth while direct anon/authenticated table access is revoked.

## Integration authentication

RAES supports machine-to-machine API clients.

Types:

- `INSTITUTION`
- `PLATFORM`

Institution API clients belong to exactly one institution.

PLATFORM clients do not belong to an institution.

Scopes currently include:

- `credentials:read`
- `credentials:write`
- `credentials:revoke`
- `persons:resolve`
- `programs:read` / `programs:write`
- `imports:read` / `imports:write`

Institutional identity is derived from the authenticated API client.

## Transaction boundaries

Operations such as:

- credential creation + CREATED event
- credential revocation + REVOKED event
- credential voiding + VOIDED event

must remain transactional.

Current PostgreSQL functions:

- `create_credential`
- `revoke_credential`
- `void_credential`

Backend MVP uses small shared authorization/validation utilities and service-role-only SECURITY INVOKER RPCs for atomic administration/audit, idempotent person resolution and bounded imports. Core/Platform separation and existing credential transaction boundaries remain unchanged. See API_AUTHORIZATION_MATRIX.md and DATABASE.md.
