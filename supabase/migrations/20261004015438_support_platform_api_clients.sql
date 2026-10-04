
do $$ begin
  create type public.api_client_type as enum ('INSTITUTION', 'PLATFORM');
exception when duplicate_object then null;
end $$;

alter table public.api_clients
  add column if not exists client_type public.api_client_type not null default 'INSTITUTION';

alter table public.api_clients
  alter column institution_id drop not null;

alter table public.api_clients
  drop constraint if exists api_clients_type_institution_chk;

alter table public.api_clients
  add constraint api_clients_type_institution_chk
  check (
    (client_type = 'INSTITUTION' and institution_id is not null)
    or
    (client_type = 'PLATFORM' and institution_id is null)
  );

alter table public.api_clients
  drop constraint if exists api_clients_scopes_not_empty_chk;

alter table public.api_clients
  add constraint api_clients_scopes_not_empty_chk
  check (cardinality(scopes) > 0);

create index if not exists api_clients_client_type_idx
  on public.api_clients (client_type);
;
