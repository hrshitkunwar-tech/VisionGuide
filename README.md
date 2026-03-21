# VisionGuide

> 🧪 **Part of The Navigator Lab Ecosystem**
> This repository is a core experimental component of the broader [Navigator Lab](https://github.com/hrshitkunwar-tech/NewCodexWay) research initiative, mapping screenshot-grounded UI analysis into the Universal Perception engine.

Screenshot-grounded UI guidance prototype with a live session dashboard, structured reasoning timeline, and extension export flow.

## What It Is

VisionGuide explores a simple but powerful workflow:

1. capture what a user is seeing
2. store screenshots, reasoning events, and guidance packets
3. replay the session in a dashboard with live Reasoning & State telemetry
4. generate extension packaging for in-browser assistance

The project combines a React dashboard, a browser extension surface, and a lightweight backend so guidance can move between observation and action.

## Current State

Prototype, now aimed squarely at the Navigator Lab hackathon story. The dashboard, extension plumbing, realtime session view, and export utilities are in place, and the latest pass adds a structured reasoning timeline so judges can watch the agent state evolve in realtime.

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

This repo is the clearest visual demo inside Navigator Lab. It makes the agent legible: what the model saw, what state it entered, what it decided, and what artifact it produced next.
