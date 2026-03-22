# VisionGuide

Screenshot-grounded UI guidance — captures what the user sees, routes it through Gemini vision, and renders real-time guidance overlays in the browser. Every decision is logged to a structured reasoning timeline in Supabase.

## What It Does

1. The Chrome extension captures the user's screen on `Ctrl+Shift+S`
2. The screenshot is sent to the Express backend → uploaded to Supabase Storage
3. Gemini vision analyzes the screenshot and generates structured guidance
4. The React dashboard replays the full session in real-time: screenshots, guidance, and a reasoning timeline with confidence scores per Gemini call

## Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Dashboard   | React 19 + Vite 6 + TypeScript    |
| Icons / UI  | Lucide React + Tailwind CSS (CDN) |
| AI          | Google Gemini (`@google/genai`)   |
| Database    | Supabase (Postgres + Realtime)    |
| Backend     | Express (TypeScript)              |
| Extension   | Chrome MV3 extension              |
| Packaging   | JSZip + FileSaver                 |

## Local Setup

### 1. Clone & install

```bash
git clone https://github.com/hrshitkunwar-tech/VisionGuide.git
cd VisionGuide
npm install
```

### 2. Create your `.env.local`

```bash
cp .env.example .env.local
```

Then fill in the three required values:

```env
GEMINI_API_KEY=your_gemini_api_key_here
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

> **Get your keys (both free):**
> - **Gemini API key** → [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
> - **Supabase URL + Anon key** → [supabase.com/dashboard](https://supabase.com/dashboard) → Project Settings → API

### 3. Apply the database schema

In your Supabase project, open the [SQL Editor](https://supabase.com/dashboard/project/_/sql/new) and run:

```sql
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

-- Indexes for performance
create index if not exists reasoning_events_session_created_at_idx
  on public.reasoning_events (session_id, created_at desc);

-- Enable Supabase Realtime on all tables
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.screenshots;
alter publication supabase_realtime add table public.guidance_events;
alter publication supabase_realtime add table public.reasoning_events;

-- Public screenshot storage bucket
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict (id) do nothing;
```

### 4. Start the dashboard

```bash
npm run dev
# → http://localhost:5173
```

### 5. Start the backend (separate terminal)

```bash
npx ts-node server/server.ts
# → http://localhost:3000
```

### 6. Load the Chrome extension

1. In the dashboard, click **EXPORT EXTENSION** → a `.zip` file downloads
2. Unzip it
3. Open `chrome://extensions` → enable **Developer mode**
4. Click **Load unpacked** → select the unzipped folder
5. On any webpage, press **`Ctrl+Shift+S`** to capture and trigger the guidance loop

---

## Key Files

| File | Purpose |
|---|---|
| `App.tsx` | Operator dashboard — sessions, guidance, reasoning timeline |
| `vite.config.ts` | Vite config — env var injection via `define` |
| `server/server.ts` | Express backend — screenshot upload, Gemini API calls |
| `extension/` | Chrome extension — screen capture and overlay logic |
| `types.ts` | Shared types: `Session`, `Screenshot`, `GuidanceEvent`, `ReasoningEvent` |
| `schema.sql` | Supabase table for reasoning events (see full schema above) |
| `.env.example` | Template for environment variables |

---

## How the env vars work

Vite doesn't expose Node-style `process.env.*` to the browser by default. `vite.config.ts` uses `loadEnv` to read `.env.local` and injects the values at build time via Vite's `define` option:

```ts
define: {
  'process.env.SUPABASE_URL':     JSON.stringify(env.SUPABASE_URL),
  'process.env.SUPABASE_ANON_KEY': JSON.stringify(env.SUPABASE_ANON_KEY),
  'process.env.API_KEY':           JSON.stringify(env.GEMINI_API_KEY),
}
```

The backend reads the same variables via `process.env` normally (Node.js).

---

## Without credentials (demo mode)

The app boots without credentials and falls back to a synthetic reasoning feed — useful for exploring the UI. The dashboard renders fully; Supabase-dependent features (realtime session list, stored screenshots) show empty states.

---

## Why This Matters

Every Gemini call is logged as a structured reasoning event. The dashboard replays the full decision timeline — which screenshot triggered what guidance, with confidence scores at each step. That's the thing most AI demos skip: not just *what* the model did, but *why*, in sequence, auditable after the fact.

---

## Navigator Lab

Part of the Navigator Lab — an open research portfolio exploring AI-native software interaction.

| Repo | Layer | What it does |
|---|---|---|
| [navigator](https://github.com/hrshitkunwar-tech/navigator) | Thesis | 5-layer architecture for AI execution on software interfaces |
| [VisionGuide](https://github.com/hrshitkunwar-tech/VisionGuide) | Perception | Screenshot → Gemini vision → real-time UI guidance |
| [job](https://github.com/hrshitkunwar-tech/job) | Applied | CareerAgent: score → tailor → apply, local-first |
| [saas-atlas](https://github.com/hrshitkunwar-tech/saas-atlas) | Data | Searchable directory of 200+ SaaS tools |
