import { axiosClient } from "./axiosClient";
import type { StockAlert } from "../types";

export const alertApi = {
  getAlerts: async () => {
    const { data } = await axiosClient.get<StockAlert[]>("/api/alerts");
    return data;
  },
  getStockAlerts: async (stockCode: string) => {
    const { data } = await axiosClient.get<StockAlert[]>(`/api/stocks/${stockCode}/alerts`);
    return data;
  },
  resolveAlert: async (alertId: number) => {
    const { data } = await axiosClient.put<StockAlert>(`/api/alerts/${alertId}/resolve`);
    return data;
  },
};
