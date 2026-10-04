# Credential machine authentication

## Goal
Institutional clients create and invalidate only their own credentials with the required scopes and authenticated provenance.

## Existing state
All three POST handlers already authenticate and derive provenance. Generated types match existing transactional RPC signatures. SQL checks client status, expiry and institutional ownership; lifecycle functions lock credentials and insert history atomically.

## Files involved
Three credential POST handlers, security regression tests, manual test guide and CURRENT_STATE.md. Two pre-existing PATCH type errors in institutions/programs are fixed with generated TablesUpdate types.

## Database impact
None. Preserve existing functions, migrations, privileges and generated types.

## API impact
Revoke/void additionally reject missing institutional association and check ownership before calling the existing RPC. Malformed JSON returns 400. Unknown body fields remain ignored and cannot override authenticated identity.

## Security considerations
No secrets read, printed or changed. No changes to GET endpoints in this stage. SQL ownership checks remain in place after the API check.

## Implementation
1. Add missing institutional association and API ownership validation.
2. Handle malformed JSON consistently.
3. Exercise real handlers and authentication utility with an isolated Supabase mock.
4. Run typecheck/lint and document manual database-backed verification.

## Verification
pnpm --filter raes-api exec tsc --noEmit
pnpm --filter raes-api lint
node --test apps/raes-api/tests/credential-machine-auth.test.mjs
See docs/MACHINE_AUTH_TESTING.md for curl flows.

## Result
Implemented association and ownership guards in revoke/void; all three handlers return 400 for malformed JSON. Existing authenticated provenance and transactional RPCs preserved. Fixed two pre-existing PATCH type errors with TablesUpdate. Typecheck, lint, 44 isolated regression tests and six live HTTP rejection checks pass. Authenticated database lifecycle/event validation remains manual; see MACHINE_AUTH_TESTING.md. No commit or push.
