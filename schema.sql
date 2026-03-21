create table if not exists public.reasoning_events (
  id uuid primary key,
  session_id text not null references public.sessions (session_id) on delete cascade,
  actor text not null,
  stage text not null,
  status text not null,
  summary text not null,
  details jsonb,
  confidence double precision,
  latency_ms integer,
  artifact_ref text,
  created_at timestamptz not null default now()
);

create index if not exists reasoning_events_session_created_at_idx
  on public.reasoning_events (session_id, created_at desc);

alter publication supabase_realtime add table public.reasoning_events;
