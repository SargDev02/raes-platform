# RAES Core backend acceptance testing

Run commands from the repository root. Requires the existing server-only development configuration in `apps/raes-api/.env.local`; do not print or paste that file. Scripts consume configured secrets in memory and never output API keys, hashes or environment contents.

## Automated checks

```sh
pnpm --filter raes-api exec tsc --noEmit
pnpm --filter raes-api lint
pnpm --filter raes-api test
```

The root package's original test command is a placeholder, so use the real raes-api test script.
The isolated suite loads actual TypeScript handlers/auth utilities using the installed TypeScript compiler and mocks only Supabase. It covers authentication, all sensitive route guards, scopes/types, spoofing, ownership query predicates, privacy projection, malformed/oversized JSON, UUIDs/enums/dates/pagination, lifecycle state errors, key rotation/revocation, import bounds and invalid-row sanitization. It does not itself execute PostgreSQL.

## Linked database and live HTTP flow

Both new migrations have already been applied to the linked raes-core project. Confirm local/remote versions before running the acceptance script:

```sh
pnpm exec supabase migration list --linked
```

For a new development project, apply the committed migration sequence using the normal Supabase migration workflow. Do not reset the existing linked database or edit applied migrations. Generate types if applying to a different database:

```sh
pnpm exec supabase gen types --linked --schema public > apps/raes-api/src/types/database.ts
```

Start the API in one terminal:

```sh
pnpm --filter raes-api dev --port 3001
```

Run the full live suite in another terminal:

```sh
pnpm --filter raes-api test:acceptance
```

Optional different local port:

```sh
RAES_TEST_URL='http://localhost:3002/api/v1' pnpm --filter raes-api test:acceptance
```

The script creates new institutions, persons, programs, integration clients, credentials and batches with a unique `RAES-MVP-TEST-<uuid>` marker. It prints only PASS/FAIL, counts and non-secret fixture IDs. Successful runs revoke all clients they created; academic credentials/events and batches are preserved. No existing data is deleted. A failed run attempts administrative revocation of its own test clients too. If API connectivity prevents cleanup, use the printed client IDs with the administrative revoke endpoint to disable those test clients.

It verifies:
- public health and unauthorized rejections across sensitive collections;
- admin institution changes, client creation, audit query and protection;
- institutional person resolution existing/new, concurrent convergence, no overwrite and composite document identity;
- own programs and foreign program access denial, institution spoofing and admin updates;
- credential creation/provenance, detail UUID, read privacy, institutional isolation and controlled PLATFORM person filter;
- revoke/void, both duplicate transitions and both opposite terminal transitions, foreign writes and scopes/types;
- successful, partial and failed imports, structurally invalid rows, 51-row rejection, safe row errors and batch ownership;
- concurrent same-batch requests yielding one success and one conflict;
- malformed JSON, metadata/body limits, UUID/enum/pagination validation;
- expiry/suspension on new test clients only; rotation old-key failure/new-key success, revoked-key failure and last_used_at;
- direct PostgreSQL-backed assertions through the server Supabase client for event count/actor identity and credential/batch association.

## Manual curl checks

For complete create/revoke/void commands, see [MACHINE_AUTH_TESTING.md](MACHINE_AUTH_TESTING.md).
In a zsh terminal, enter an institutional test key with the necessary scopes at a hidden prompt:

```zsh
read -rs 'RAES_API_KEY?Institution API key: '
printf '\n'
RAES_BASE_URL='http://localhost:3001/api/v1'
```

Resolve a new synthetic person and capture only its ID:

```zsh
RAES_PERSON_ID=$(curl --silent --show-error --fail-with-body "$RAES_BASE_URL/persons/resolve" \
  -H "Authorization: Bearer $RAES_API_KEY" -H 'Content-Type: application/json' \
  --data "{\"documentType\":\"CC\",\"documentNumber\":\"$(uuidgen | tr -d '-' | cut -c1-25)\",\"firstNames\":\"Prueba\",\"lastNames\":\"Aceptación MVP\"}" | jq -er '.data.id')
RAES_TYPE_ID=$(curl --silent --show-error --fail-with-body "$RAES_BASE_URL/credential-types?limit=100" \
  -H "Authorization: Bearer $RAES_API_KEY" | jq -er '.data[] | select(.code == "DEGREE") | .id')
curl -i --silent --show-error "$RAES_BASE_URL/credentials?personId=$RAES_PERSON_ID&page=1&limit=20" \
  -H "Authorization: Bearer $RAES_API_KEY"
```

Create/process/read a batch (requires imports:read/write and credentials:write):

```zsh
RAES_BATCH_ID=$(curl --silent --show-error --fail-with-body "$RAES_BASE_URL/credential-import-batches" \
  -H "Authorization: Bearer $RAES_API_KEY" -H 'Content-Type: application/json' \
  --data "{\"externalBatchId\":\"manual-$(uuidgen)\"}" | jq -er '.data.id')
curl -i --silent --show-error "$RAES_BASE_URL/credential-import-batches/$RAES_BATCH_ID/credentials" \
  -H "Authorization: Bearer $RAES_API_KEY" -H 'Content-Type: application/json' \
  --data "{\"records\":[{\"personId\":\"$RAES_PERSON_ID\",\"credentialTypeId\":\"$RAES_TYPE_ID\",\"title\":\"Prueba importación MVP\",\"issuedAt\":\"2026-10-03\",\"externalReference\":\"$(uuidgen)\"},{\"personId\":\"invalid\"}]}"
curl -i --silent --show-error "$RAES_BASE_URL/credential-import-batches/$RAES_BATCH_ID" \
  -H "Authorization: Bearer $RAES_API_KEY"
```

Expect PARTIAL with success_count=1, failure_count=1 and row 2 INVALID_CREDENTIAL_DATA. Repeat processing: 409.

For a PLATFORM key with credentials:read:

```zsh
read -rs 'RAES_PLATFORM_KEY?PLATFORM API key: '
printf '\n'
curl -i --silent --show-error "$RAES_BASE_URL/credentials" -H "Authorization: Bearer $RAES_PLATFORM_KEY"
curl -i --silent --show-error "$RAES_BASE_URL/credentials?personId=$RAES_PERSON_ID" \
  -H "Authorization: Bearer $RAES_PLATFORM_KEY"
```

Expect 400 PLATFORM_PERSON_FILTER_REQUIRED then 200.

Administrative audit and rotation (use a disposable test client; rotation invalidates its old key):

```zsh
read -rs 'RAES_ADMIN_KEY?Admin key: '
printf '\n'
RAES_CLIENT_ID='<test-client-uuid>'
RAES_ROTATION=$(curl --silent --show-error --fail-with-body "$RAES_BASE_URL/api-clients/$RAES_CLIENT_ID/rotate" \
  -H "Authorization: Bearer $RAES_ADMIN_KEY" -X POST)
RAES_NEW_KEY=$(printf '%s' "$RAES_ROTATION" | jq -er '.data.apiKey')
printf '%s\n' "$RAES_ROTATION" | jq 'del(.data.apiKey)'
curl -i --silent --show-error "$RAES_BASE_URL/credentials" -H "Authorization: Bearer $RAES_NEW_KEY"
curl -i --silent --show-error "$RAES_BASE_URL/audit-logs?resource_type=api_client&resource_id=$RAES_CLIENT_ID" \
  -H "Authorization: Bearer $RAES_ADMIN_KEY"
curl -i --silent --show-error "$RAES_BASE_URL/api-clients/$RAES_CLIENT_ID/revoke" \
  -H "Authorization: Bearer $RAES_ADMIN_KEY" -H 'Content-Type: application/json' \
  --data '{"reason":"Finalización de prueba manual MVP"}'
unset RAES_API_KEY RAES_PLATFORM_KEY RAES_ADMIN_KEY RAES_NEW_KEY RAES_ROTATION
```

The new-key request expects 200 for an institutional client with credentials:read; PLATFORM needs personId. A request with the old key expects 401, and after revoke the new key expects 403. Never run curl -v or shell tracing with actual keys.

## SQL verification and advisors

In the Supabase SQL editor (read-only privilege checks):

```sql
select p.proname, p.prosecdef,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as server_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public';
```

Expect six functions, prosecdef=false, anon/authenticated=false and server=true. All ten domain tables keep RLS and no direct anon/authenticated SELECT/INSERT/UPDATE/DELETE privileges. The existing persons_document_unique constraint remains composite.

Security and performance advisors were run after migrations. Security: 10 informational RLS enabled/no policy findings, intentional for server-only access. Performance: 16 unused-index informational findings in the final inspection. No ERROR/WARN findings; no indexes/policies were removed to silence information.

A live SQL subtransaction probe called manage_core_resource, raised an intentional exception, and confirmed both the created institution and its audit record rolled back together. Result: ADMIN_MUTATION_AND_AUDIT_ROLLBACK_PASS. No probe records remain.

## Results

Implemented: complete API matrix, six sensitive RPCs, bounded imports and documentation.
Automated-tested: 122 isolated tests, typecheck and lint pass.
Live-tested: final run passed 133 HTTP assertions plus SQL-backed state/history/association checks, including malformed JSON and empty-stream handling on rotation bodies. Final fixture marker: RAES-MVP-TEST-36869ff0-cf68-49e4-84a6-c4eaaa18d0b1.

No manual migration or authentication test remains required for the linked development project; commands above allow independent review. This is development acceptance, not a production load or deployment test.
