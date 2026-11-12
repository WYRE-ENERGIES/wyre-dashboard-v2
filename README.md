# Wyre Dashboard

The new Wyre customer dashboard: energy monitoring and cost tracking for commercial
customers' branches (utility, generators, solar, battery and IPP). It replaces the old
Create React App dashboard (`wyre-dashboard`) and is being rebuilt page by page.

Built with **Next.js 16** (App Router), **React 19**, **TypeScript**, **Tailwind CSS 4**,
**shadcn/ui** (preset `bjuA18xnc`, Base UI primitives), **TanStack Query** and **Recharts**.

## Status

| Area | State |
| --- | --- |
| Sign in, forgot password, reset password | Done |
| App shell: sidebar, branch switcher, global period and device filters | Done |
| Dashboard overview | Done |
| Diesel, Solar, Parameters, Score Card, Cost Tracker, Billing, Report, Alerts… | Listed as "Soon" in the sidebar |

The full feature inventory of the old app, with product decisions for the rebuild, lives
in the old repo under `docs/rebuild/inventory/` (start with `00-overview.md`).

## Getting started

### Prerequisites

- **Node.js 20.9 or later** (developed on Node 24)
- **npm** (the repo uses `package-lock.json`)

### Install and run

```bash
git clone <repo-url> new-wyre-dashboard
cd new-wyre-dashboard
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). It redirects to `/login`.

To use another port: `npm run dev -- -p 3100`.

### Signing in

The app runs against the live Wyre backend. Sign in with your Wyre account; branch switching swaps the session token, like the old app. To get back to the sign-in page, sign out from the user menu at the bottom of the sidebar.

`NEXT_PUBLIC_*` variables are read at build time, so restart `npm run dev` after changing them.

### Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `WYRE_BACKEND_URL` | `https://backend.wyreng.com` | Backend the server-side proxy forwards `/api/*` to |
| `NEXT_PUBLIC_WYRE_MEDIA_URL` | `https://backend.wyreng.com` | Host for media paths returned by the API, such as client logos |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run format` | Prettier, with Tailwind class sorting |

## Project structure

```
src/
  app/
    (auth)/            Sign-in and password pages, plus their branded layout
      login/
      reset-password/            Forgot password (same path as the old app)
      confirm-reset-password/    Set a new password from the emailed ?token=
    (main-pages)/      Signed-in pages; layout.tsx wraps them in the app shell
      dashboard/
    api/               Same-origin proxy to the Wyre backend
      v1/[...path]/              /api/v1/* → {WYRE_BACKEND_URL}/api/v1/*
      token/refresh/             /api/token/refresh/ → {WYRE_BACKEND_URL}/token/refresh/
    globals.css        Theme tokens: brand colours, charts, light and dark
    providers.tsx      React Query, session, tooltips, toasts
  components/
    ui/                shadcn/ui components (add more with `npx shadcn@latest add …`)
    auth/              Auth page pieces (feature carousel, password input…)
    dashboard/         Dashboard cards and charts
    app-shell.tsx      Sidebar + filter bar + redirect to /login when signed out
    period-picker.tsx  Global Day / Month / Year picker
    device-filter.tsx  Global device filter
  lib/
    api/               API client (auth header, token refresh), typed endpoints, response types
    auth/session.ts    Token storage and JWT claims
    period.ts          Period model, granularity rule, date formats for the API
    gating.ts          Which features a user sees (role, client type, products)
    dashboard/         Dashboard business rules and chart colours
    format.ts          Number, money and hours formatting
```

Route groups such as `(auth)` and `(main-pages)` organise layouts and don't appear in URLs:
`src/app/(main-pages)/dashboard` is served at `/dashboard`.

## How things work

### Global filters

Every page reads the same filters from the top bar:

- **Period:** Day, Month or Year, calendar periods only, at most one year per view. Under Day you can also pick a range of up to 30 days (click a first and a last day). The period sets the data granularity: a day shows hourly data, a range or a month daily data, a year monthly data. It's kept in the URL (`?view=month&date=2026-10`, or `?view=range&date=2026-10-20..2026-11-01`) so views can be bookmarked. On the Report page a range gives a Periodic report for those days.
- **Devices:** an optional device subset within the current branch. Selecting none means all devices.
- **Branch:** switched from the sidebar.

### Talking to the backend

- The browser never calls `backend.wyreng.com` directly. All requests go to `/api/v1/…` on this app, and the route handlers forward them unchanged, trailing slashes included. That avoids CORS and keeps the backend URL in server configuration.
- `src/lib/api/client.ts` is the single client. It attaches the bearer token and refreshes it once before it expires, however many requests are waiting. A 401 sends the user to `/login`.
- For now the app uses the **existing endpoints as they are**. Changes the backend will need are tracked as proposals in the inventory.

### Feature gating

What a user can see comes from their token claims (`has_ems`, `has_solar`, `client_type`, `role_text`) plus a few hard-coded client names. All of it lives in `src/lib/gating.ts`, so it can move to backend permissions later in one place.

### Theme

Brand colours are defined in `src/app/globals.css`:

- **Primary purple `#5C12A7`:** buttons, highlights, the Total energy card.
- **Highlight yellow `#FCD642`:** used sparingly, for the logo accent, solar in charts and small touches.
- **Neutrals:** carry a faint purple tint.
- **Charts:** use purple shades `--chart-1`…`--chart-4`, with yellow (`--chart-5`) reserved for solar.

The app opens in light mode; dark mode is in the user menu.

## Adding a page

1. Create `src/app/(main-pages)/<route>/page.tsx`. It gets the sidebar and filters automatically.
2. Add typed endpoint calls in `src/lib/api/` (shared ones in `endpoints.ts`).
3. Read the filters with `useFilters()` and the user with `useClaims()`.
4. Set `ready: true` for its sidebar item in `src/components/app-sidebar.tsx`.
