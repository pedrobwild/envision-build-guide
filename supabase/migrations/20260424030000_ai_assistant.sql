-- =====================================================================
-- AI Assistant – schema, pgvector e RPCs
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ---------------------------------------------------------------------
-- Conversas
-- ---------------------------------------------------------------------
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Nova conversa',
  pinned boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_conversations_user_idx
  on public.ai_conversations(user_id, updated_at desc);

-- ---------------------------------------------------------------------
-- Mensagens
-- ---------------------------------------------------------------------
create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool', 'system')),
  content text not null default '',
  tool_calls jsonb,
  tool_name text,
  citations jsonb,
  tokens_in int,
  tokens_out int,
  model text,
  created_at timestamptz not null default now()
);

create index if not exists ai_messages_conversation_idx
  on public.ai_messages(conversation_id, created_at asc);

-- ---------------------------------------------------------------------
-- Embeddings (RAG)
-- ---------------------------------------------------------------------
create table if not exists public.ai_embeddings (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,          -- budget | client | lead | catalog | insight | doc
  source_id text not null,
  chunk_index int not null default 0,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_type, source_id, chunk_index)
);

create index if not exists ai_embeddings_source_idx
  on public.ai_embeddings(source_type, source_id);

-- IVFFLAT exige ANALYZE; criamos só se ainda não existir.
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'ai_embeddings_embedding_idx'
  ) then
    execute 'create index ai_embeddings_embedding_idx
             on public.ai_embeddings using ivfflat (embedding vector_cosine_ops)
             with (lists = 100)';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- updated_at trigger helper
-- ---------------------------------------------------------------------
create or replace function public.ai_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ai_conversations_touch on public.ai_conversations;
create trigger ai_conversations_touch
before update on public.ai_conversations
for each row execute function public.ai_touch_updated_at();

drop trigger if exists ai_embeddings_touch on public.ai_embeddings;
create trigger ai_embeddings_touch
before update on public.ai_embeddings
for each row execute function public.ai_touch_updated_at();

-- Atualiza conversa quando mensagem é inserida
create or replace function public.ai_bump_conversation()
returns trigger
language plpgsql
as $$
begin
  update public.ai_conversations
     set updated_at = now()
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists ai_messages_bump on public.ai_messages;
create trigger ai_messages_bump
after insert on public.ai_messages
for each row execute function public.ai_bump_conversation();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_embeddings enable row level security;

drop policy if exists ai_conversations_select on public.ai_conversations;
create policy ai_conversations_select
  on public.ai_conversations for select
  using (auth.uid() = user_id);

drop policy if exists ai_conversations_mod on public.ai_conversations;
create policy ai_conversations_mod
  on public.ai_conversations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists ai_messages_select on public.ai_messages;
create policy ai_messages_select
  on public.ai_messages for select
  using (auth.uid() = user_id);

drop policy if exists ai_messages_insert on public.ai_messages;
create policy ai_messages_insert
  on public.ai_messages for insert
  with check (auth.uid() = user_id);

-- Embeddings: leitura autenticada, escrita apenas via service role
drop policy if exists ai_embeddings_select on public.ai_embeddings;
create policy ai_embeddings_select
  on public.ai_embeddings for select
  using (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------
-- RPC: busca semântica
-- ---------------------------------------------------------------------
create or replace function public.ai_match_embeddings(
  query_embedding vector(1536),
  match_count int default 8,
  source_types text[] default null,
  min_similarity float default 0.72
)
returns table (
  id uuid,
  source_type text,
  source_id text,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.id,
    e.source_type,
    e.source_id,
    e.content,
    e.metadata,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.ai_embeddings e
  where e.embedding is not null
    and (source_types is null or e.source_type = any(source_types))
    and 1 - (e.embedding <=> query_embedding) >= min_similarity
  order by e.embedding <=> query_embedding
  limit greatest(1, least(match_count, 50));
$$;

grant execute on function public.ai_match_embeddings(vector, int, text[], float)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- RPC: resumo operacional rápido (usado pelo tool get_operations_metrics)
-- ---------------------------------------------------------------------
create or replace function public.ai_operations_summary(
  since_days int default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  with base as (
    select
      count(*) filter (where b.status is not null) as total_budgets,
      count(*) filter (where b.status = 'approved') as approved,
      count(*) filter (where b.status = 'pending') as pending,
      count(*) filter (where b.status = 'rejected') as rejected,
      coalesce(sum(b.total_value) filter (where b.status = 'approved'), 0) as revenue_approved
    from public.budgets b
    where b.created_at >= now() - (since_days || ' days')::interval
  )
  select jsonb_build_object(
    'since_days', since_days,
    'total_budgets', coalesce(total_budgets, 0),
    'approved', coalesce(approved, 0),
    'pending', coalesce(pending, 0),
    'rejected', coalesce(rejected, 0),
    'revenue_approved', coalesce(revenue_approved, 0),
    'generated_at', now()
  )
  into result
  from base;

  return coalesce(result, jsonb_build_object('since_days', since_days, 'error', 'no_data'));
exception when undefined_table or undefined_column then
  return jsonb_build_object(
    'since_days', since_days,
    'warning', 'schema_mismatch',
    'message', 'ai_operations_summary: tabela budgets ausente ou colunas diferentes'
  );
end;
$$;

grant execute on function public.ai_operations_summary(int)
  to authenticated, service_role;
