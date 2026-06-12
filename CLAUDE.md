# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Vite dev server on http://localhost:5173
npm run build      # tsc --noEmit + vite build (use this to typecheck)
npm run preview    # serve the production build
```

There are no tests or linter configured.

## What This App Is

ThesisGuard's frontend: a React SPA for stock investment thesis management. It is the UI for the Spring Boot backend in `../thesisguard-api` (see that repo's `README.md` for the full system description). The user workflow: watch a stock → generate an AI buy thesis → collect news/SEC filings/insider trades → run a daily AI review → act on alerts.

This is a Vite + React 18 web app (MUI, TanStack Query, axios, react-router). It is **not** an Expo/React Native project — the root-level `App.tsx`, `app.json`, and `index.ts` are unused leftovers; the real entry point is `index.html` → `src/main.tsx`.

## Architecture

```text
src/
+-- api/          # one module per backend domain; all calls go through axiosClient
|   +-- axiosClient.ts   # axios instance; baseURL from VITE_API_BASE_URL (.env); error interceptor
|   +-- stockApi.ts      # /api/watchlist/stocks CRUD
|   +-- thesisApi.ts     # generate/get/update thesis
|   +-- newsApi.ts       # saved news CRUD + live previews (news/fetch, news/filings, news/insider)
|   +-- reviewApi.ts     # review-news trigger + daily reviews
|   +-- alertApi.ts      # alerts list/resolve
|   +-- stockUniverse.ts # static ticker lookup data for the add-stock form
+-- pages/
|   +-- WatchlistPage.tsx    # all stocks with status chips
|   +-- AddStockPage.tsx     # add stock (ticker autocomplete)
|   +-- StockDetailPage.tsx  # the "Equity Dossier" (see below)
|   +-- AlertsPage.tsx       # global alert feed
+-- components/   # AppLayout, StatusChip, SeverityChip, Empty/Error/LoadingState, SectionCard
+-- types/        # API response/request types (snake_case fields, mirroring backend DTOs)
```

Server state lives entirely in TanStack Query; there is no global client store. Mutations invalidate the relevant query keys (`["stock", code]`, `["news", code]`, `["latest-review", code]`, `["alerts"]`, ...).

## StockDetailPage (the main screen)

Numbered sections, in order:

1. **Buy Thesis** — generate/regenerate via AI; renders core thesis, five pillars, risk panel, full document.
2. **News Desk** — date picker + "Fetch News" runs three previews concurrently (`Promise.allSettled`): yfinance headlines, SEC 8-K filings, SEC Form 4 insider trades for that date, merged into one save-able list. Partial source failures render a warning, not an error. Saved items are listed below; items dated today get an "In today's review" chip.
3. **SEC Activity** — auto-loads on page open (no date filter): the 10 most recent 8-K filings and insider trades from EDGAR, each with a Save button. Non-US-listed stocks (exchange outside NASDAQ/NYSE/AMEX/NYSE ARCA) show an info note instead, since EDGAR has no data for them.
4. **Daily Review** — triggers `POST /review-news`; shows change level chip, recommended actions, summary, and article-by-article analysis.
5. **Alerts** — per-stock alerts with resolve buttons.

### Conventions worth knowing

- Saving any previewed item (news, filing, insider trade) deliberately omits `published_date` so the backend stamps it with today — the daily review only scans items dated today.
- "Saved" detection (`isSaved`) keys on **url + title together**: multiple insider transactions from one Form 4 filing share the same URL, so URL alone is not an identity.
- Titles are truncated to 500 chars and URLs longer than 1000 chars are dropped on save, matching backend column limits.
- The backend serializes enums as human-readable labels (`"Watch Change"`, `"Reduce Review"`), and the UI string-matches on those labels (e.g. `ChangeLevelChip`).

## Configuration

`.env`:

```text
VITE_API_BASE_URL=http://localhost:8080
```

The backend's CORS config allows `localhost:5173`. Start the API (and its PostgreSQL container) before using the app.
