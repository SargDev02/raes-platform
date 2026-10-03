
drop function if exists public.create_credential(
  uuid, uuid, uuid, uuid, text, text, text, text, date, date, date,
  public.credential_source_type, uuid, text, text, jsonb
);

create function public.create_credential(
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
  uuid, uuid, uuid, text, date, uuid, text, text, text, date, date,
  public.credential_source_type, uuid, text, text, jsonb
) from public, anon, authenticated;

grant execute on function public.create_credential(
  uuid, uuid, uuid, text, date, uuid, text, text, text, date, date,
  public.credential_source_type, uuid, text, text, jsonb
) to service_role;
;
