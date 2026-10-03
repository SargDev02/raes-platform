create table public.persons (
  id uuid primary key default gen_random_uuid(),

  document_type text not null,
  document_number text not null,

  first_names text not null,
  last_names text not null,

  birth_date date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint persons_document_unique
    unique (document_type, document_number)
);
alter table public.persons enable row level security;
revoke all on table public.persons from anon, authenticated;
grant all on table public.persons to service_role;
