import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const deps=createRequire(import.meta.url);
const directory=path.dirname(fileURLToPath(import.meta.url));
process.env.RAES_ADMIN_API_KEY='unit-test-admin-only';
const own='11111111-1111-4111-8111-111111111111';
const foreign='22222222-2222-4222-8222-222222222222';
const resource='33333333-3333-4333-8333-333333333333';
const key='raes_abcdef123456_unit-only';
function harness(options={}) {
  const client={id:own,name:'Unit institution',client_type:'INSTITUTION',institution_id:own,
    scopes:['credentials:read','credentials:write','credentials:revoke','programs:read','programs:write','persons:resolve','imports:read','imports:write'],
    key_prefix:'abcdef123456',key_hash:createHash('sha256').update(key).digest('hex'),status:'ACTIVE',expires_at:null,...options.client};
  const calls=[];
  const rows={api_clients:[client],credentials:[{id:resource,institution_id:options.foreign?foreign:own,person_id:own}],
    programs:[{id:resource,institution_id:options.foreign?foreign:own}],institutions:[{id:own},{id:foreign}],
    credential_import_batches:[{id:resource,institution_id:options.foreign?foreign:own}],persons:[],audit_logs:[],credential_types:[],document_types:[]};
  const db={from(table) {
    const call={table,filters:[],selection:null};calls.push(call);let mutation=null;
    const result=()=> {
      const found=rows[table].filter(row=>call.filters.every(([column,value])=>row[column]===value));
      if(mutation) found.forEach(row=>Object.assign(row,mutation));
      return {data:found,error:options.dbError??null,count:found.length};
    };
    const query={select(value){call.selection=value;return this;},eq(column,value){call.filters.push([column,value]);return this;},
      order(){return this;},range(from,to){call.range=[from,to];return this;},gte(){return this;},lte(){return this;},
      update(value){mutation=value;call.update=value;return this;},insert(value){call.insert=value;rows[table].push({id:resource,...value});return this;},
      async maybeSingle(){const r=result();return {...r,data:r.data[0]??null};},async single(){return this.maybeSingle();},
      then(resolve,reject){return Promise.resolve(result()).then(resolve,reject);}};
    return query;
  },async rpc(name,args) {
    calls.push({rpc:name,args});
    if(options.rpcError) return {data:null,error:{message:options.rpcError}};
    if(name==='resolve_person') return {data:{id:resource},error:null};
    if(name==='manage_core_resource'&&args.p_resource==='api_client') {
      if(args.p_operation==='rotate') Object.assign(client,args.p_data);
      if(args.p_operation==='revoke') client.status='REVOKED';
      return {data:{id:own,status:client.status,key_prefix:client.key_prefix},error:null};
    }
    return {data:{id:resource},error:null};
  }};
  const cache={};
  function load(file) {
    if(cache[file])return cache[file].exports;
    const mod={exports:{}};cache[file]=mod;
    const output=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    const localRequire=name=>name==='@/lib/supabase'?{supabase:db}:name.startsWith('@/')?load(path.resolve(directory,'../src',name.slice(2)+'.ts')):deps(name);
    new Function('require','module','exports',output)(localRequire,mod,mod.exports);return mod.exports;
  }
  async function invoke(endpoint,method='GET',body,authorization=key,query='') {
    const request=new Request(`http://localhost/api/v1/${endpoint}${query}`,{method,headers:authorization?{authorization:`Bearer ${authorization}`}:{},
      ...(body===undefined||method==='GET'?{}:{body:typeof body==='string'?body:JSON.stringify(body)})});
    const response=await load(path.resolve(directory,'../src/app/api/v1',endpoint,'route.ts'))[method](request,{params:Promise.resolve({id:options.id??resource})});
    return {status:response.status,body:await response.json()};
  }
  return {invoke,calls,rows,client};
}
const endpoints=[['credentials','GET'],['credentials/[id]','GET'],['persons','GET'],['persons','POST'],['persons/[id]','GET'],
  ['persons/resolve','POST'],['institutions','GET'],['institutions','POST'],['institutions/[id]','GET'],['institutions/[id]','PATCH'],
  ['programs','GET'],['programs','POST'],['programs/[id]','GET'],['programs/[id]','PATCH'],
  ['credential-types','GET'],['document-types','GET'],['api-clients','GET'],['api-clients','POST'],
  ['api-clients/[id]/rotate','POST'],['api-clients/[id]/revoke','POST'],['audit-logs','GET'],
  ['credential-import-batches','GET'],['credential-import-batches','POST'],['credential-import-batches/[id]','GET'],['credential-import-batches/[id]/credentials','POST']];
for(const [endpoint,method] of endpoints) test(`${method} ${endpoint}: unauthenticated denied before database access`,async()=>{
  const h=harness();const r=await h.invoke(endpoint,method,method==='GET'?undefined:{},null);
  assert.equal(r.status,401);assert.equal(h.calls.length,0);
});
for(const endpoint of ['persons','persons/[id]','api-clients','audit-logs'])test(`${endpoint}: institutions cannot enumerate administrative data`,async()=>{
  assert.equal((await harness().invoke(endpoint)).status,401);
  assert.equal((await harness({client:{client_type:'PLATFORM',institution_id:null}}).invoke(endpoint)).status,401);
});
for(const endpoint of ['credentials','programs','credential-import-batches'])test(`${endpoint}: authenticated institutional filter ignores spoofed institution`,async()=>{
  const h=harness();assert.equal((await h.invoke(endpoint,'GET',undefined,key,`?institutionId=${foreign}`)).status,200);
  const c=h.calls.find(c=>c.table===endpoint.replaceAll('-','_'));assert(c.filters.some(([column,value])=>column==='institution_id'&&value===own));
  assert(!c.filters.some(([column,value])=>column==='institution_id'&&value===foreign));assert.deepEqual(c.range,[0,19]);
});
for(const endpoint of ['credentials/[id]','programs/[id]','credential-import-batches/[id]'])test(`${endpoint}: foreign UUID concealed`,async()=>{
  assert.equal((await harness({foreign:true}).invoke(endpoint)).status,404);
});
for(const endpoint of ['credentials','programs','credential-import-batches','persons/resolve'])test(`${endpoint}: insufficient scope`,async()=>{
  const method=endpoint==='persons/resolve'?'POST':'GET';
  assert.equal((await harness({client:{scopes:[]}}).invoke(endpoint,method,{})).status,403);
});
test('PLATFORM credential list requires personId',async()=>{
  const h=harness({client:{client_type:'PLATFORM',institution_id:null}});
  const result=await h.invoke('credentials');assert.equal(result.status,400);assert.equal(result.body.error,'PLATFORM_PERSON_FILTER_REQUIRED');
  assert.equal((await h.invoke('credentials','GET',undefined,key,`?personId=${own}`)).status,200);
});
test('credential projection excludes sensitive identity fields',async()=>{
  const h=harness();await h.invoke('credentials/[id]');const projection=h.calls.find(c=>c.table==='credentials').selection;
  assert(!projection.includes('document_number'));assert(!projection.includes('document_type'));assert(!projection.includes('birth_date'));assert(!projection.includes('metadata'));
});
for(const query of ['?page=0','?page=x','?limit=101','?limit=1.5','?status=BAD','?personId=invalid','?issuedFrom=2026-02-30','?issuedFrom=2026-10-03&issuedUntil=2025-01-01'])test(`credential invalid filters ${query}`,async()=>{
  assert.equal((await harness().invoke('credentials','GET',undefined,key,query)).status,400);
});
test('person resolution normalizes type and returns ID only',async()=>{
  const h=harness();const r=await h.invoke('persons/resolve','POST',{documentType:'cc',documentNumber:'12345',firstNames:'Unit',lastNames:'Test'});
  assert.equal(r.status,200);assert.deepEqual(r.body.data,{id:resource});assert.equal(h.calls.find(c=>c.rpc).args.p_document_type,'CC');
});
test('program creation derives institution from client',async()=>{
  const h=harness();const r=await h.invoke('programs','POST',{name:'Unit program',institutionId:foreign});assert.equal(r.status,201);
  assert.equal(h.calls.find(c=>c.table==='programs').insert.institution_id,own);
});
test('program PATCH uses ownership in the UPDATE predicate',async()=>{
  const h=harness({foreign:true});assert.equal((await h.invoke('programs/[id]','PATCH',{name:'forged'})).status,404);
  const call=h.calls.find(c=>c.table==='programs');assert(call.filters.some(([column,value])=>column==='institution_id'&&value===own));
});
for(const endpoint of ['programs','programs/[id]','persons/resolve','credential-import-batches'])test(`PLATFORM cannot access ${endpoint}`,async()=>{
  const h=harness({client:{client_type:'PLATFORM',institution_id:null}});
  assert.equal((await h.invoke(endpoint,endpoint==='persons/resolve'?'POST':'GET',{})).status,403);
});
for(const endpoint of ['credentials/[id]','programs/[id]','credential-import-batches/[id]'])test(`${endpoint}: invalid UUID`,async()=>{
  assert.equal((await harness({id:'bad'}).invoke(endpoint)).status,400);
});
for(const [endpoint,authorization] of [['persons/resolve',key],['programs',key],['institutions','unit-test-admin-only'],['api-clients','unit-test-admin-only'],['credential-import-batches',key]])test(`${endpoint}: malformed/oversized JSON`,async()=>{
  const h=harness();assert.equal((await h.invoke(endpoint,'POST','{',authorization)).status,400);
  const large=await h.invoke(endpoint,'POST','x'.repeat(262145),authorization);assert.equal(large.status,400);assert.equal(large.body.error,'REQUEST_TOO_LARGE');
});
test('API client rotation invalidates old key and preserves client identity',async()=>{
  const h=harness();const rotated=await h.invoke('api-clients/[id]/rotate','POST',undefined,'unit-test-admin-only');
  assert.equal(rotated.status,200);assert.equal(rotated.body.data.id,own);assert.equal(rotated.body.data.key_hash,undefined);
  assert.equal((await h.invoke('credentials')).status,401);
  assert.equal((await h.invoke('credentials','GET',undefined,rotated.body.data.apiKey)).status,200);
});
test('API client revocation invalidates key',async()=>{
  const h=harness();assert.equal((await h.invoke('api-clients/[id]/revoke','POST',{reason:'Unit revocation'},'unit-test-admin-only')).status,200);
  assert.equal((await h.invoke('credentials')).status,403);
});
test('API client listing never selects key_hash',async()=>{
  const h=harness();await h.invoke('api-clients','GET',undefined,'unit-test-admin-only');assert(!h.calls.find(c=>c.table==='api_clients').selection.includes('key_hash'));
});
test('invalid PLATFORM scopes rejected',async()=>{
  const h=harness();assert.equal((await h.invoke('api-clients','POST',{name:'Unit platform',clientType:'PLATFORM',scopes:['persons:resolve']},'unit-test-admin-only')).status,400);
});
test('import processing requires credential write as well as import write',async()=>{
  const h=harness({client:{scopes:['imports:write']}});assert.equal((await h.invoke('credential-import-batches/[id]/credentials','POST',{records:[]})).status,403);
});
test('import processing rejects more than 50 records',async()=>{
  const h=harness();assert.equal((await h.invoke('credential-import-batches/[id]/credentials','POST',{records:Array(51).fill({})})).status,400);
});
test('unknown SQL details never leak to the consumer',async()=>{
  const h=harness({dbError:{message:'private database details',code:'XX000'}});const r=await h.invoke('programs');
  assert.equal(r.status,500);assert(!JSON.stringify(r.body).includes('private database details'));
});

test('API client create uses new scopes and returns key only at creation',async()=>{
  const h=harness();const r=await h.invoke('api-clients','POST',{name:'Unit client',clientType:'INSTITUTION',institutionId:own,
    scopes:['persons:resolve','programs:read','programs:write','imports:read','imports:write']},'unit-test-admin-only');
  assert.equal(r.status,201);assert(r.body.data.apiKey.startsWith('raes_'));assert.equal(r.body.data.key_hash,undefined);
  const args=h.calls.find(c=>c.rpc).args;assert.equal(args.p_resource,'api_client');assert.equal(args.p_operation,'create');
  assert(!('apiKey' in args.p_data));assert.equal(args.p_data.key_hash.length,64);
});
test('batch creation derives both institution and API client',async()=>{
  const h=harness();const r=await h.invoke('credential-import-batches','POST',{externalBatchId:'unit',institutionId:foreign,apiClientId:foreign});
  assert.equal(r.status,201);const values=h.calls.find(c=>c.table==='credential_import_batches').insert;
  assert.equal(values.institution_id,own);assert.equal(values.api_client_id,own);
});
test('invalid import row is reduced to a marker without retaining identity input',async()=>{
  const h=harness();const r=await h.invoke('credential-import-batches/[id]/credentials','POST',{records:[{personId:'invalid-sensitive-input'}]});
  assert.equal(r.status,200);assert.deepEqual(h.calls.find(c=>c.rpc).args.p_records,[{_validation_error:true}]);
});

test('rotate validates an optional body before changing the key',async()=>{
  const h=harness();assert.equal((await h.invoke('api-clients/[id]/rotate','POST','{','unit-test-admin-only')).status,400);
  assert(!h.calls.some(call=>call.rpc));
});

test('rotate accepts an empty request stream as well as an absent body',async()=>{
  const h=harness();assert.equal((await h.invoke('api-clients/[id]/rotate','POST','','unit-test-admin-only')).status,200);
});
