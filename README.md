# ThesisGuard App

ThesisGuard is a React frontend for a long-term buy-and-hold stock monitoring workflow. It connects to the Spring Boot `thesisguard-api` backend to manage watchlist stocks, generate buy theses, retrieve stored news and SEC activity, review news against a saved thesis, and resolve alerts.

The core review action is **Auto Review**: one click fetches the latest headlines, SEC 8-K filings, and Form 4 insider trades, saves anything not already on file (deduplicated), and runs the AI over every unreviewed item against the saved thesis. Each review also updates a per-stock **monitoring journal** — an AI-maintained digest of durable findings tied to the thesis's kill-criteria and watch items, carried into every future review so multi-day developments are judged in context rather than in isolation.

## Tech Stack

- React
- TypeScript
- Vite
- MUI
- Axios
- TanStack React Query
- React Router

## Prerequisites

- Node.js and npm
- ThesisGuard backend running locally at `http://localhost:8080`

## Repositories

- Frontend: https://github.com/billtam823/thesisguard-app
- Backend (API): https://github.com/billtam823/thesisguard-api

## Setup

Install dependencies:

```powershell
npm install
```

Create `.env`:

```env
VITE_API_BASE_URL=http://localhost:8080
```

Run the app:

```powershell
npm run dev
```

Build for production:

```powershell
npm run build
```

Preview production build:

```powershell
npm run preview
```

## Routes

- `/` redirects to `/watchlist`
- `/watchlist` shows all watchlist stocks
- `/watchlist/new` adds a stock
- `/stocks/:stockCode` shows thesis, news desk, SEC activity, daily review with monitoring journal, status, and alerts
- `/alerts` shows all alerts

## Backend Integration

The frontend uses `VITE_API_BASE_URL` and does not hardcode the backend URL.

Implemented backend endpoints used by the app:

```text
POST   /api/watchlist/stocks
GET    /api/watchlist/stocks
GET    /api/watchlist/stocks/{stockCode}
DELETE /api/watchlist/stocks/{stockCode}

POST   /api/stocks/{stockCode}/generate-thesis
GET    /api/stocks/{stockCode}/thesis
PUT    /api/stocks/{stockCode}/thesis

GET    /api/stocks/{stockCode}/news
GET    /api/stocks/{stockCode}/news/today
GET    /api/stocks/{stockCode}/news/fetch
GET    /api/stocks/{stockCode}/news/filings
GET    /api/stocks/{stockCode}/news/insider
POST   /api/stocks/{stockCode}/news

POST   /api/stocks/{stockCode}/reviews/auto
POST   /api/stocks/{stockCode}/review-news
GET    /api/stocks/{stockCode}/monitor-memory
GET    /api/stocks/{stockCode}/daily-reviews
GET    /api/stocks/{stockCode}/daily-reviews/latest

GET    /api/alerts
GET    /api/stocks/{stockCode}/alerts
PUT    /api/alerts/{alertId}/resolve
```

### News and SEC previews

The `Fetch News` action retrieves a live preview of company news, SEC 8-K filings, and Form 4 insider trades from OpenBB without saving anything; the user saves the relevant items. Each preview endpoint accepts an optional `date` query parameter in `YYYY-MM-DD` format. SEC previews (`/news/filings`, `/news/insider`) return empty for non-US-listed stocks.

```text
GET /api/stocks/NVDA/news/fetch
GET /api/stocks/NVDA/news/filings
GET /api/stocks/NVDA/news/insider
```

### Auto Review and the monitoring journal

`POST /api/stocks/{stockCode}/reviews/auto` runs the full pipeline in one call: it fetches recent news/filings/insider trades, saves new items (deduplicated by URL + title), reviews every unreviewed item against the thesis, and returns `{ new_items_count, review }`. Saved items track a `reviewed_at` timestamp, so the app shows **Reviewed** / **Pending review** chips per item.

`POST /api/stocks/{stockCode}/review-news` reviews only the items still pending (no fetch step). `GET /api/stocks/{stockCode}/monitor-memory` returns the AI's accumulated monitoring journal for the stock (`404` until the first substantive review), shown in a collapsible panel on the detail page.

## CORS (local dev only)

For local development the Spring Boot backend must allow the Vite dev origin:

```text
http://localhost:5173
http://127.0.0.1:5173
```

In production the frontend and API share one origin (`https://your-domain.com`, API under `/api`), so the browser runs no CORS preflight. **Spring still enforces CORS server-side, though:** browsers send an `Origin` header on same-origin POST/PUT/DELETE, so the backend must allowlist `https://your-domain.com` in its `CorsConfig` or writes fail with `Invalid CORS request`. See [Deploy to Dokploy](#deploy-to-dokploy).

## Deploy to Dokploy

The frontend deploys to [Dokploy](https://dokploy.com) as a static Vite build served by nginx, on the **same origin** as the API (no browser CORS preflight; the API still allowlists this origin server-side — see CORS note below).

Repositories:

- Frontend: https://github.com/billtam823/thesisguard-app
- Backend (API): https://github.com/billtam823/thesisguard-api

### Topology — one host, path-routed

Both apps share one host (`your-domain.com` is a placeholder throughout — substitute your real domain; the live demo uses `thesisguard.kingheung.com`); Traefik routes by path:

| Path | Served by |
|------|-----------|
| `your-domain.com/api/*` | the API app (port 8080) |
| `your-domain.com/*` | this frontend app (nginx, port 80) |

Because the page and its API calls share scheme + host + port, the browser runs no CORS preflight. The API still allowlists `https://your-domain.com` in `CorsConfig` — browsers send an `Origin` header on same-origin POST/PUT/DELETE, and Spring validates it server-side.

### Build

The repo ships a multi-stage `Dockerfile`: a Node stage runs `npm ci && npm run build` (Vite emits static files to `dist/`), then an `nginx:alpine` stage serves them with an SPA fallback (`try_files $uri /index.html`, in `nginx.conf`) so client-side routes survive a page refresh.

`VITE_API_BASE_URL` is inlined by Vite **at build time**, so it must be supplied as a build argument — and it must be the **host only, without `/api`**, because the app already prefixes every call with `/api`:

- ✅ `VITE_API_BASE_URL=https://your-domain.com` → `https://your-domain.com/api/...`
- ❌ `VITE_API_BASE_URL=https://your-domain.com/api` → `.../api/api/...` (double `/api`)

### Steps

**API app** (already deployed) — add a route so `/api` resolves on the shared host:

1. Open the API application (https://github.com/billtam823/thesisguard-api) in Dokploy → Domains.
2. Add: Host `your-domain.com`, Path `/api`, **Strip Path OFF**, Container Port `8080`, HTTPS on.
3. Allowlist your origin in the API's `CorsConfig` (`https://your-domain.com`) — same-origin writes still carry an `Origin` header that Spring validates, so without this the POST/PUT/DELETE calls fail with `Invalid CORS request`.

**Frontend app** (new):

1. Create an Application from https://github.com/billtam823/thesisguard-app, branch `main`, Build Type **Dockerfile**.
2. Set the build variable `VITE_API_BASE_URL=https://your-domain.com` (host only).
3. Container Port `80`.
4. Domain `your-domain.com`, Path `/`, HTTPS on.
5. Deploy.

Then open `https://your-domain.com` — the SPA loads, and its `/api/...` calls hit the backend on the same origin.

## Example User Flow

1. Start the backend API.
2. Start this frontend with `npm run dev`.
3. Open the Vite URL in the browser.
4. Add `NVDA` with company name `NVIDIA Corporation`.
5. Open the NVDA detail page.
6. Generate the buy thesis.
7. Click **Auto Review** to fetch the latest news/filings/insider trades, save what's new, and review it against the thesis in one step. (Or fetch and save items manually in the News Desk, then use **Review Pending**.)
8. Read the daily review verdict and expand the **Monitoring Journal** to see what the AI is tracking across reviews.
9. Check stock status and alerts.
10. Resolve any open alerts.

## Project Structure

```text
src/
+-- api/
|   +-- axiosClient.ts
|   +-- stockApi.ts
|   +-- thesisApi.ts
|   +-- newsApi.ts
|   +-- reviewApi.ts
|   +-- alertApi.ts
|   +-- stockUniverse.ts
+-- components/
+-- pages/
+-- types/
|   +-- index.ts
|   +-- stockLookup.ts
+-- App.tsx
+-- main.tsx
```
