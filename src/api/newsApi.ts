import { axiosClient } from "./axiosClient";
import type { FetchedNewsItem, NewsCreateRequest, NewsItem } from "../types";

export const newsApi = {
  saveNews: async (stockCode: string, request: NewsCreateRequest) => {
    const { data } = await axiosClient.post<NewsItem>(`/api/stocks/${stockCode}/news`, request);
    return data;
  },
  ingestNews: async (stockCode: string) => {
    const { data } = await axiosClient.post<{ new_items_count: number }>(`/api/stocks/${stockCode}/news/ingest`);
    return data;
  },
  fetchLatestNews: async (stockCode: string, date?: string) => {
    const { data } = await axiosClient.get<FetchedNewsItem[]>(`/api/stocks/${stockCode}/news/fetch`, {
      params: date ? { date } : undefined,
    });
    return data;
  },
  fetchSecFilings: async (stockCode: string, date?: string) => {
    const { data } = await axiosClient.get<FetchedNewsItem[]>(`/api/stocks/${stockCode}/news/filings`, {
      params: date ? { date } : undefined,
    });
    return data;
  },
  fetchInsiderTrades: async (stockCode: string, date?: string) => {
    const { data } = await axiosClient.get<FetchedNewsItem[]>(`/api/stocks/${stockCode}/news/insider`, {
      params: date ? { date } : undefined,
    });
    return data;
  },
  getNews: async (stockCode: string) => {
    const { data } = await axiosClient.get<NewsItem[]>(`/api/stocks/${stockCode}/news`);
    return data;
  },
  getTodayNews: async (stockCode: string) => {
    const { data } = await axiosClient.get<NewsItem[]>(`/api/stocks/${stockCode}/news/today`);
    return data;
  },
};
