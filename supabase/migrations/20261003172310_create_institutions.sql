create type institution_status as enum (
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED'
);

create table public.institutions (
  id uuid primary key default gen_random_uuid(),

  name text not null,

  nit text not null unique,

  verification_digit varchar(1),

  institution_type text,

  status institution_status not null default 'ACTIVE',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.institutions enable row level security;

revoke all on table public.institutions from anon, authenticated;

grant all on table public.institutions to service_role;