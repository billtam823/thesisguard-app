import { axiosClient } from "./axiosClient";
import type { StockThesis } from "../types";

type StockThesisUpdateRequest = Omit<StockThesis, "id" | "stock_id" | "created_at" | "updated_at">;

export const thesisApi = {
  generateThesis: async (stockCode: string) => {
    const { data } = await axiosClient.post<StockThesis>(`/api/stocks/${stockCode}/generate-thesis`);
    return data;
  },
  getThesis: async (stockCode: string) => {
    const { data } = await axiosClient.get<StockThesis>(`/api/stocks/${stockCode}/thesis`);
    return data;
  },
  updateThesis: async (stockCode: string, request: StockThesisUpdateRequest) => {
    const { data } = await axiosClient.put<StockThesis>(`/api/stocks/${stockCode}/thesis`, request);
    return data;
  },
};
