# RAES Architecture Decisions

## ADR-001 - RAES Core and Citizen Platform are separate systems

Decision:

Keep RAES Core and Citizen Platform logically and physically separated.

Reason:

RAES is the authoritative academic registry while the Platform is a consumer/user-facing application.

## ADR-002 - No cross-database physical foreign keys

Decision:

No physical foreign keys between the RAES database and Citizen Platform database.

Use external RAES IDs and APIs.

## ADR-003 - Composite document identity

Decision:

A person is uniquely identified in RAES by:

`document_type + document_number`

Do not make document_number globally unique by itself.

## ADR-004 - Explicit lifecycle states

Decision:

Avoid booleans such as `is_active` for domain lifecycle.

Use explicit states.

## ADR-005 - Credentials retain history

Decision:

Credentials use ACTIVE / REVOKED / VOIDED and retain lifecycle events.

Do not hard-delete normal historical credentials.

## ADR-006 - API keys stored as hashes

Decision:

Machine credentials are stored as cryptographic hashes.

Original API keys are not persisted.

## ADR-007 - Institutional identity comes from authentication

Decision:

Institutional requests do not control `institution_id`.

RAES derives institution identity from the authenticated machine client.

## ADR-008 - Critical credential operations are transactional

Decision:

Credential creation/revocation/voiding plus history-event creation occur in PostgreSQL functions so both operations succeed or fail together.
## ADR-009 - Controlled Platform credential reads

PLATFORM collection reads require personId plus credentials:read; detail reads require a known UUID. No national credential/person enumeration or document-number lookup. Credential read responses expose holder ID/names without document or birth information. Citizen identity/ownership validation belongs to future Platform server integration.

## ADR-010 - Idempotent institutional person resolution

Institutions use persons:resolve and receive an ID only. Composite document identity is unique; conflict resolution does not overwrite existing master names/birth date. Corrections remain administrative work outside this MVP.

## ADR-011 - Administrative mutations and audit commit together

A SECURITY INVOKER, service-role-only allowlisted RPC performs administrative mutations and audit inserts atomically. API client rotation changes hash/prefix on the same ID; complete keys are returned only at creation/rotation. No dynamic SQL, SECURITY DEFINER or key material in audit metadata.

## ADR-012 - Bounded synchronous institutional imports

One submission of 1–50 rows per PENDING batch, with imports:write and credentials:write. PostgreSQL locks the batch; per-row subtransactions preserve valid records while rolling back invalid credentials/events. Counters/status/errors commit together, with one-based indexes and stable codes only. Concurrent/repeated processing gets 409. Failed/partial batches are terminal; corrections create a new batch. Larger imports use separate bounded batches; no queue/resume in this MVP.
