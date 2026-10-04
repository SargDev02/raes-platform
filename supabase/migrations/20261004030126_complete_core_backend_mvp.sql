-- Preserve existing transactional credential functions; strengthen null-safe client checks.

create or replace function public.create_credential(
  p_institution_id uuid,
  p_person_id uuid,
  p_credential_type_id uuid,
  p_title text,
  p_issued_at date,
  p_program_id uuid default null,
  p_credential_number text default null,
  p_external_reference text default null,
  p_description text default null,
  p_valid_from date default null,
  p_valid_until date default null,
  p_source_type public.credential_source_type default 'INSTITUTION_API',
  p_registered_by_api_client_id uuid default null,
  p_registered_by_reference text default null,
  p_document_hash_sha256 text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.credentials
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_credential public.credentials;
  v_client public.api_clients;
begin
  if nullif(btrim(p_title), '') is null then
    raise exception 'CREDENTIAL_TITLE_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.institutions i
    where i.id = p_institution_id
      and i.status = 'ACTIVE'
  ) then
    raise exception 'INSTITUTION_NOT_ACTIVE';
  end if;

  if not exists (
    select 1
    from public.credential_types ct
    where ct.id = p_credential_type_id
      and ct.status = 'ACTIVE'
  ) then
    raise exception 'CREDENTIAL_TYPE_NOT_ACTIVE';
  end if;

  if p_program_id is not null and not exists (
    select 1
    from public.programs p
    where p.id = p_program_id
      and p.institution_id = p_institution_id
      and p.status = 'ACTIVE'
  ) then
    raise exception 'PROGRAM_NOT_ACTIVE_OR_NOT_IN_INSTITUTION';
  end if;

  if p_registered_by_api_client_id is not null then
    select *
    into v_client
    from public.api_clients
    where id = p_registered_by_api_client_id;

    if not found then
      raise exception 'API_CLIENT_NOT_FOUND';
    end if;

    if not ('credentials:write' = any(v_client.scopes)) then
      raise exception 'INSUFFICIENT_SCOPE';
    end if;

    if v_client.status <> 'ACTIVE' then
      raise exception 'API_CLIENT_NOT_ACTIVE';
    end if;

    if v_client.expires_at is not null and v_client.expires_at <= now() then
      raise exception 'API_CLIENT_EXPIRED';
    end if;

    if v_client.client_type <> 'INSTITUTION' or v_client.institution_id is distinct from p_institution_id then
      raise exception 'API_CLIENT_INSTITUTION_MISMATCH';
    end if;
  end if;

  insert into public.credentials (
    institution_id,
    person_id,
    program_id,
    credential_type_id,
    credential_number,
    external_reference,
    title,
    description,
    issued_at,
    valid_from,
    valid_until,
    source_type,
    registered_by_api_client_id,
    registered_by_reference,
    document_hash_sha256,
    metadata
  )
  values (
    p_institution_id,
    p_person_id,
    p_program_id,
    p_credential_type_id,
    nullif(btrim(p_credential_number), ''),
    nullif(btrim(p_external_reference), ''),
    btrim(p_title),
    nullif(btrim(p_description), ''),
    p_issued_at,
    p_valid_from,
    p_valid_until,
    p_source_type,
    p_registered_by_api_client_id,
    nullif(btrim(p_registered_by_reference), ''),
    nullif(btrim(p_document_hash_sha256), ''),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning * into v_credential;

  insert into public.credential_events (
    credential_id,
    event_type,
    previous_status,
    new_status,
    reason,
    actor_type,
    actor_reference,
    api_client_id,
    event_data
  )
  values (
    v_credential.id,
    'CREATED',
    null,
    v_credential.status,
    null,
    case
      when p_registered_by_api_client_id is not null then 'API_CLIENT'
      else 'SYSTEM'
    end,
    p_registered_by_reference,
    p_registered_by_api_client_id,
    jsonb_build_object('source_type', p_source_type)
  );

  return v_credential;
end;
$$;

create or replace function public.revoke_credential(
  p_credential_id uuid,
  p_reason text,
  p_actor_type text,
  p_actor_reference text default null,
  p_api_client_id uuid default null
)
returns public.credentials
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_previous_status public.credential_status;
  v_institution_id uuid;
  v_client public.api_clients;
  v_credential public.credentials;
begin
  if nullif(btrim(p_reason), '') is null then
    raise exception 'REVOCATION_REASON_REQUIRED';
  end if;

  select status, institution_id
  into v_previous_status, v_institution_id
  from public.credentials
  where id = p_credential_id
  for update;

  if not found then
    raise exception 'CREDENTIAL_NOT_FOUND';
  end if;

  if p_api_client_id is not null then
    select *
    into v_client
    from public.api_clients
    where id = p_api_client_id;

    if not found then
      raise exception 'API_CLIENT_NOT_FOUND';
    end if;

    if not ('credentials:revoke' = any(v_client.scopes)) then
      raise exception 'INSUFFICIENT_SCOPE';
    end if;

    if p_actor_type <> 'API_CLIENT' or p_actor_reference is distinct from v_client.name then
      raise exception 'INVALID_ACTOR';
    end if;

    if v_client.status <> 'ACTIVE' then
      raise exception 'API_CLIENT_NOT_ACTIVE';
    end if;

    if v_client.expires_at is not null and v_client.expires_at <= now() then
      raise exception 'API_CLIENT_EXPIRED';
    end if;

    if v_client.client_type <> 'INSTITUTION' or v_client.institution_id is distinct from v_institution_id then
      raise exception 'API_CLIENT_CREDENTIAL_MISMATCH';
    end if;
  end if;

  if v_previous_status = 'REVOKED' then
    raise exception 'CREDENTIAL_ALREADY_REVOKED';
  end if;

  if v_previous_status = 'VOIDED' then
    raise exception 'VOIDED_CREDENTIAL_CANNOT_BE_REVOKED';
  end if;

  update public.credentials
  set
    status = 'REVOKED',
    revoked_at = now(),
    revocation_reason = btrim(p_reason),
    voided_at = null,
    void_reason = null
  where id = p_credential_id
  returning * into v_credential;

  insert into public.credential_events (
    credential_id,
    event_type,
    previous_status,
    new_status,
    reason,
    actor_type,
    actor_reference,
    api_client_id
  )
  values (
    p_credential_id,
    'REVOKED',
    v_previous_status,
    'REVOKED',
    btrim(p_reason),
    btrim(p_actor_type),
    nullif(btrim(p_actor_reference), ''),
    p_api_client_id
  );

  return v_credential;
end;
$$;

create or replace function public.void_credential(
  p_credential_id uuid,
  p_reason text,
  p_actor_type text,
  p_actor_reference text default null,
  p_api_client_id uuid default null
)
returns public.credentials
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_previous_status public.credential_status;
  v_institution_id uuid;
  v_client public.api_clients;
  v_credential public.credentials;
begin
  if nullif(btrim(p_reason), '') is null then
    raise exception 'VOID_REASON_REQUIRED';
  end if;

  select status, institution_id
  into v_previous_status, v_institution_id
  from public.credentials
  where id = p_credential_id
  for update;

  if not found then
    raise exception 'CREDENTIAL_NOT_FOUND';
  end if;

  if p_api_client_id is not null then
    select *
    into v_client
    from public.api_clients
    where id = p_api_client_id;

    if not found then
      raise exception 'API_CLIENT_NOT_FOUND';
    end if;

    if not ('credentials:revoke' = any(v_client.scopes)) then
      raise exception 'INSUFFICIENT_SCOPE';
    end if;

    if p_actor_type <> 'API_CLIENT' or p_actor_reference is distinct from v_client.name then
      raise exception 'INVALID_ACTOR';
    end if;

    if v_client.status <> 'ACTIVE' then
      raise exception 'API_CLIENT_NOT_ACTIVE';
    end if;

    if v_client.expires_at is not null and v_client.expires_at <= now() then
      raise exception 'API_CLIENT_EXPIRED';
    end if;

    if v_client.client_type <> 'INSTITUTION' or v_client.institution_id is distinct from v_institution_id then
      raise exception 'API_CLIENT_CREDENTIAL_MISMATCH';
    end if;
  end if;

  if v_previous_status = 'VOIDED' then
    raise exception 'CREDENTIAL_ALREADY_VOIDED';
  end if;

  if v_previous_status = 'REVOKED' then
    raise exception 'REVOKED_CREDENTIAL_CANNOT_BE_VOIDED';
  end if;

  update public.credentials
  set
    status = 'VOIDED',
    voided_at = now(),
    void_reason = btrim(p_reason),
    revoked_at = null,
    revocation_reason = null
  where id = p_credential_id
  returning * into v_credential;

  insert into public.credential_events (
    credential_id,
    event_type,
    previous_status,
    new_status,
    reason,
    actor_type,
    actor_reference,
    api_client_id
  )
  values (
    p_credential_id,
    'VOIDED',
    v_previous_status,
    'VOIDED',
    btrim(p_reason),
    btrim(p_actor_type),
    nullif(btrim(p_actor_reference), ''),
    p_api_client_id
  );

  return v_credential;
end;
$$;
;

create or replace function public.resolve_person(
  p_document_type text, p_document_number text, p_first_names text,
  p_last_names text, p_birth_date date default null
) returns public.persons
language plpgsql security invoker set search_path = '' as $$
declare v_person public.persons;
begin
  if not exists (select 1 from public.document_types where code = p_document_type and status = 'ACTIVE') then
    raise exception 'INVALID_DOCUMENT_TYPE';
  end if;
  insert into public.persons(document_type, document_number, first_names, last_names, birth_date)
  values(p_document_type, p_document_number, p_first_names, p_last_names, p_birth_date)
  on conflict (document_type, document_number) do nothing
  returning * into v_person;
  if v_person.id is null then
    select * into strict v_person from public.persons
    where document_type = p_document_type and document_number = p_document_number;
  end if;
  return v_person;
end;
$$;

-- Only the server role can call audited administrative operations. JSON inputs are
-- explicitly mapped to permitted columns; no dynamic SQL or credential hashes in audit.
create or replace function public.manage_core_resource(
  p_resource text, p_operation text, p_data jsonb, p_id uuid default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_result jsonb; v_id uuid; v_action text;
begin
  if p_resource = 'institution' then
    if p_operation = 'create' then
      insert into public.institutions(name, nit, verification_digit, institution_type)
      values(p_data->>'name', p_data->>'nit', p_data->>'verification_digit', p_data->>'institution_type')
      returning to_jsonb(institutions.*), id into v_result, v_id;
    elsif p_operation = 'update' then
      update public.institutions set
        name = coalesce(p_data->>'name', name), nit = coalesce(p_data->>'nit', nit),
        verification_digit = coalesce(p_data->>'verification_digit', verification_digit),
        institution_type = coalesce(p_data->>'institution_type', institution_type),
        status = coalesce((p_data->>'status')::public.institution_status, status)
      where id = p_id returning to_jsonb(institutions.*), id into v_result, v_id;
    else raise exception 'INVALID_OPERATION'; end if;
  elsif p_resource = 'program' then
    if p_operation = 'create' then
      insert into public.programs(institution_id, name, code, snies_code, academic_level)
      values((p_data->>'institution_id')::uuid, p_data->>'name', p_data->>'code', p_data->>'snies_code', p_data->>'academic_level')
      returning to_jsonb(programs.*), id into v_result, v_id;
    elsif p_operation = 'update' then
      update public.programs set name = coalesce(p_data->>'name', name),
        code = case when p_data ? 'code' then p_data->>'code' else code end,
        snies_code = case when p_data ? 'snies_code' then p_data->>'snies_code' else snies_code end,
        academic_level = case when p_data ? 'academic_level' then p_data->>'academic_level' else academic_level end,
        status = coalesce((p_data->>'status')::public.program_status, status)
      where id = p_id returning to_jsonb(programs.*), id into v_result, v_id;
    else raise exception 'INVALID_OPERATION'; end if;
  elsif p_resource = 'person' and p_operation = 'create' then
    insert into public.persons(document_type, document_number, first_names, last_names, birth_date)
    values(p_data->>'document_type', p_data->>'document_number', p_data->>'first_names', p_data->>'last_names', (p_data->>'birth_date')::date)
    returning to_jsonb(persons.*), id into v_result, v_id;
  elsif p_resource = 'api_client' then
    if p_operation = 'create' then
      if p_data->>'client_type' = 'INSTITUTION' and not exists (
        select 1 from public.institutions where id = (p_data->>'institution_id')::uuid and status = 'ACTIVE'
      ) then raise exception 'INSTITUTION_NOT_ACTIVE'; end if;
      insert into public.api_clients(name, client_type, institution_id, key_prefix, key_hash, scopes, expires_at)
      values(p_data->>'name', (p_data->>'client_type')::public.api_client_type, (p_data->>'institution_id')::uuid,
        p_data->>'key_prefix', p_data->>'key_hash', array(select jsonb_array_elements_text(p_data->'scopes')),
        (p_data->>'expires_at')::timestamptz)
      returning to_jsonb(api_clients.*), id into v_result, v_id;
    elsif p_operation in ('rotate','revoke') then
      select to_jsonb(c.*), c.id into v_result, v_id from public.api_clients c where c.id = p_id for update;
      if v_id is null then raise exception 'RESOURCE_NOT_FOUND'; end if;
      if v_result->>'status' = 'REVOKED' then raise exception 'API_CLIENT_ALREADY_REVOKED'; end if;
      if p_operation = 'rotate' then
        if v_result->>'status' <> 'ACTIVE' or (v_result->>'expires_at')::timestamptz <= now() then
          raise exception 'API_CLIENT_NOT_ACTIVE';
        end if;
        update public.api_clients set key_hash = p_data->>'key_hash', key_prefix = p_data->>'key_prefix'
        where id = p_id returning to_jsonb(api_clients.*) into v_result;
      else
        update public.api_clients set status = 'REVOKED', revoked_at = now(), revocation_reason = p_data->>'reason'
        where id = p_id returning to_jsonb(api_clients.*) into v_result;
      end if;
    else raise exception 'INVALID_OPERATION'; end if;
    v_result := v_result - 'key_hash';
  else raise exception 'INVALID_OPERATION'; end if;
  if v_id is null then raise exception 'RESOURCE_NOT_FOUND'; end if;
  v_action := upper(p_resource) || '_' || case p_operation
    when 'create' then 'CREATED' when 'update' then 'UPDATED' when 'rotate' then 'KEY_ROTATED' else 'REVOKED' end;
  insert into public.audit_logs(actor_type, actor_reference, action, resource_type, resource_id, metadata)
  values('ADMIN', 'RAES_ADMIN_API_KEY', v_action, p_resource, v_id::text,
    jsonb_build_object('operation', p_operation));
  return v_result;
end;
$$;

create or replace function public.process_credential_import(
  p_batch_id uuid, p_api_client_id uuid, p_records jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_batch public.credential_import_batches; v_client public.api_clients;
  v_record jsonb; v_credential public.credentials; v_index integer := 0;
  v_success integer := 0; v_errors jsonb := '[]'::jsonb; v_results jsonb := '[]'::jsonb;
  v_code text;
begin
  if jsonb_typeof(p_records) is distinct from 'array' or jsonb_array_length(p_records) not between 1 and 50 then
    raise exception 'INVALID_IMPORT_RECORDS';
  end if;
  select * into v_client from public.api_clients where id = p_api_client_id for share;
  if not found or v_client.client_type <> 'INSTITUTION' or v_client.status <> 'ACTIVE'
    or (v_client.expires_at is not null and v_client.expires_at <= now()) then
    raise exception 'API_CLIENT_NOT_ACTIVE';
  end if;
  if not ('imports:write' = any(v_client.scopes)) or not ('credentials:write' = any(v_client.scopes)) then
    raise exception 'INSUFFICIENT_SCOPE';
  end if;
  select * into v_batch from public.credential_import_batches where id = p_batch_id for update;
  if not found then raise exception 'RESOURCE_NOT_FOUND'; end if;
  if v_batch.institution_id is distinct from v_client.institution_id then raise exception 'CREDENTIAL_ACCESS_DENIED'; end if;
  if v_batch.status <> 'PENDING' then raise exception 'IMPORT_ALREADY_PROCESSED'; end if;
  update public.credential_import_batches set status = 'PROCESSING', started_at = now(),
    total_records = jsonb_array_length(p_records) where id = p_batch_id;
  for v_record in select value from jsonb_array_elements(p_records) loop
    v_index := v_index + 1;
    begin
      v_credential := public.create_credential(
        p_institution_id => v_client.institution_id,
        p_person_id => (v_record->>'personId')::uuid,
        p_credential_type_id => (v_record->>'credentialTypeId')::uuid,
        p_title => v_record->>'title', p_issued_at => (v_record->>'issuedAt')::date,
        p_program_id => (v_record->>'programId')::uuid,
        p_credential_number => v_record->>'credentialNumber', p_external_reference => v_record->>'externalReference',
        p_description => v_record->>'description', p_valid_from => (v_record->>'validFrom')::date,
        p_valid_until => (v_record->>'validUntil')::date,
        p_registered_by_api_client_id => v_client.id, p_registered_by_reference => v_client.name,
        p_document_hash_sha256 => v_record->>'documentHashSha256',
        p_metadata => coalesce(v_record->'metadata', '{}'::jsonb)
      );
      update public.credentials set import_batch_id = p_batch_id where id = v_credential.id;
      v_success := v_success + 1;
      v_results := v_results || jsonb_build_array(jsonb_build_object('row',v_index,'id',v_credential.id));
    exception when others then
      -- Persist only index and stable code, never input PII or raw SQL messages.
      v_code := case
        when SQLSTATE = '23505' then 'CREDENTIAL_ALREADY_EXISTS'
        when SQLSTATE = '23503' then 'RELATED_RESOURCE_NOT_FOUND'
        when SQLSTATE in ('23514','23502','22P02','22007','22008') then 'INVALID_CREDENTIAL_DATA'
        when SQLERRM in ('INSTITUTION_NOT_ACTIVE','CREDENTIAL_TYPE_NOT_ACTIVE','PROGRAM_NOT_ACTIVE_OR_NOT_IN_INSTITUTION',
          'CREDENTIAL_TITLE_REQUIRED','API_CLIENT_NOT_ACTIVE','API_CLIENT_EXPIRED','INSUFFICIENT_SCOPE') then SQLERRM
        else 'RECORD_PROCESSING_ERROR' end;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row',v_index,'error',v_code));
    end;
  end loop;
  update public.credential_import_batches set success_count = v_success,
    failure_count = v_index - v_success, completed_at = now(), error_summary = jsonb_build_object('rows',v_errors),
    status = case when v_success = v_index then 'COMPLETED'::public.import_batch_status
      when v_success = 0 then 'FAILED'::public.import_batch_status else 'PARTIAL'::public.import_batch_status end
  where id = p_batch_id returning * into v_batch;
  return jsonb_build_object('batch',to_jsonb(v_batch),'results',v_results,'errors',v_errors);
end;
$$;

revoke all on function public.resolve_person(text,text,text,text,date) from public, anon, authenticated;
grant execute on function public.resolve_person(text,text,text,text,date) to service_role;
revoke all on function public.manage_core_resource(text,text,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.manage_core_resource(text,text,jsonb,uuid) to service_role;
revoke all on function public.process_credential_import(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.process_credential_import(uuid,uuid,jsonb) to service_role;

create index if not exists audit_logs_action_created_idx on public.audit_logs(action, created_at desc);
