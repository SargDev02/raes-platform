# Complete RAES Core backend MVP

## Goal
Complete phases 0–17 from the requested mission: protected Core API, institutional isolation, controlled Platform reads, idempotent person resolution, program management, API key rotation, operational audit and bounded imports.

## Existing state
Existing credential creation/revoke/void authenticate and call transactional SQL functions. Preserve this behavior and all pre-existing working-tree changes. Baseline typecheck, lint and 44 tests pass. API-client revoke incorrectly combines machine and admin auth. Other domain reads/mutations are largely public. Supabase project raes-core is linked and available.

## Files involved
apps/raes-api route handlers, small server utilities, generated database types and test scripts; two new Supabase migrations; docs. No platform changes.

## Database impact
Add SECURITY INVOKER RPCs for person resolution, audited administrative changes/API-client rotation, and bounded import processing. Preserve existing credential RPCs and permissions. Fix null-sensitive client ownership checks without removing the transactions. Add minimal indexes for audit queries. No destructive operations.

## API impact
Credentials read requires credentials:read; PLATFORM list requires personId. Persons list/detail/create admin only, institutional persons/resolve added. Institutions admin mutation, own institutional read. Programs scoped institutional/admin access. Active catalogs authenticated. API-client rotation and audit listing admin only. Imports institutional only and paginated.

## Security considerations
All institutional ownership derived from authentication and scoped queries; RPC checks for sensitive writes. No SQL errors or key hashes in responses. Keys returned only upon create/rotate, never printed in tests. Credential responses omit person document/birth fields. Payload max 256 KiB, import max 50 rows; metadata max 16 KiB. Admin audit writes atomic with business changes. Import records each use existing create_credential within SQL exception subtransactions.

## Implementation
1. Baseline and inspection (complete).
2. Shared authorization/error/validation utilities; close existing routes.
3. Minimal RPC migration, apply reproducibly, regenerate types, advisors.
4. Rotation, audit, resolve, imports endpoints.
5. Automated regression coverage and live acceptance flow with new test data.
6. Final route matrix, docs and verification.

## Verification
pnpm --filter raes-api exec tsc --noEmit
pnpm --filter raes-api lint
node --test apps/raes-api/tests/*.test.mjs
Supabase migration inventory/types/advisors and authenticated local HTTP acceptance script.

## Result
Complete: phases 0–17 implemented and verified. Baseline 44 tests expanded to 122 passing isolated tests; typecheck/lint pass. Live final run: 133 HTTP assertions against linked Supabase, including key lifecycle, person concurrency, ownership, terminal credential states and import concurrency/partial failures. SQL verifies atomic admin/audit rollback, RPC ACLs and table privileges. Local/remote migration histories match; types regenerated; advisors only informational RLS/no-policy and unused-index findings.

Applied migrations: 20261004030126_complete_core_backend_mvp.sql and 20261004031223_isolate_invalid_import_rows.sql. The CLI created the source migrations; final filenames were aligned to versions recorded by remote MCP application. No historical migrations changed.

Detected and corrected during live verification: Next's absent POST body may be represented as an empty stream; rotate accepts empty/no body or {}, rejects malformed JSON. Failed-run generated clients were revoked; final acceptance clients were all revoked. Domain history remains intact.

Backend MVP is complete. No required manual remediation remains. Full endpoint matrix, acceptance commands, file inventory and scope boundaries: API_AUTHORIZATION_MATRIX.md, BACKEND_ACCEPTANCE_TESTING.md, BACKEND_MVP_REPORT.md. No platform work, secrets changed, commit or push.
