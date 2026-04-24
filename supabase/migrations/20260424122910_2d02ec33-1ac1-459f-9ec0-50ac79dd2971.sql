create table if not exists public.chunk_load_errors (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  public_id text,
  route text,
  deploy_version text,
  error_name text,
  error_message text,
  chunk_url text,
  user_agent text,
  viewport_width integer,
  viewport_height integer,
  online boolean,
  reporter_id uuid,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_chunk_load_errors_occurred_at on public.chunk_load_errors (occurred_at desc);
create index if not exists idx_chunk_load_errors_public_id on public.chunk_load_errors (public_id) where public_id is not null;
create index if not exists idx_chunk_load_errors_deploy_version on public.chunk_load_errors (deploy_version);

alter table public.chunk_load_errors enable row level security;

drop policy if exists "Anyone can insert chunk load errors" on public.chunk_load_errors;
create policy "Anyone can insert chunk load errors"
  on public.chunk_load_errors
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Admins can read chunk load errors" on public.chunk_load_errors;
create policy "Admins can read chunk load errors"
  on public.chunk_load_errors
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));