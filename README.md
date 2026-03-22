# VisionGuide

Screenshot-grounded UI guidance — captures what the user sees, routes it through Gemini vision, and renders real-time guidance overlays in the browser. Every decision is logged to a structured reasoning timeline in Supabase.

## What It Is

VisionGuide explores a simple but powerful workflow:

1. capture what a user is seeing
2. store screenshots, reasoning events, and guidance packets
3. replay the session in a dashboard with live Reasoning & State telemetry
4. generate extension packaging for in-browser assistance

The project combines a React dashboard, a browser extension surface, and a lightweight backend so guidance can move between observation and action.

## Current State

Working prototype. The dashboard, extension plumbing, realtime session view, and export utilities are in place. A structured reasoning timeline lets you watch every Gemini call — which screenshot triggered it, what state the agent entered, what guidance it produced — logged as discrete events in Supabase with timestamps and confidence signals.

## Stack

| Layer | Technology |
|---|---|
| Dashboard | React 19 + Vite + TypeScript |
| Icons / UI | Lucide React |
| Data layer | Supabase |
| Backend | Express |
| Extension | Chrome extension scripts in TypeScript |
| Packaging | JSZip + FileSaver |

## What To Look At

- `App.tsx` for the operator dashboard experience
- `extension/` for browser guidance logic and overlay behavior
- `server/` for the lightweight backend hooks
- `types.ts` for the shared session, guidance, and reasoning event model
- `schema.sql` for the Supabase `reasoning_events` table used by the live timeline

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Provide the relevant Supabase and Gemini credentials in `.env.local`.

If you want the full structured timeline instead of the synthetic fallback feed, apply [`schema.sql`](./schema.sql) to your Supabase project and enable realtime for `reasoning_events`.

## Why This Repo Matters

Every Gemini call is logged as a structured reasoning event in Supabase. The dashboard replays the full decision timeline — which screenshot triggered what guidance, with confidence scores at each step. That's the thing most AI demos skip: not just what the model did, but why, in sequence, auditable after the fact.

## Navigator Lab

Part of the Navigator Lab — an open research portfolio exploring AI-native software interaction.

| Repo | Layer | What it does |
|---|---|---|
| [navigator](https://github.com/hrshitkunwar-tech/navigator) | Thesis | 5-layer architecture for AI execution on software interfaces |
| [VisionGuide](https://github.com/hrshitkunwar-tech/VisionGuide) | Perception | Screenshot → Gemini vision → real-time UI guidance |
| [zoneguide](https://github.com/hrshitkunwar-tech/zoneguide) | Recording | DOM interaction capture and replay, zero dependencies |
| [job](https://github.com/hrshitkunwar-tech/job) | Applied | CareerAgent: score → tailor → apply, local-first |
| [saas-atlas](https://github.com/hrshitkunwar-tech/saas-atlas) | Data | Searchable directory of 200+ SaaS tools |
