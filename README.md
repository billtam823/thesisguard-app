# ThesisGuard App

ThesisGuard is a React frontend for a long-term buy-and-hold stock monitoring workflow. It connects to the Spring Boot `thesisguard-api` backend to manage watchlist stocks, generate buy theses, retrieve stored news, review news against a saved thesis, and resolve alerts.

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
- `/stocks/:stockCode` shows thesis, news, reviews, status, and alerts
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

POST   /api/stocks/{stockCode}/review-news
GET    /api/stocks/{stockCode}/daily-reviews
GET    /api/stocks/{stockCode}/daily-reviews/latest

GET    /api/alerts
GET    /api/stocks/{stockCode}/alerts
PUT    /api/alerts/{alertId}/resolve
```

The `Fetch Latest News` action calls the backend endpoint that retrieves company news from OpenBB and saves new items:

```text
GET /api/stocks/NVDA/news/fetch
```

The endpoint also supports an optional `date` query parameter in `YYYY-MM-DD` format. The frontend intentionally does not provide a manual news entry form.

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
7. Fetch latest news from the backend/OpenBB endpoint.
8. Review retrieved news against the saved thesis.
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
