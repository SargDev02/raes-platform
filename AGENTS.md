# RAES - Instructions for Codex

RAES is a Colombian academic credential registry and verification platform.

Before making changes, read:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/DATABASE.md`
4. `docs/API.md`
5. `docs/SECURITY.md`
6. `docs/DECISIONS.md`
7. `docs/CURRENT_STATE.md`

For significant features or refactors, create or update an execution plan following `.agent/PLANS.md`.

## Architecture rules

RAES has two conceptually separate systems:

### RAES Core

Located primarily in:

- `apps/raes-api`
- `supabase`

Responsibilities:

- central academic registry
- institutions
- persons master data
- academic programs
- academic credentials
- credential lifecycle
- institutional integrations
- audit and traceability

RAES Core is the source of truth for credentials.

### Citizen Platform

Located in:

- `apps/platform`

Responsibilities:

- citizen experience
- identity/document capture
- OCR
- credential visualization
- credential sharing
- QR/link verification flows

The Citizen Platform must never access the RAES database directly.

Communication between Platform and RAES Core must happen through the RAES API.

Never create physical foreign keys between databases belonging to RAES Core and the Citizen Platform.

## Stack

- TypeScript
- Next.js App Router
- pnpm monorepo
- Supabase/PostgreSQL
- Zod
- supabase-js
- Vercel planned for deployment

## Important implementation rules

- Use UUIDs for public/domain identifiers.
- Never expose Supabase service/secret keys to the browser.
- Never store API keys in plaintext. Store hashes.
- Do not use booleans for institution/program lifecycle status.
- Use explicit statuses.
- Preserve credential history and auditability.
- Do not hard-delete academic credentials.
- Do not hard-delete institutions when historical records depend on them.
- Do not expose public academic searches by Colombian document number.
- Public verification must eventually use controlled verification/share identifiers.
- Sensitive operations must validate ownership server-side and, where appropriate, database-side.
- Prefer transactional PostgreSQL functions for operations that modify a credential and its event history together.
- Do not weaken RLS or expose privileged database access to solve application-level errors.

## Development workflow

Before changing code:

1. inspect the existing implementation;
2. inspect current migrations/types;
3. understand the current stage in `docs/CURRENT_STATE.md`;
4. avoid recreating functionality that already exists.

After a meaningful implementation:

1. run type checking/linting;
2. run relevant tests or curl flows;
3. report exactly what changed;
4. update `docs/CURRENT_STATE.md`;
5. update architecture/decision docs if a permanent decision changed.

Do not commit after every tiny change.

Create commits around logical completed stages.

## Coding style

Prefer:

- clear TypeScript
- explicit validation
- predictable API errors
- small reusable server utilities
- typed Supabase queries
- complete files when replacing small route handlers
- comments only when they explain important domain/security reasoning

Avoid premature abstraction.

Do not refactor working code merely for style while implementing an unrelated feature.

## Security

Institutional API authentication currently uses API clients and scopes.

An institution's identity must come from the authenticated API client, not from an arbitrary `institutionId` supplied in a request body.

For example, credential creation must derive:

`institution_id <- authenticated api client`

not:

`institution_id <- request body`

Institutional clients must not be able to modify credentials belonging to another institution.

Never place actual API keys, passwords, Supabase secret keys, or `.env.local` contents in documentation, logs, commits, or examples.