-- Isolate structurally invalid records without persisting their input.
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
      if v_record->>'_validation_error' = 'true' then
        raise exception 'INVALID_CREDENTIAL_DATA';
      end if;
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
          'INVALID_CREDENTIAL_DATA','CREDENTIAL_TITLE_REQUIRED','API_CLIENT_NOT_ACTIVE','API_CLIENT_EXPIRED','INSUFFICIENT_SCOPE') then SQLERRM
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

