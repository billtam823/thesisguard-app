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

Backend project:

```text
C:\Users\bill.tam\workspace\thesisguard-api
```

Frontend project:

```text
C:\Users\bill.tam\workspace\thesisguard-app
```

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

## CORS

The Spring Boot backend must allow the Vite development origin:

```text
http://localhost:5173
http://127.0.0.1:5173
```

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
