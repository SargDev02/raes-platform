// Development acceptance flow: creates new fixtures and never prints keys or removes history.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const deps = createRequire(import.meta.url);
const nextDeps = createRequire(deps.resolve('next/package.json'));
const { loadEnvConfig } = nextDeps('@next/env');
const { createClient } = deps('@supabase/supabase-js');
loadEnvConfig(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), true, { info() {}, error() {} });
const adminKey = process.env.RAES_ADMIN_API_KEY;
if (!adminKey || !process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY)
  throw new Error('Configure the server-only development environment before acceptance testing');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const base = process.env.RAES_TEST_URL ?? 'http://localhost:3001/api/v1';
const tag = `RAES-MVP-TEST-${randomUUID()}`;
let checks = 0;
async function call(method, endpoint, key, body, expected = 200) {
  const response = await fetch(base + endpoint, { method, headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}),
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
  const result = await response.json();
  // Assert only status/code; never attach complete responses (create/rotate contain secrets).
  assert.equal(response.status, expected, `${method} ${endpoint}: ${response.status} (${result.error ?? 'success'})`);
  checks++; return result;
}
const allScopes = ['credentials:read','credentials:write','credentials:revoke','persons:resolve','programs:read','programs:write','imports:read','imports:write'];
const fixtures = { tag, institutions: [], clients: [], credentials: [], batches: [] };
try {
  await call('GET', '/health', undefined);
  for (const endpoint of ['/credentials','/persons','/institutions','/programs','/api-clients','/audit-logs','/document-types','/credential-types','/credential-import-batches'])
    await call('GET', endpoint, undefined, undefined, 401);
  const createInstitution = async index => (await call('POST', '/institutions', adminKey,
    { name: `${tag} ${index}`, nit: randomUUID().replaceAll('-','').slice(0,20) }, 201)).data;
  const a = await createInstitution('A'); const b = await createInstitution('B');
  fixtures.institutions.push(a.id, b.id);
  await call('PATCH', `/institutions/${a.id}`, adminKey, { name: `${tag} updated` });
  const makeClient = async (institutionId, scopes = allScopes, clientType = 'INSTITUTION') => {
    const client = (await call('POST', '/api-clients', adminKey, { name: tag, clientType, ...(institutionId ? { institutionId } : {}), scopes }, 201)).data;
    assert.equal(client.key_hash, undefined); fixtures.clients.push(client.id); return client;
  };
  const ca = await makeClient(a.id); const cb = await makeClient(b.id);
  const cp = await makeClient(null, ['credentials:read'], 'PLATFORM');
  const cr = await makeClient(a.id, ['credentials:read']);
  await call('POST','/api-clients',adminKey,{name:tag,clientType:'PLATFORM',scopes:['programs:write']},400);
  for (const endpoint of ['/persons','/api-clients','/audit-logs']) {
    await call('GET',endpoint,ca.apiKey,undefined,401); await call('GET',endpoint,cp.apiKey,undefined,401);
  }
  await call('POST','/institutions',ca.apiKey,{ name: tag, nit: tag },401);
  await call('PATCH',`/institutions/${a.id}`,ca.apiKey,{status:'SUSPENDED'},401);
  await call('GET',`/institutions/${b.id}`,ca.apiKey,undefined,404);
  const ownInstitutions=await call('GET','/institutions',ca.apiKey);
  assert.deepEqual(ownInstitutions.data.map(row=>row.id),[a.id]);
  await call('GET','/institutions',cp.apiKey,undefined,403);
  const personInput={documentType:'CC',documentNumber:randomUUID().replaceAll('-','').slice(0,25),firstNames:'Prueba',lastNames:tag};
  const person=(await call('POST','/persons/resolve',ca.apiKey,personInput)).data;
  const repeated=(await call('POST','/persons/resolve',ca.apiKey,{...personInput,firstNames:'No sobrescribir'})).data;
  assert.equal(repeated.id,person.id); assert.deepEqual(Object.keys(repeated),['id']);
  const simultaneous=await Promise.all(Array.from({length:4},()=>call('POST','/persons/resolve',ca.apiKey,personInput)));
  assert(simultaneous.every(r=>r.data.id===person.id));
  const otherType=(await call('POST','/persons/resolve',ca.apiKey,{...personInput,documentType:'CE'})).data;
  assert.notEqual(otherType.id,person.id);
  const storedPerson=(await call('GET',`/persons/${person.id}`,adminKey)).data; assert.equal(storedPerson.first_names,'Prueba');
  await call('GET',`/persons/${person.id}`,ca.apiKey,undefined,401);
  await call('POST','/persons/resolve',cp.apiKey,personInput,403);
  await call('POST','/persons/resolve',cr.apiKey,personInput,403);
  const program=(await call('POST','/programs',ca.apiKey,{name:tag,code:tag,institutionId:b.id},201)).data;
  assert.equal(program.institution_id,a.id);
  await call('GET',`/programs/${program.id}`,ca.apiKey);
  await call('PATCH',`/programs/${program.id}`,ca.apiKey,{academicLevel:'MVP'});
  await call('GET',`/programs/${program.id}`,cb.apiKey,undefined,404);
  await call('PATCH',`/programs/${program.id}`,cb.apiKey,{name:'forged'},404);
  await call('GET','/programs',cp.apiKey,undefined,403);
  await call('POST','/programs',cp.apiKey,{name:tag},403);
  await call('GET','/programs',cr.apiKey,undefined,403);
  const programs=(await call('GET',`/programs?institutionId=${b.id}`,ca.apiKey)).data;
  assert(programs.every(row=>row.institution_id===a.id));
  await call('PATCH',`/programs/${program.id}`,adminKey,{name:`${tag} admin`});
  const types=(await call('GET','/credential-types',ca.apiKey)).data;
  const type=types.find(t=>t.code==='DEGREE'); assert(type);
  await call('GET','/document-types',ca.apiKey);
  const credentialInput={personId:person.id,credentialTypeId:type.id,programId:program.id,title:tag,issuedAt:'2026-10-03'};
  const createCredential=async suffix => {
    const result=await call('POST','/credentials',ca.apiKey,{...credentialInput,externalReference:`${tag}-${suffix}`,
      institutionId:b.id,sourceType:'ADMIN',registeredByApiClientId:cb.id},201);
    assert.equal(result.data.institution_id,a.id);assert.equal(result.data.registered_by_api_client_id,ca.id);
    assert.equal(result.data.source_type,'INSTITUTION_API');fixtures.credentials.push(result.data.id);return result.data;
  };
  const c1=await createCredential('revoke');const c2=await createCredential('void');
  const detail=(await call('GET',`/credentials/${c1.id}`,ca.apiKey)).data;
  assert.equal(detail.id,c1.id);assert.equal(detail.person.document_number,undefined);assert.equal(detail.person.birth_date,undefined);
  await call('GET',`/credentials/${c1.id}`,cb.apiKey,undefined,404);
  await call('GET',`/credentials/${c1.id}`,cp.apiKey);
  await call('GET','/credentials',cp.apiKey,undefined,400);
  await call('GET',`/credentials?personId=${person.id}`,cp.apiKey);
  const list=(await call('GET',`/credentials?institutionId=${b.id}`,ca.apiKey)).data;
  assert(list.every(c=>c.institution_id===a.id));
  for (const [method,endpoint,body] of [['POST','/credentials',credentialInput],['POST',`/credentials/${c1.id}/revoke`,{reason:'Test denial'}],['POST',`/credentials/${c2.id}/void`,{reason:'Test denial'}]]) {
    await call(method,endpoint,cr.apiKey,body,403);await call(method,endpoint,cp.apiKey,body,403);
  }
  await call('POST',`/credentials/${c1.id}/revoke`,cb.apiKey,{reason:'Foreign denial'},403);
  await call('POST',`/credentials/${c2.id}/void`,cb.apiKey,{reason:'Foreign denial'},403);
  await call('POST',`/credentials/${c1.id}/revoke`,ca.apiKey,{reason:'MVP acceptance revoke',actorType:'ADMIN',apiClientId:cb.id});
  await call('POST',`/credentials/${c1.id}/revoke`,ca.apiKey,{reason:'Duplicate revoke'},409);
  await call('POST',`/credentials/${c1.id}/void`,ca.apiKey,{reason:'Invalid transition'},409);
  await call('POST',`/credentials/${c2.id}/void`,ca.apiKey,{reason:'MVP acceptance void'});
  await call('POST',`/credentials/${c2.id}/void`,ca.apiKey,{reason:'Duplicate void'},409);
  await call('POST',`/credentials/${c2.id}/revoke`,ca.apiKey,{reason:'Invalid transition'},409);
  for (const statusCase of ['COMPLETED','PARTIAL','FAILED']) {
    const batch=(await call('POST','/credential-import-batches',ca.apiKey,{externalBatchId:`${tag}-${statusCase}`},201)).data;
    fixtures.batches.push(batch.id);
    await call('GET',`/credential-import-batches/${batch.id}`,cb.apiKey,undefined,404);
    const good={...credentialInput,externalReference:`${tag}-${statusCase}-row`};
    const bad={...credentialInput,personId:randomUUID()};
    const records=statusCase==='COMPLETED'?[good]:statusCase==='PARTIAL'?[good,bad]:[bad];
    await call('POST',`/credential-import-batches/${batch.id}/credentials`,cb.apiKey,{records},403);
    const imported=(await call('POST',`/credential-import-batches/${batch.id}/credentials`,ca.apiKey,{records})).data;
    assert.equal(imported.batch.status,statusCase);assert.equal(imported.batch.total_records,records.length);
    assert.equal(imported.batch.success_count,statusCase==='FAILED'?0:1);
    assert.equal(imported.batch.failure_count,statusCase==='COMPLETED'?0:1);
    assert(imported.errors.every(e=>Object.keys(e).sort().join(',')==='error,row'));
    fixtures.credentials.push(...imported.results.map(row=>row.id));
    await call('POST',`/credential-import-batches/${batch.id}/credentials`,ca.apiKey,{records},409);
  }
  await call('GET','/credential-import-batches',ca.apiKey);
  await call('GET','/credential-import-batches',cp.apiKey,undefined,403);
  await call('POST','/credential-import-batches',cr.apiKey,{},403);
  await call('GET','/credentials?status=BAD',ca.apiKey,undefined,400);
  await call('GET','/credentials?page=-1',ca.apiKey,undefined,400);
  await call('GET','/credentials?limit=101',ca.apiKey,undefined,400);
  await call('GET','/credentials/not-a-uuid',ca.apiKey,undefined,400);
  for (const endpoint of ['/credentials','/persons/resolve','/programs','/credential-import-batches'])
    await call('POST',endpoint,ca.apiKey,'{',400);
  await call('POST','/institutions',adminKey,'{',400);
  await call('POST','/api-clients',adminKey,'{',400);
  await call('POST','/credentials',ca.apiKey,{...credentialInput,metadata:{large:'x'.repeat(17000)}},400);
  await call('POST','/credentials',ca.apiKey,'x'.repeat(262145),400);
  await call('POST',`/credential-import-batches/${fixtures.batches[0]}/credentials`,ca.apiKey,{records:Array(51).fill(credentialInput)},400);
  const invalidRowsBatch=(await call('POST','/credential-import-batches',ca.apiKey,{externalBatchId:`${tag}-invalid-rows`},201)).data;
  fixtures.batches.push(invalidRowsBatch.id);
  const invalidRowsResult=(await call('POST',`/credential-import-batches/${invalidRowsBatch.id}/credentials`,ca.apiKey,
    {records:[{...credentialInput,externalReference:`${tag}-valid-row`},{personId:'bad'},null]})).data;
  assert.equal(invalidRowsResult.batch.status,'PARTIAL');assert.equal(invalidRowsResult.batch.success_count,1);
  assert.equal(invalidRowsResult.batch.failure_count,2);assert(invalidRowsResult.errors.every(e=>e.error==='INVALID_CREDENTIAL_DATA'));
  fixtures.credentials.push(...invalidRowsResult.results.map(row=>row.id));
  const concurrencyBatch=(await call('POST','/credential-import-batches',ca.apiKey,{externalBatchId:`${tag}-concurrent`},201)).data;
  fixtures.batches.push(concurrencyBatch.id);
  const concurrentBody={records:[{...credentialInput,externalReference:`${tag}-concurrent-row`}]};
  const concurrentRequests=await Promise.all([0,1].map(async()=>{
    const response=await fetch(`${base}/credential-import-batches/${concurrencyBatch.id}/credentials`,{method:'POST',
      headers:{Authorization:`Bearer ${ca.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(concurrentBody)});
    const result=await response.json();checks++;return {status:response.status,result};
  }));
  assert.deepEqual(concurrentRequests.map(r=>r.status).sort(),[200,409]);
  fixtures.credentials.push(...concurrentRequests.find(r=>r.status===200).result.data.results.map(row=>row.id));
  const transient=await makeClient(a.id);
  const expired=await db.from('api_clients').update({expires_at:'2000-01-01T00:00:00Z'}).eq('id',transient.id);
  assert.equal(expired.error,null);await call('GET','/credentials',transient.apiKey,undefined,403);
  const suspended=await db.from('api_clients').update({expires_at:null,status:'SUSPENDED'}).eq('id',transient.id);
  assert.equal(suspended.error,null);await call('GET','/credentials',transient.apiKey,undefined,403);
  await call('POST',`/api-clients/${transient.id}/revoke`,adminKey,{reason:'MVP acceptance cleanup revocation'});
  await call('GET','/credentials','malformed',undefined,401);
  await call('GET','/credentials','raes_abcdef123456_unknown-test-only',undefined,401);
  await call('POST',`/api-clients/${ca.id}/rotate`,adminKey,'{',400);
  const oldKey=ca.apiKey;
  const rotated=(await call('POST',`/api-clients/${ca.id}/rotate`,adminKey)).data;
  assert.equal(rotated.id,ca.id);assert.equal(rotated.key_hash,undefined);ca.apiKey=rotated.apiKey;
  await call('GET','/credentials',oldKey,undefined,401);await call('GET','/credentials',ca.apiKey);
  await call('POST',`/api-clients/${ca.id}/rotate`,cb.apiKey,undefined,401);
  const clients=(await call('GET','/api-clients',adminKey)).data;
  assert(clients.every(c=>!('key_hash' in c)&&!('apiKey' in c)));
  const audits=(await call('GET',`/audit-logs?resource_type=api_client&resource_id=${ca.id}`,adminKey)).data;
  assert(audits.some(row=>row.action==='API_CLIENT_KEY_ROTATED'));assert(audits.some(row=>row.action==='API_CLIENT_CREATED'));
  for (const client of [ca,cb,cp,cr]) {
    await call('POST',`/api-clients/${client.id}/revoke`,adminKey,{reason:'MVP acceptance cleanup revocation'});
    await call('GET','/credentials',client.apiKey,undefined,403);
  }
  await call('POST',`/api-clients/${ca.id}/revoke`,adminKey,{reason:'Duplicate revoke'},409);
  await call('POST',`/api-clients/${ca.id}/rotate`,adminKey,undefined,409);
  const {data:events,error}=await db.from('credential_events').select('credential_id,event_type,actor_type,api_client_id').in('credential_id',[c1.id,c2.id]);
  assert.equal(error,null);assert.equal(events.length,4);assert(events.every(e=>e.actor_type==='API_CLIENT'&&e.api_client_id===ca.id));
  const {data:importedCredentials,error:importError}=await db.from('credentials').select('id,import_batch_id').in('import_batch_id',fixtures.batches);
  assert.equal(importError,null);assert.equal(importedCredentials.length,4);
  const {data:clientState}=await db.from('api_clients').select('last_used_at,status').eq('id',ca.id).single();
  assert(clientState.last_used_at);assert.equal(clientState.status,'REVOKED');
  console.log(JSON.stringify({result:'PASS',httpChecks:checks,postgresChecks:['person concurrency/composite identity','rotation/revocation','credential events','import association/counters','audit atomic operations'],fixtures},null,2));
} catch (error) {
  // A failed assertion must not leave newly generated test clients active.
  for (const id of fixtures.clients) {
    try {
      const response = await fetch(`${base}/api-clients/${id}/revoke`, { method: 'POST',
        headers: { Authorization: `Bearer ${adminKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'MVP acceptance failed-run cleanup' }) });
      if (![200, 409].includes(response.status)) console.error(`Test client cleanup failed: ${id} (${response.status})`);
    } catch { console.error(`Test client cleanup could not reach API: ${id}`); }
  }
  console.error(JSON.stringify({result:'FAIL',httpChecks:checks,message:error.message,fixtures},null,2));
  process.exitCode=1;
}
