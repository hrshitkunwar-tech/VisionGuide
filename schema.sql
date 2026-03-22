-- Full VisionGuide database schema
-- Run this in your Supabase SQL Editor before starting the app.
-- Supabase Dashboard → SQL Editor → New query → paste and run.

-- Sessions table
create table if not exists public.sessions (
  session_id text primary key,
  last_seen_at timestamptz not null default now(),
  user_agent text
);

-- Screenshots table
create table if not exists public.screenshots (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.sessions(session_id) on delete cascade,
  image_url text,
  page_url text,
  page_title text,
  captured_at timestamptz not null default now()
);

-- Guidance events table
create table if not exists public.guidance_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.sessions(session_id) on delete cascade,
  instruction text,
  voice_text text,
  created_at timestamptz not null default now()
);

-- Reasoning events table
create table if not exists public.reasoning_events (
  id uuid primary key default gen_random_uuid(),
  session_id text not null references public.sessions(session_id) on delete cascade,
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

-- Performance indexes
create index if not exists reasoning_events_session_created_at_idx
  on public.reasoning_events (session_id, created_at desc);

-- Enable Supabase Realtime on all tables
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.screenshots;
alter publication supabase_realtime add table public.guidance_events;
alter publication supabase_realtime add table public.reasoning_events;

-- Public storage bucket for screenshot images
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict (id) do nothing;
