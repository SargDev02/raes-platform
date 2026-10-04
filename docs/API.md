# RAES Core API MVP

Base: `http://localhost:3001/api/v1`. See [authorization matrix](API_AUTHORIZATION_MATRIX.md) for all 29 method/path contracts.

## Authentication and responses

Send `Authorization: Bearer <key>` on every route except GET `/health`.
Administrative routes use the existing RAES admin key; integrations use hashed machine keys.

Success: `{ "data": ... }`. Collections also return `pagination: { page, limit, total, totalPages }`.
Errors: `{ "error": "ERROR_CODE", "message": "Mensaje legible" }`, optionally `details` for validation.
400 invalid request (including malformed/oversized JSON); 401 missing/invalid authentication; 403 unauthorized client/scope; 404 missing or hidden resource; 409 conflict/state; 500 internal failure. Raw SQL messages are never returned.

All collections: `page=1`, `limit=20`, maximum `limit=100`. Invalid pagination returns 400 rather than silently coercing/clamping it. Request bodies maximum 256 KiB, metadata maximum 16 KiB. Unknown identity/provenance fields are discarded and cannot override authentication.

## Credentials

POST `/credentials`: INSTITUTION + `credentials:write`.
Required: `personId`, `credentialTypeId`, `title`, `issuedAt` (YYYY-MM-DD).
Optional: `programId`, `credentialNumber`, `externalReference`, `description`, `validFrom`, `validUntil`, `documentHashSha256`, `metadata`.
Title max 500 characters; description max 4000; number/reference max 200; hash exactly 64 hexadecimal characters. RAES supplies institution, INSTITUTION_API source, API client ID and name.

GET `/credentials`: `credentials:read`. INSTITUTION always limited to its institution. A valid `institutionId` query cannot change this boundary. PLATFORM requires `personId`, otherwise 400 `PLATFORM_PERSON_FILTER_REQUIRED`.
Filters: `personId`, `programId`, `credentialTypeId`, `status` (ACTIVE/REVOKED/VOIDED), `issuedFrom`, `issuedUntil`; PLATFORM may further filter `institutionId`. No document-number lookup.

GET `/credentials/:id`: real UUID detail, `credentials:read`. Foreign institutional UUIDs return 404. PLATFORM may read a known credential UUID.
Credential reads embed institution, program, type and person `{ id, first_names, last_names }`; omit identity documents, birth date, person metadata and credential metadata.

POST `/credentials/:id/revoke` and `/void`: INSTITUTION + `credentials:revoke`, body `{ "reason": "..." }` (5–2000 characters). Actor identity comes from the authenticated client. SQL rechecks ownership and commits state/history together. Duplicate or opposite terminal-state transitions return 409. No hard DELETE or generic credential PATCH.

## Persons

GET `/persons`, GET `/persons/:id`, POST `/persons`: administrative only. General enumeration is denied to both integration types. POST preserves the existing master-creation contract and is audited.

POST `/persons/resolve`: INSTITUTION + `persons:resolve`. Required: `documentType`, `documentNumber`, `firstNames`, `lastNames`; optional `birthDate`. Document type is normalized to uppercase and must be active. Names max 200 characters; document type max 20; document number 4–30.
Returns 200 `{ "data": { "id": "UUID" } }` for both existing/new records. Composite identity is `(document_type, document_number)`. Concurrent requests converge on one ID. Existing master data is never overwritten or disclosed by resolve. Identity correction is outside this MVP; no correction endpoint is added.

## Institutions and programs

Institution POST/PATCH are administrative and audited. Required creation fields `name`, `nit`; optional `verificationDigit` (one decimal digit), `institutionType`. PATCH also accepts status ACTIVE/INACTIVE/SUSPENDED. Institution reads are admin or own institutional client, without an extra scope; PLATFORM denied.

Programs require admin or INSTITUTION with `programs:read` / `programs:write` according to method. Creation requires `name`; optional `code`, `sniesCode`, `academicLevel`. Admin must provide `institutionId`; institutional identity comes from the key even if the body includes another ID. PATCH accepts these fields and explicit status; code, SNIES and academic level can be cleared with null. Names max 200; other program strings max 100. No ownership transfer or DELETE.
List filters: status and institutionId (admin only as authority).

## Catalogs

GET `/document-types` and `/credential-types`: valid machine client, active entries only, paginated. No global catalog mutations are required or exposed in this MVP. Catalog maintenance remains an administrative database/migration operation.

## API clients

POST `/api-clients`, GET `/api-clients`, POST `/api-clients/:id/rotate`, POST `/api-clients/:id/revoke`: administrative only.
Creation: `name`, `clientType`, `scopes`, institutional `institutionId`, optional future ISO `expiresAt`.
Scopes: `credentials:read`, `credentials:write`, `credentials:revoke`, `persons:resolve`, `programs:read`, `programs:write`, `imports:read`, `imports:write`.
PLATFORM supports only credentials:read and has no institution. Institution must be active at creation.
GET filters: institutionId, status. Never returns key_hash or complete keys.
Rotate accepts no body or `{}`, keeps the same ID/scopes/expiry, changes hash/prefix and returns `apiKey` once. Revoked clients cannot rotate (409); suspended/expired clients cannot rotate (403). Revoke requires reason (5–2000), returns 409 if already revoked. Creation/rotation/revocation each writes audit atomically.

## Audit

GET `/audit-logs`: admin only. Filters: `actor` (actor_reference), `action`, `resource_type`, `resource_id` (UUID), `from`, `to` (ISO timestamps with offset). Paginated, stable ordering. No key material or master identity payload is stored in administrative audit metadata. Credential lifecycle stays in credential_events.

## Imports

POST `/credential-import-batches`: INSTITUTION + imports:write; optional `externalBatchId`, `metadata`. Creates PENDING batch with authenticated institution and client. Duplicate institutional externalBatchId returns 409.
GET collection/detail: imports:read, own institution only. Collection supports status filter.
POST `/credential-import-batches/:id/credentials`: imports:write + credentials:write; `{ "records": [<credential creation input>, ...] }`, 1–50 rows, one submission per batch.

Synchronous processing locks the batch and rechecks client/type/status/expiry/scopes/ownership in SQL. Each row uses existing create_credential in a subtransaction and associates the result to its batch. A failed row rolls back its credential and event without losing valid rows. Structural validation failures become row errors without storing original PII. Envelope/size failures return 400 before processing.
Returns `{ data: { batch, results: [{ row, id }], errors: [{ row, error }] } }`; rows are one-based. Counters and final status COMPLETED/PARTIAL/FAILED commit atomically. started_at/completed_at are populated; PROCESSING is internal to the transaction. Reprocessing or concurrent second submission returns 409. Failed batches are terminal; corrections use a new batch. Chunk larger imports into independent batches of at most 50; no external queue/resume semantics in this MVP.

See [acceptance testing](BACKEND_ACCEPTANCE_TESTING.md) for executable commands and live verification evidence.
