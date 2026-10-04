# RAES Security Model

## Secrets

Never commit:

- SUPABASE_SECRET_KEY
- service-role keys
- RAES_ADMIN_API_KEY
- generated RAES API keys
- database passwords

`.env.local` remains gitignored.

## API keys

Generated institutional/platform API keys have a format similar to:

`raes_<prefix>_<secret>`

Database stores:

- key prefix
- SHA-256 hash

The complete API key is returned only when created.

It cannot be recovered from the stored hash.

## Admin API key

`RAES_ADMIN_API_KEY` protects administration of machine integrations.

This is currently appropriate for prototype/internal administration.

A stronger admin identity/auth model can replace it later.

## Institutional isolation

An institutional client must not be trusted to send its own institution identity in request data.

Instead:

API key -> api_clients -> institution_id

Database functions additionally validate institutional ownership for sensitive credential operations.

## Credential lifecycle

Credentials are not deleted when invalidated.

Use:

- REVOKED
- VOIDED

and preserve event history.

## Supabase

The privileged Supabase secret exists only in `apps/raes-api`.

Never use `NEXT_PUBLIC_` for privileged credentials.
## Backend MVP authorization

Only health is public. All 29 method/path rules are in `API_AUTHORIZATION_MATRIX.md`.
Administrative credentials and integration credentials are separate; API-client revoke no longer incorrectly requires both.

- Institutional reads use institution predicates derived from the key. Detail reads hide foreign UUIDs with 404.
- Programs use institution predicates in SELECT and UPDATE; create derives institution server-side.
- Credential lifecycle keeps the API ownership check and locked SQL recheck, client status/expiry/scopes and authenticated actor identity.
- PLATFORM is read-only, requires credentials:read, and must supply personId for a list. It cannot enumerate persons, manage programs or import.
- Person resolution returns only an ID and never overwrites existing master data. Administrative person reads remain sensitive and protected.
- Credential reads omit document numbers/types, birth dates and metadata; holder names and IDs are sufficient for display and association.
- New SQL functions are SECURITY INVOKER and executable only by service_role. RLS remains enabled and direct anon/authenticated grants remain revoked.

## Key rotation and operational audit

Create/rotate return a complete key once; all other responses exclude it and key_hash. Rotation replaces hash/prefix on the same locked client; subsequent authentication with the old key fails. Requests already authenticated before rotation may finish; rotation is not cancellation of in-flight work.
Revocation is terminal. Suspended/expired clients cannot rotate to bypass their restrictions. last_used_at continues to update upon successful machine authentication.
Admin mutations and audit inserts share a transaction via manage_core_resource. Audit metadata records operation, not request payloads, keys, hashes or master identity data. Security-relevant key creation/rotation/revocation is audited; credential history remains in credential_events.

## Limits and errors

JSON is streamed with a 256 KiB byte limit. Metadata max 16 KiB, bounded strings, UUID/date/enum validation, pagination max 100 and imports max 50 rows. Invalid JSON and size limits return 400. SQL errors are translated to stable codes, and logs do not print raw database errors or request bodies.

Import processing locks a batch, checks institutional ownership/scopes again in PostgreSQL and isolates each row with a subtransaction. Stored errors contain only row indexes/codes. A failed row cannot leave a credential without its event or corrupt counters.

## Verification

Live PostgreSQL ACL inspection confirms all six sensitive functions have prosecdef=false, anon/authenticated EXECUTE=false and service_role EXECUTE=true. Advisors show only intentional RLS-without-policy informational findings and unused-index information. No permissive policies or CORS changes were introduced.

Future Citizen Platform must validate citizen identity/ownership before requesting person-specific Core data. A trusted PLATFORM API key is not a citizen session. Public consent/share/verification is outside this backend MVP.
