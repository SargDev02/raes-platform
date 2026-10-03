
create index if not exists credential_events_api_client_idx
  on public.credential_events (api_client_id)
  where api_client_id is not null;

create index if not exists credential_import_batches_api_client_idx
  on public.credential_import_batches (api_client_id)
  where api_client_id is not null;

create index if not exists credentials_import_batch_idx
  on public.credentials (import_batch_id)
  where import_batch_id is not null;

create index if not exists credentials_registered_by_api_client_idx
  on public.credentials (registered_by_api_client_id)
  where registered_by_api_client_id is not null;
;
