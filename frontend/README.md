# Atlas Workforce Frontend

Next.js 16 + React 19 + Tailwind 4 dashboard for the Atlas Workforce System. It covers employees, lifecycle, attendance, payroll, LMS, ATS, analytics, AI copilots, live views, and admin screens, talking to the API gateway.

## Quick start

```bash
cd frontend
npm ci
npm run dev
```

App runs on `http://localhost:3000`.

The app calls the gateway at `http://localhost:8080/api` via `NEXT_PUBLIC_API_URL`. Copy `.env.example` if present and set:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080/api
NEXT_PUBLIC_WS_URL=ws://localhost:8080/api/notification/ws
```

Gateway default port is `8080`. Frontend default port is `3000`.

## Scripts

```bash
npm run dev      # dev server on :3000
npm run lint     # eslint, must pass
npx tsc --noEmit # typecheck, must pass
npm test         # vitest run
npm run build    # production build, needs NEXT_PUBLIC_API_URL set
```

Build example:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8080/api npm run build
```

## Structure

```text
frontend/src/
  app/         # Next.js routes: (auth), dashboard/*, live, ai, settings
  components/  # ui/* primitives plus layout, live, and feature widgets
  hooks/       # data and realtime hooks: use-websocket, use-realtime, use-keyboard-shortcuts
  stores/      # zustand stores: auth-store, toast-store
  lib/         # api client, auth helpers, csv/excel, utils, reconnect backoff
```

`app/dashboard` holds feature pages. Shared UI lives in `components/ui`. API access is centralized in `lib/api`.
