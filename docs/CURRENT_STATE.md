# RAES Current Development State

Last updated: 2026-10-03 (America/Bogota)

## Backend MVP

RAES Core backend MVP implementation is complete. Core remains separate from Citizen Platform; `apps/platform` has not been changed. The complete authorization contract is in `API_AUTHORIZATION_MATRIX.md` and endpoint inputs/limits in `API.md`.

### Implemented

- Machine clients INSTITUTION/PLATFORM; hashed keys, prefix, scopes, status, expiry and last_used_at.
- Credential creation/revoke/void preserve transactional credential_events, authenticated provenance and institutional ownership. SQL additionally uses null-safe ownership/type/scope/actor checks.
- Credential list/detail require credentials:read. INSTITUTION sees its own credentials; PLATFORM list requires personId, detail accepts a known UUID. No public document lookup; responses omit holder documents/birth dates/metadata.
- Correct UUID detail handler replaces the accidental duplicated collection handler at credentials/[id]. POST creation exists only at credentials.
- Person creation/list/detail admin only. Institutional persons/resolve requires persons:resolve, resolves composite identity concurrently, returns ID only and never overwrites existing master data.
- Institution mutations admin-only and audited; institutional reads restricted to own institution.
- Program reads/writes scoped and isolated by institution; admin management audited; PLATFORM denied.
- Active document/credential catalogs require a valid machine client and are paginated; no unnecessary catalog CRUD.
- API client create/list/rotate/revoke admin only. Rotation replaces key hash/prefix on same client; complete key only at create/rotate, hash never in responses. Administrative changes and audit are atomic.
- Administrative audit listing with actor/action/resource/date filters and pagination.
- Institutional import batches use existing schema and authenticated identity. Processing requires imports:write + credentials:write, 1–50 rows, batch lock, per-row subtransactions, counters/status/timestamps and PII-free row error codes. Repeated/concurrent processing conflicts; invalid individual rows do not discard valid ones.
- All collections page default 1/limit 20/max 100; strict UUID/date/enum/pagination validation, 256 KiB body limit, 16 KiB metadata limit and bounded strings. Invalid JSON returns 400; SQL internals are not exposed.

### Automated-tested

- TypeScript typecheck passes.
- ESLint passes.
- 122 isolated real-handler/auth regression tests pass.
- New raes-api scripts: typecheck, test, test:acceptance. Root test remains its original placeholder; use the app script.

### Live-tested

- Authenticated local Next HTTP against linked Supabase project raes-core: final acceptance run passed 133 HTTP assertions and direct database-backed checks.
- Person existing/new/composite identity/no-overwrite and four concurrent resolution requests.
- Own/foreign credential and program access, controlled PLATFORM reads, provenance and both terminal credential transitions/conflicts.
- New/rotated/revoked keys, suspended/expired new fixtures, last_used_at and audited admin changes.
- COMPLETED/PARTIAL/FAILED batches, invalid structural rows, row limits, credential/batch association and concurrent batch submissions (one 200, one 409).
- Exactly four events for two lifecycle test credentials, with API_CLIENT identity; denied/duplicate transitions added no history.
- SQL rollback probe confirms administrative mutation and audit record roll back together.
- Six sensitive functions SECURITY INVOKER, service_role EXECUTE only. All ten tables retain RLS and no anon/authenticated direct read/write privileges. Composite persons_document_unique remains unchanged.
- Both new migrations applied; local/remote history matches; Supabase types regenerated. Advisors: security only 10 intentional informational RLS/no-policy findings; performance only 16 unused-index informational findings. No ERROR/WARN findings.

The final successful run includes optional-empty-body rotation validation and its regression test. A previous run exposed Next's empty request stream behavior; corrected without changing the key-rotation contract. Its five test clients were revoked, retaining academic records/history.

Final fixture marker: RAES-MVP-TEST-36869ff0-cf68-49e4-84a6-c4eaaa18d0b1. All five generated clients are revoked. No backend MVP acceptance issue remains open. Commands for independent review are in BACKEND_ACCEPTANCE_TESTING.md.

## Database migrations added in this stage

- 20261004030126_complete_core_backend_mvp.sql
- 20261004031223_isolate_invalid_import_rows.sql

No historical migration edits, new tables, RLS relaxation, SECURITY DEFINER, secret changes, commit or push. SQL functions create_credential/revoke_credential/void_credential remain transactional. New functions resolve_person/manage_core_resource/process_credential_import are also service-role-only SECURITY INVOKER.

## Acceptance artifacts

- `docs/exec-plans/complete-raes-core-backend.md`
- `docs/API_AUTHORIZATION_MATRIX.md`
- `docs/BACKEND_ACCEPTANCE_TESTING.md`
- `docs/MACHINE_AUTH_TESTING.md`
- `apps/raes-api/tests/backend-security.test.mjs`
- `apps/raes-api/tests/credential-machine-auth.test.mjs`
- `apps/raes-api/tests/backend-acceptance.mjs`

Live acceptance creates uniquely tagged RAES-MVP-TEST fixtures and revokes generated clients. Credentials/events/batches are preserved; no existing test data is deleted.

## Existing historical development IDs

These are examples only, not production dependencies:

- Institution: 3af8f334-ca83-4dda-8fab-ab3b24f56477
- Person: 727029db-58fa-4ae1-a197-46bb05e315c1
- Program: 09a9dff5-25cd-4781-af6f-7f5e1f296fb6
- DEGREE type: 3e6afac8-5bd9-479a-ae5c-8eb1ab11dbf3
- Institutional API client: dbe73d84-97fd-4422-ac72-c85bff72bf9d
- Historical REVOKED credential: 8c8e156c-1790-4cd4-ba81-7df3076d5f81

Never store plaintext API keys here.

## Outside backend MVP

Citizen authentication/identity verification, OCR, QR, sharing and public verification belong to Citizen Platform and are not implemented here. Global catalog mutation CRUD, master identity correction, generic credential updates, import queues/resume, production deployment/load testing and replacement of the prototype admin key are not part of this task.

## Next steps for apps/platform

Begin server-to-server HTTPS integration with a PLATFORM credentials:read client. Platform owns citizen authentication and server-side ownership validation; it must determine the authorized RAES personId before requesting Core data. Keep integration secrets on the Platform server, never in browser code. No direct Core database access or physical cross-database FKs. Controlled sharing/public verification remains a later citizen flow.
