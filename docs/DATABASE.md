# RAES Core Database

## Current tables

### institutions

Academic institutions.

Important fields include:

- id
- name
- nit
- verification_digit
- institution_type
- status
- official_code
- contact_email
- website_url
- metadata
- created_at
- updated_at

Status:

- ACTIVE
- INACTIVE
- SUSPENDED

### persons

Master person registry.

Identity uniqueness must be:

`document_type + document_number`

`document_number` must NOT be unique by itself.

### document_types

Document type catalog.

Initial examples include:

- CC
- CE
- TI
- RC
- PA
- PPT
- PEP

### programs

Academic programs belonging to institutions.

Statuses:

- ACTIVE
- INACTIVE
- SUSPENDED

### credential_types

Initial credential types:

- DEGREE
- CERTIFICATE
- COURSE
- DIPLOMA
- CONSTANCIA

### credentials

RAES academic credential source of truth.

Important concepts:

- institution
- person
- optional program
- credential type
- credential number
- external reference
- title
- issue date
- validity dates
- status
- source/provenance
- API client provenance
- document hash
- revocation/void information
- metadata
- timestamps

Statuses:

- ACTIVE
- REVOKED
- VOIDED

Do not persist NOT_FOUND as a credential status.

### credential_events

Immutable-style credential lifecycle history.

Current event types:

- CREATED
- UPDATED
- REVOKED
- VOIDED
- SYNCED

### api_clients

Machine integrations.

Important fields:

- client_type
- institution_id
- key_prefix
- key_hash
- scopes
- status
- last_used_at
- expires_at
- revoked_at
- revocation_reason

Never store the original API key.

### credential_import_batches

Tracks institutional bulk imports/synchronizations.

### audit_logs

General RAES audit trail.

## Database functions

Current transactional functions:

- `create_credential`
- `revoke_credential`
- `void_credential`

## updated_at

Database triggers manage `updated_at`.

Application code should not depend on manually setting it unless there is a specific reason.

## Access

Public schema tables have RLS enabled.

Direct `anon` / `authenticated` access is revoked.

Server-side RAES API uses privileged access.

Do not expose service-role/secret credentials.
## Backend MVP additions

Applied migrations (local filenames match remote versions):
- `20261004030126_complete_core_backend_mvp.sql`
- `20261004031223_isolate_invalid_import_rows.sql`

No new tables or cross-database foreign keys. Existing credential functions are replaced in a new migration to add null-safe institutional client comparisons, scope checks and actor validation; credential/event transaction bodies, row locks and execute privileges are retained. Historical migrations are not edited.

New SECURITY INVOKER functions:
- `resolve_person(text,text,text,text,date)`: active document-type validation; INSERT ON CONFLICT DO NOTHING followed by existing-row resolution. Composite unique constraint is preserved; existing master fields are never updated.
- `manage_core_resource(text,text,jsonb,uuid)`: explicit allowlist of institution/program/person/API-client administrative operations, atomic audit insert, client-row locks for rotate/revoke. Returns client JSON with key_hash removed; audit metadata never includes p_data.
- `process_credential_import(uuid,uuid,jsonb)`: batch-row lock, institutional client checks, max 50 records. Calls create_credential in a per-row subtransaction and sets import_batch_id atomically. Invalid structure markers produce INVALID_CREDENTIAL_DATA without storing input. One terminal submission per PENDING batch.

New index: `audit_logs_action_created_idx` on `(action, created_at desc)`. Existing FK indexes remain.

Batches reuse existing counters/status/timestamps/error_summary. error_summary is `{ "rows": [{ "row": 1, "error": "CODE" }] }`; no per-row PII table is needed. No queue, retries or resume inside a completed batch; corrections use a new batch. PROCESSING occurs within the same transaction, so external readers observe PENDING or the committed terminal result.

Generated TypeScript types were refreshed from the linked project after both migrations. Six public domain RPCs remain inaccessible to anon/authenticated and allowed for service_role. All ten tables keep RLS and revoked direct client access. Advisors contain informational RLS/no-policy findings (intentional) and unused indexes (low-volume development workload).
