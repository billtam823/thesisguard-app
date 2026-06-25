export type StockStatus = "Hold" | "Watch" | "Reduce Review" | "Sell Review";

export type Stock = {
  id: number;
  stock_code: string;
  exchange?: string | null;
  provider_ticker?: string | null;
  company_name: string;
  sector?: string | null;
  industry?: string | null;
  status: StockStatus | string;
  review_status?: "RUNNING" | "FAILED" | null;
  created_at: string;
  updated_at: string;
};

export type StockCreateRequest = {
  ticker: string;
  companyName: string;
  exchange?: string;
};

export type StockSearchMatch = {
  symbol: string;
  name: string;
};

export type StockThesis = {
  id: number;
  stock_id: number;
  full_buy_thesis: string;
  saved_buy_thesis_summary: string;
  final_rating: string;
  conviction: string;
  portfolio_role: string;
  core_thesis: string;
  business_essence: string;
  growth_drivers: string;
  moat_summary: string;
  financial_quality: string;
  valuation_view: string;
  main_risks: string;
  thesis_break_triggers: string;
  daily_review_focus: string;
  return_multiple?: string | null;
  return_basis?: string | null;
  position_guidance?: string | null;
  generation_status?: "RUNNING" | "DONE" | "FAILED" | null;
  generation_error?: string | null;
  created_at: string;
  updated_at: string;
};

export type NewsItem = {
  id: number;
  stock_id: number;
  title: string;
  summary?: string | null;
  url?: string | null;
  published_date?: string | null;
  source?: string | null;
  reviewed_at?: string | null;
  impact_level?: string | null;
  related_to_stock?: boolean | null;
  analysis?: string | null;
  created_at: string;
  updated_at: string;
};

export type NewsCreateRequest = {
  title: string;
  summary?: string | null;
  url?: string | null;
  published_date?: string | null;
  source?: string | null;
};

export type FetchedNewsItem = {
  symbol: string;
  title: string;
  url?: string | null;
  published_date?: string | null;
  source?: string | null;
  summary?: string | null;
};

export type NewsAnalysisItem = {
  id: number;
  news_item_id: number;
  news_title: string;
  analysis: string;
  impact_level: string;
};

export type DailyNewsReview = {
  id: number;
  stock_id: number;
  review_date: string;
  thesis_change_level: string;
  summary: string;
  thesis_impact: string;
  recommended_action: string;
  news_analysis: NewsAnalysisItem[];
  created_at: string;
  updated_at: string;
};

export type AutoReviewResult = {
  new_items_count: number;
  review?: DailyNewsReview | null;
};

export type ThesisMonitorMemory = {
  id: number;
  stock_id: number;
  memory_text: string;
  previous_memory_text?: string | null;
  created_at: string;
  updated_at: string;
};

export type StockAlert = {
  id: number;
  stock_id: number;
  stock_code: string;
  exchange?: string | null;
  daily_news_review_id?: number | null;
  severity: "Watch" | "Material" | "Critical" | string;
  title: string;
  message: string;
  resolved: boolean;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
};

export type ApiErrorBody = {
  timestamp?: string;
  status?: number;
  error?: string;
  message?: string;
  field_errors?: Array<{ field: string; message: string }>;
};
