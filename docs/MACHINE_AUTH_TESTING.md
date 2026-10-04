# Manual machine authentication verification

Run against a development database with the repository migrations applied. These commands create two credentials and preserve their lifecycle history. They require curl and jq. No real key belongs in this file, shell history or shared output. Do not use curl -v or shell tracing.

Start the API from the repository root:

```sh
pnpm --filter raes-api dev --port 3001
```

In another zsh terminal, enter an existing active INSTITUTION key with both `credentials:write` and `credentials:revoke`. The input prompt does not echo the key:

```zsh
read -rs 'RAES_API_KEY?Institution API key: '
printf '\n'
RAES_BASE_URL='http://localhost:3001/api/v1'
RAES_PERSON_ID='727029db-58fa-4ae1-a197-46bb05e315c1'
RAES_CREDENTIAL_TYPE_ID='3e6afac8-5bd9-479a-ae5c-8eb1ab11dbf3'
```

The documented person and credential type must exist and the institution/type must be active. No program is required. Update the IDs if the current development database differs.

Create two independent credentials (201 each). The UUID external references make repeated runs independent:

```zsh
RAES_CREATED_REVOKE=$(curl --silent --show-error --fail-with-body \
  "$RAES_BASE_URL/credentials" \
  -H "Authorization: Bearer $RAES_API_KEY" \
  -H 'Content-Type: application/json' \
  --data "{\"personId\":\"$RAES_PERSON_ID\",\"credentialTypeId\":\"$RAES_CREDENTIAL_TYPE_ID\",\"title\":\"Prueba manual de revocación\",\"issuedAt\":\"2026-10-03\",\"externalReference\":\"$(uuidgen)\"}")
printf '%s\n' "$RAES_CREATED_REVOKE" | jq .
RAES_REVOKE_ID=$(printf '%s' "$RAES_CREATED_REVOKE" | jq -er '.data.id')

RAES_CREATED_VOID=$(curl --silent --show-error --fail-with-body \
  "$RAES_BASE_URL/credentials" \
  -H "Authorization: Bearer $RAES_API_KEY" \
  -H 'Content-Type: application/json' \
  --data "{\"personId\":\"$RAES_PERSON_ID\",\"credentialTypeId\":\"$RAES_CREDENTIAL_TYPE_ID\",\"title\":\"Prueba manual de anulación\",\"issuedAt\":\"2026-10-03\",\"externalReference\":\"$(uuidgen)\"}")
printf '%s\n' "$RAES_CREATED_VOID" | jq .
RAES_VOID_ID=$(printf '%s' "$RAES_CREATED_VOID" | jq -er '.data.id')
```

Check `institution_id` against the authenticated client's institution, `registered_by_api_client_id` against its ID, `registered_by_reference` against its name, and `source_type = INSTITUTION_API`.

Revoke and void (200 each). Forged actor fields are ignored:

```zsh
curl -i --silent --show-error "$RAES_BASE_URL/credentials/$RAES_REVOKE_ID/revoke" \
  -H "Authorization: Bearer $RAES_API_KEY" -H 'Content-Type: application/json' \
  --data '{"reason":"Revocación de prueba manual","actorType":"ADMIN","actorReference":"forged","apiClientId":"11111111-1111-4111-8111-111111111111"}'

curl -i --silent --show-error "$RAES_BASE_URL/credentials/$RAES_VOID_ID/void" \
  -H "Authorization: Bearer $RAES_API_KEY" -H 'Content-Type: application/json' \
  --data '{"reason":"Anulación de prueba manual"}'
```

Repeat either request: expect 409, with no additional event. Voiding the revoked credential or revoking the voided credential also returns 409.

Authentication checks (401 for every endpoint):

```zsh
for RAES_PATH in 'credentials' "credentials/$RAES_REVOKE_ID/revoke" "credentials/$RAES_VOID_ID/void"; do
  curl -i --silent --show-error "$RAES_BASE_URL/$RAES_PATH" \
    -H 'Content-Type: application/json' --data '{}'
  curl -i --silent --show-error "$RAES_BASE_URL/$RAES_PATH" \
    -H 'Authorization: Bearer invalid' -H 'Content-Type: application/json' --data '{}'
done
```

Malformed JSON with valid authentication returns 400:

```zsh
curl -i --silent --show-error "$RAES_BASE_URL/credentials" \
  -H "Authorization: Bearer $RAES_API_KEY" -H 'Content-Type: application/json' --data '{'
```

For negative authorization tests, enter an existing test key at the hidden prompt. Repeat for a PLATFORM key, institutional key without the required scope, suspended/revoked key, expired key, and a key of another institution. Do not revoke a real integration just to run this test.

```zsh
read -rs 'RAES_TEST_KEY?Negative-test API key: '
printf '\n'
for RAES_PATH in 'credentials' "credentials/$RAES_REVOKE_ID/revoke" "credentials/$RAES_VOID_ID/void"; do
  curl -i --silent --show-error "$RAES_BASE_URL/$RAES_PATH" \
    -H "Authorization: Bearer $RAES_TEST_KEY" -H 'Content-Type: application/json' \
    --data '{"reason":"Prueba de autorización"}'
done
```

Expect 403 for PLATFORM, missing scope, inactive or expired clients. Another institution with `credentials:revoke` receives 403 `CREDENTIAL_ACCESS_DENIED` on revoke/void even for already invalidated credentials. Its creation request above returns 400 because the creation payload is incomplete; use the full create payload to test permitted creation for that institution. A read-only client receives 403 on all three endpoints. A write-only client may create but cannot revoke/void; a revoke-only client cannot create.

In the Supabase SQL editor, replace the two UUID placeholders with the newly created IDs. This query does not read keys or hashes:

```sql
select c.id, c.institution_id, c.status, c.source_type,
       c.registered_by_api_client_id, c.registered_by_reference,
       e.event_type, e.previous_status, e.new_status,
       e.actor_type, e.actor_reference, e.api_client_id, e.reason
from public.credentials c
join public.credential_events e on e.credential_id = c.id
where c.id in ('<RAES_REVOKE_ID>'::uuid, '<RAES_VOID_ID>'::uuid)
order by c.id, e.created_at;
```

Expect exactly CREATED + REVOKED for one credential and CREATED + VOIDED for the other, with API_CLIENT actor identity matching the authenticated client. Denied or conflicting operations must add no events. Do not hard-delete these records.

```zsh
unset RAES_API_KEY RAES_TEST_KEY
```

Automated verification:

```sh
pnpm --filter raes-api exec tsc --noEmit
pnpm --filter raes-api lint
node --test apps/raes-api/tests/credential-machine-auth.test.mjs
```

The automated suite loads actual handlers and the real authentication utility with an isolated Supabase mock. It verifies authorization and RPC inputs, not live PostgreSQL execution or transaction rollback.


The complete backend MVP now protects credential reads too. See BACKEND_ACCEPTANCE_TESTING.md for the full linked-database smoke flow, additional scopes, rotation, persons/resolve, programs, imports and audit. Credential reads do not expose person document/birth fields. This stage's authenticated live results are recorded in CURRENT_STATE.md; the isolated suite remains mock-based.
