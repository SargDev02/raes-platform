
-- RAES Core - consolidated domain schema

-- 1) Internal helper schema
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- 2) Enumerated states
do $$ begin
  create type public.catalog_status as enum ('ACTIVE', 'INACTIVE');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.program_status as enum ('ACTIVE', 'INACTIVE', 'SUSPENDED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.credential_status as enum ('ACTIVE', 'REVOKED', 'VOIDED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.api_client_status as enum ('ACTIVE', 'SUSPENDED', 'REVOKED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.credential_source_type as enum ('INSTITUTION_API', 'ADMIN', 'MIGRATION', 'SYSTEM');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.credential_event_type as enum ('CREATED', 'UPDATED', 'REVOKED', 'VOIDED', 'SYNCED');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.import_batch_status as enum ('PENDING', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED');
exception when duplicate_object then null;
end $$;

-- 3) Catalogs
create table if not exists public.document_types (
  code text primary key,
  name text not null,
  description text,
  status public.catalog_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.document_types (code, name)
values
  ('CC', 'Cédula de ciudadanía'),
  ('CE', 'Cédula de extranjería'),
  ('TI', 'Tarjeta de identidad'),
  ('RC', 'Registro civil'),
  ('PA', 'Pasaporte'),
  ('PPT', 'Permiso por Protección Temporal'),
  ('PEP', 'Permiso Especial de Permanencia')
on conflict (code) do nothing;

create table if not exists public.credential_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  status public.catalog_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.credential_types (code, name, description)
values
  ('DEGREE', 'Título académico', 'Título o grado académico otorgado por una institución.'),
  ('CERTIFICATE', 'Certificado', 'Certificado académico o de formación.'),
  ('COURSE', 'Curso', 'Credencial asociada a la aprobación o participación en un curso.'),
  ('DIPLOMA', 'Diplomado', 'Credencial asociada a un diplomado.'),
  ('CONSTANCIA', 'Constancia', 'Constancia académica emitida por una institución.')
on conflict (code) do nothing;

-- 4) Extend existing master tables
alter table public.institutions
  add column if not exists official_code text,
  add column if not exists official_code_type text,
  add column if not exists contact_email text,
  add column if not exists website_url text,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.persons
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- Document type catalog relation, preserving the existing composite identity uniqueness.
do $$ begin
  alter table public.persons
    add constraint persons_document_type_fk
    foreign key (document_type) references public.document_types(code)
    on update cascade on delete restrict;
exception when duplicate_object then null;
end $$;

-- 5) Academic programs
create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  code text,
  snies_code text,
  name text not null,
  academic_level text,
  status public.program_status not null default 'ACTIVE',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists programs_institution_code_uq
  on public.programs (institution_id, code)
  where code is not null;

create unique index if not exists programs_snies_code_uq
  on public.programs (snies_code)
  where snies_code is not null;

create index if not exists programs_institution_idx
  on public.programs (institution_id);

create index if not exists programs_status_idx
  on public.programs (status);

-- 6) Institutional API clients / integrations
create table if not exists public.api_clients (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  name text not null,
  key_prefix text not null unique,
  key_hash text not null unique,
  scopes text[] not null default '{}'::text[],
  status public.api_client_status not null default 'ACTIVE',
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint api_clients_revoked_fields_chk check (
    status <> 'REVOKED'
    or (revoked_at is not null and nullif(btrim(revocation_reason), '') is not null)
  )
);

create index if not exists api_clients_institution_idx
  on public.api_clients (institution_id);

create index if not exists api_clients_status_idx
  on public.api_clients (status);

-- 7) Batch imports / synchronization runs
create table if not exists public.credential_import_batches (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  api_client_id uuid references public.api_clients(id) on delete restrict,
  external_batch_id text,
  status public.import_batch_status not null default 'PENDING',
  total_records integer not null default 0 check (total_records >= 0),
  success_count integer not null default 0 check (success_count >= 0),
  failure_count integer not null default 0 check (failure_count >= 0),
  started_at timestamptz,
  completed_at timestamptz,
  error_summary jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists credential_import_batches_external_uq
  on public.credential_import_batches (institution_id, external_batch_id)
  where external_batch_id is not null;

create index if not exists credential_import_batches_institution_idx
  on public.credential_import_batches (institution_id, created_at desc);

create index if not exists credential_import_batches_status_idx
  on public.credential_import_batches (status);

-- 8) Credentials - RAES source of truth
create table if not exists public.credentials (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete restrict,
  person_id uuid not null references public.persons(id) on delete restrict,
  program_id uuid references public.programs(id) on delete restrict,
  credential_type_id uuid not null references public.credential_types(id) on delete restrict,
  import_batch_id uuid references public.credential_import_batches(id) on delete restrict,

  credential_number text,
  external_reference text,
  title text not null,
  description text,

  issued_at date not null,
  valid_from date,
  valid_until date,

  status public.credential_status not null default 'ACTIVE',

  source_type public.credential_source_type not null default 'INSTITUTION_API',
  registered_by_api_client_id uuid references public.api_clients(id) on delete restrict,
  registered_by_reference text,
  registered_at_raes timestamptz not null default now(),

  document_hash_sha256 text,

  revoked_at timestamptz,
  revocation_reason text,
  voided_at timestamptz,
  void_reason text,

  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint credentials_valid_dates_chk check (
    valid_until is null or valid_from is null or valid_until >= valid_from
  ),
  constraint credentials_revoked_fields_chk check (
    status <> 'REVOKED'
    or (revoked_at is not null and nullif(btrim(revocation_reason), '') is not null)
  ),
  constraint credentials_voided_fields_chk check (
    status <> 'VOIDED'
    or (voided_at is not null and nullif(btrim(void_reason), '') is not null)
  ),
  constraint credentials_sha256_chk check (
    document_hash_sha256 is null
    or document_hash_sha256 ~ '^[A-Fa-f0-9]{64}$'
  )
);

create unique index if not exists credentials_institution_number_uq
  on public.credentials (institution_id, credential_number)
  where credential_number is not null;

create unique index if not exists credentials_external_reference_uq
  on public.credentials (institution_id, external_reference)
  where external_reference is not null;

create index if not exists credentials_person_idx
  on public.credentials (person_id, issued_at desc);

create index if not exists credentials_institution_idx
  on public.credentials (institution_id, issued_at desc);

create index if not exists credentials_program_idx
  on public.credentials (program_id)
  where program_id is not null;

create index if not exists credentials_type_idx
  on public.credentials (credential_type_id);

create index if not exists credentials_status_idx
  on public.credentials (status);

-- 9) Credential history / traceability
create table if not exists public.credential_events (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references public.credentials(id) on delete restrict,
  event_type public.credential_event_type not null,
  previous_status public.credential_status,
  new_status public.credential_status,
  reason text,
  actor_type text not null,
  actor_reference text,
  api_client_id uuid references public.api_clients(id) on delete restrict,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists credential_events_credential_idx
  on public.credential_events (credential_id, created_at desc);

create index if not exists credential_events_created_at_idx
  on public.credential_events (created_at desc);

-- 10) Generic audit trail
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null,
  actor_reference text,
  action text not null,
  resource_type text not null,
  resource_id text,
  request_id text,
  ip_address inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_resource_idx
  on public.audit_logs (resource_type, resource_id, created_at desc);

create index if not exists audit_logs_actor_idx
  on public.audit_logs (actor_type, actor_reference, created_at desc);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs (created_at desc);

-- 11) Database-managed updated_at
create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
grant execute on function private.set_updated_at() to service_role;

drop trigger if exists institutions_set_updated_at on public.institutions;
create trigger institutions_set_updated_at
before update on public.institutions
for each row execute function private.set_updated_at();

drop trigger if exists persons_set_updated_at on public.persons;
create trigger persons_set_updated_at
before update on public.persons
for each row execute function private.set_updated_at();

drop trigger if exists document_types_set_updated_at on public.document_types;
create trigger document_types_set_updated_at
before update on public.document_types
for each row execute function private.set_updated_at();

drop trigger if exists credential_types_set_updated_at on public.credential_types;
create trigger credential_types_set_updated_at
before update on public.credential_types
for each row execute function private.set_updated_at();

drop trigger if exists programs_set_updated_at on public.programs;
create trigger programs_set_updated_at
before update on public.programs
for each row execute function private.set_updated_at();

drop trigger if exists api_clients_set_updated_at on public.api_clients;
create trigger api_clients_set_updated_at
before update on public.api_clients
for each row execute function private.set_updated_at();

drop trigger if exists credential_import_batches_set_updated_at on public.credential_import_batches;
create trigger credential_import_batches_set_updated_at
before update on public.credential_import_batches
for each row execute function private.set_updated_at();

drop trigger if exists credentials_set_updated_at on public.credentials;
create trigger credentials_set_updated_at
before update on public.credentials
for each row execute function private.set_updated_at();

-- 12) RLS + least privilege on exposed public schema
alter table public.institutions enable row level security;
alter table public.persons enable row level security;
alter table public.document_types enable row level security;
alter table public.credential_types enable row level security;
alter table public.programs enable row level security;
alter table public.api_clients enable row level security;
alter table public.credential_import_batches enable row level security;
alter table public.credentials enable row level security;
alter table public.credential_events enable row level security;
alter table public.audit_logs enable row level security;

revoke all on table
  public.institutions,
  public.persons,
  public.document_types,
  public.credential_types,
  public.programs,
  public.api_clients,
  public.credential_import_batches,
  public.credentials,
  public.credential_events,
  public.audit_logs
from anon, authenticated;

grant select, insert, update, delete on table
  public.institutions,
  public.persons,
  public.document_types,
  public.credential_types,
  public.programs,
  public.api_clients,
  public.credential_import_batches,
  public.credentials,
  public.credential_events,
  public.audit_logs
to service_role;
;
