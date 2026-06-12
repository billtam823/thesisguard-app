import { axiosClient } from "./axiosClient";
import type { DailyNewsReview } from "../types";

export const reviewApi = {
  reviewNews: async (stockCode: string) => {
    const { data } = await axiosClient.post<DailyNewsReview>(`/api/stocks/${stockCode}/review-news`);
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
