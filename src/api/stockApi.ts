import { axiosClient } from "./axiosClient";
import type { Stock, StockCreateRequest, StockSearchMatch } from "../types";

export const stockApi = {
  createStock: async (request: StockCreateRequest) => {
    const { data } = await axiosClient.post<Stock>("/api/watchlist/stocks", request);
    return data;
  },
  searchStocks: async (query: string) => {
    const { data } = await axiosClient.get<StockSearchMatch[]>("/api/watchlist/stocks/lookup", {
      params: { query },
    });
    return data;
  },
  getStocks: async () => {
    const { data } = await axiosClient.get<Stock[]>("/api/watchlist/stocks");
    return data;
  },
  getStock: async (stockCode: string) => {
    const { data } = await axiosClient.get<Stock>(`/api/watchlist/stocks/${stockCode}`);
    return data;
  },
  deleteStock: async (stockCode: string) => {
    await axiosClient.delete(`/api/watchlist/stocks/${stockCode}`);
  },
};
