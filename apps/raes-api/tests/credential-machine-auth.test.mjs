import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const dependencyRequire = createRequire(import.meta.url);
const testDirectory = path.dirname(fileURLToPath(import.meta.url));

// Load actual TS handlers without starting Next or accessing any environment secrets.
function harness(options = {}) {
  const id = '11111111-1111-4111-8111-111111111111';
  const institution = '22222222-2222-4222-8222-222222222222';
  const key = 'raes_abcdef123456_test-only-not-a-real-key';
  const client = { id, name: 'Test integration', client_type: 'INSTITUTION', institution_id: institution,
    scopes: ['credentials:write', 'credentials:revoke'], status: 'ACTIVE', expires_at: null,
    key_hash: createHash('sha256').update(key).digest('hex'), ...options.client };
  const calls = [];
  const db = {
    from(table) {
      const query = { select() { return this; }, eq() { return this; },
        async maybeSingle() { return { data: table === 'api_clients' ? (options.unknown ? null : client) :
          (options.missing ? null : { id, institution_id: options.foreign ? id : institution }), error: null }; },
        update() { return { eq: async () => ({ error: null }) }; } };
      return query;
    },
    async rpc(name, args) { calls.push({ name, args }); return { data: { id }, error: options.rpcError ? { message: options.rpcError } : null }; },
  };
  const cache = {};
  function load(file) {
    if (cache[file]) return cache[file].exports;
    const mod = { exports: {} }; cache[file] = mod;
    const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const localRequire = (name) => name === '@/lib/supabase' ? { supabase: db } :
      name.startsWith('@/') ? load(path.resolve(testDirectory, '../src', name.slice(2) + '.ts')) : dependencyRequire(name);
    new Function('require', 'module', 'exports', output)(localRequire, mod, mod.exports);
    return mod.exports;
  }
  async function invoke(action, body, authorization = `Bearer ${key}`) {
    const file = action === 'create' ? 'route.ts' : `[id]/${action}/route.ts`;
    const request = new Request('http://localhost/api/v1/credentials', { method: 'POST',
      headers: authorization === null ? {} : { authorization }, body: typeof body === 'string' ? body : JSON.stringify(body) });
    const response = await load(path.resolve(testDirectory, '../src/app/api/v1/credentials', file)).POST(request, { params: Promise.resolve({ id }) });
    return { status: response.status, body: await response.json() };
  }
  return { invoke, calls, id, institution, client };
}
const creation = { personId: '33333333-3333-4333-8333-333333333333', credentialTypeId: '44444444-4444-4444-8444-444444444444', title: 'Test credential', issuedAt: '2026-10-03' };
for (const action of ['create', 'revoke', 'void']) {
  const body = action === 'create' ? creation : { reason: 'Test lifecycle reason' };
  for (const [label, options, authorization, status, error] of [
    ['missing key', {}, null, 401, 'MISSING_API_KEY'],
    ['invalid key', {}, 'Bearer invalid', 401, 'INVALID_API_KEY'],
    ['unknown key', { unknown: true }, undefined, 401, 'INVALID_API_KEY'],
    ['wrong hash', { client: { key_hash: '0'.repeat(64) } }, undefined, 401, 'INVALID_API_KEY'],
    ['suspended', { client: { status: 'SUSPENDED' } }, undefined, 403, 'API_CLIENT_NOT_ACTIVE'],
    ['revoked', { client: { status: 'REVOKED' } }, undefined, 403, 'API_CLIENT_NOT_ACTIVE'],
    ['expired', { client: { expires_at: '2000-01-01' } }, undefined, 403, 'API_KEY_EXPIRED'],
    ['platform', { client: { client_type: 'PLATFORM', institution_id: null } }, undefined, 403, 'INSTITUTION_CLIENT_REQUIRED'],
    ['wrong scope', { client: { scopes: ['credentials:read'] } }, undefined, 403, 'INSUFFICIENT_SCOPE'],
    ['missing institution', { client: { institution_id: null } }, undefined, 403, 'INVALID_API_CLIENT'],
  ]) test(`${action}: ${label}`, async () => {
    const h = harness(options); const result = await h.invoke(action, body, authorization);
    assert.equal(result.status, status); assert.equal(result.body.error, error); assert.equal(h.calls.length, 0);
  });
  test(`${action}: malformed JSON and invalid data`, async () => {
    const h = harness();
    assert.equal((await h.invoke(action, '{')).status, 400);
    assert.equal((await h.invoke(action, {})).status, 400);
    assert.equal(h.calls.length, 0);
  });
  test(`${action}: authenticated provenance cannot be overridden`, async () => {
    const h = harness();
    const result = await h.invoke(action, { ...body, institutionId: h.id, sourceType: 'ADMIN',
      registeredByApiClientId: h.institution, registeredByReference: 'forged', actorType: 'ADMIN', actorReference: 'forged', apiClientId: h.institution });
    assert.equal(result.status, action === 'create' ? 201 : 200);
    const { name, args } = h.calls[0];
    assert.equal(name, action === 'create' ? 'create_credential' : `${action}_credential`);
    if (action === 'create') {
      assert.equal(args.p_institution_id, h.institution); assert.equal(args.p_source_type, 'INSTITUTION_API');
      assert.equal(args.p_registered_by_api_client_id, h.id); assert.equal(args.p_registered_by_reference, h.client.name);
    } else {
      assert.equal(args.p_actor_type, 'API_CLIENT'); assert.equal(args.p_api_client_id, h.id); assert.equal(args.p_actor_reference, h.client.name);
    }
  });
  if (action !== 'create') {
    for (const [options, status] of [[{ foreign: true }, 403], [{ missing: true }, 404]])
      test(`${action}: ownership or absence ${status}`, async () => {
        const h = harness(options); assert.equal((await h.invoke(action, body)).status, status); assert.equal(h.calls.length, 0);
      });
    test(`${action}: RPC ownership recheck`, async () => {
      const h = harness({ rpcError: 'API_CLIENT_CREDENTIAL_MISMATCH' });
      assert.equal((await h.invoke(action, body)).status, 403);
    });
    test(`${action}: lifecycle conflict`, async () => {
      const h = harness({ rpcError: action === 'revoke' ? 'CREDENTIAL_ALREADY_REVOKED' : 'CREDENTIAL_ALREADY_VOIDED' });
      assert.equal((await h.invoke(action, body)).status, 409);
    });
  }
}

for (const [action, rpcError] of [['void','REVOKED_CREDENTIAL_CANNOT_BE_VOIDED'],['revoke','VOIDED_CREDENTIAL_CANNOT_BE_REVOKED']]) {
  test(`${action}: opposite terminal state rejected`, async () => {
    const h = harness({ rpcError });
    assert.equal((await h.invoke(action, { reason: 'Invalid lifecycle transition' })).status, 409);
  });
}
