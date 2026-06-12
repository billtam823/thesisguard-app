import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { AddStockPage } from "./pages/AddStockPage";
import { AlertsPage } from "./pages/AlertsPage";
import { StockDetailPage } from "./pages/StockDetailPage";
import { WatchlistPage } from "./pages/WatchlistPage";

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <Navigate to="/watchlist" replace /> },
      { path: "/watchlist", element: <WatchlistPage /> },
      { path: "/watchlist/new", element: <AddStockPage /> },
      { path: "/stocks/:stockCode", element: <StockDetailPage /> },
      { path: "/alerts", element: <AlertsPage /> },
    ],
  },
]);
