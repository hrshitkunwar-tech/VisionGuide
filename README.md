# VisionGuide

Screenshot-grounded UI guidance prototype with a live session dashboard and extension export flow.

## What It Is

VisionGuide explores a simple but powerful workflow:

1. capture what a user is seeing
2. store screenshots and guidance events
3. replay the session in a dashboard
4. generate extension packaging for in-browser assistance

The project combines a React dashboard, a browser extension surface, and a lightweight backend so guidance can move between observation and action.

## Current State

Prototype. The dashboard, extension plumbing, realtime session view, and export utilities are in place. The product story is stronger than the polish, but the repo clearly shows the direction.

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
- `types.ts` for the shared session and guidance event model

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Provide the relevant Supabase and Gemini credentials in `.env.local`.

## Why This Repo Matters

This repo shows product taste in a useful direction: not just chatting with an AI, but giving the AI enough session context to guide someone through an interface with visual specificity.
