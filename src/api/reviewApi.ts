import { axiosClient } from "./axiosClient";
import type { AutoReviewResult, DailyNewsReview, ThesisMonitorMemory } from "../types";

export const reviewApi = {
  reviewNews: async (stockCode: string) => {
    const { data } = await axiosClient.post<DailyNewsReview>(`/api/stocks/${stockCode}/review-news`);
    return data;
  },
  autoReview: async (stockCode: string) => {
    const { data } = await axiosClient.post<AutoReviewResult>(`/api/stocks/${stockCode}/reviews/auto`);
    return data;
  },
  getMonitorMemory: async (stockCode: string) => {
    const { data } = await axiosClient.get<ThesisMonitorMemory>(`/api/stocks/${stockCode}/monitor-memory`);
    return data;
  },
  getDailyReviews: async (stockCode: string) => {
    const { data } = await axiosClient.get<DailyNewsReview[]>(`/api/stocks/${stockCode}/daily-reviews`);
    return data;
  },
  getLatestReview: async (stockCode: string) => {
    const { data } = await axiosClient.get<DailyNewsReview>(`/api/stocks/${stockCode}/daily-reviews/latest`);
    return data;
  },
};
