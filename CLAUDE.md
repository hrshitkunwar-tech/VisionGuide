# CLAUDE.md — VisionGuide AI Dashboard

## Overview
AI-powered dashboard with browser extension for screen capture and contextual guidance. Uses Google Gemini for vision analysis.

## Stack
- **Frontend**: React 19 + Vite 6 + TypeScript
- **Server**: Express 5.2
- **AI**: Google Gemini API (`@google/genai`)
- **Database**: Supabase
- **Extension**: Chrome Manifest V3

## Structure
```
VisionGuide/
  App.tsx, index.tsx, types.ts   — React app
  extension/                      — Chrome extension (MV3)
    manifest.json                 — Ctrl+Shift+S capture shortcut
    background.ts, content.ts     — Service worker + DOM injection
    overlay.ts, api.ts            — Guidance overlay + API calls
  server/
    server.ts                     — Express backend
    schema.sql                    — Database schema
```

## Quick Reference
```bash
npm install
npm run dev       # Vite dev server (localhost:5173)
npm run build     # production build
```

## Extension
- **Shortcut**: Ctrl+Shift+S (Mac: Cmd+Shift+S) captures screen
- **Permissions**: activeTab, storage, scripting, tabs
- Load unpacked from `extension/` in chrome://extensions
