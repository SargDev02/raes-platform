
create or replace function public.create_credential(
  p_institution_id uuid,
  p_person_id uuid,
  p_program_id uuid,
  p_credential_type_id uuid,
  p_credential_number text,
  p_external_reference text,
  p_title text,
  p_description text,
  p_issued_at date,
  p_valid_from date,
  p_valid_until date,
  p_source_type public.credential_source_type,
  p_registered_by_api_client_id uuid,
  p_registered_by_reference text,
  p_document_hash_sha256 text,
  p_metadata jsonb default '{}'::jsonb
)
returns public.credentials
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_credential public.credentials;
begin
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

revoke execute on function public.create_credential(
  uuid, uuid, uuid, uuid, text, text, text, text, date, date, date,
  public.credential_source_type, uuid, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.create_credential(
  uuid, uuid, uuid, uuid, text, text, text, text, date, date, date,
  public.credential_source_type, uuid, text, text, jsonb
) to service_role;

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
  v_credential public.credentials;
begin
  if nullif(btrim(p_reason), '') is null then
    raise exception 'REVOCATION_REASON_REQUIRED';
  end if;

  select status
  into v_previous_status
  from public.credentials
  where id = p_credential_id
  for update;

  if not found then
    raise exception 'CREDENTIAL_NOT_FOUND';
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

revoke execute on function public.revoke_credential(uuid, text, text, text, uuid)
from public, anon, authenticated;
grant execute on function public.revoke_credential(uuid, text, text, text, uuid)
to service_role;

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
  v_credential public.credentials;
begin
  if nullif(btrim(p_reason), '') is null then
    raise exception 'VOID_REASON_REQUIRED';
  end if;

  select status
  into v_previous_status
  from public.credentials
  where id = p_credential_id
  for update;

  if not found then
    raise exception 'CREDENTIAL_NOT_FOUND';
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

revoke execute on function public.void_credential(uuid, text, text, text, uuid)
from public, anon, authenticated;
grant execute on function public.void_credential(uuid, text, text, text, uuid)
to service_role;
;
