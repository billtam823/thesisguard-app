import {
  ArrowBack,
  AutoAwesome,
  ExpandMore,
  FactCheck,
  OpenInNew,
  Refresh,
} from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  LinearProgress,
  Link,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { alertApi } from "../api/alertApi";
import { newsApi } from "../api/newsApi";
import { reviewApi } from "../api/reviewApi";
import { stockApi } from "../api/stockApi";
import { thesisApi } from "../api/thesisApi";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { SeverityChip } from "../components/SeverityChip";
import { StatusChip } from "../components/StatusChip";
import type { NewsItem, StockThesis } from "../types";

const ink = "#172033";
const serif = '"Fraunces", Georgia, "Times New Roman", serif';
const mono = '"IBM Plex Mono", Consolas, "Courier New", monospace';
const hairline = "#dde3ee";

// Backend serializes timestamps as zone-less LocalDateTime in UTC (the server runs UTC), which the
// browser would otherwise read as local time. Mark them UTC so they render in the viewer's own zone.
function formatLocal(iso?: string | null) {
  if (!iso) return "—";
  const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso);
  return new Date(hasZone ? iso : `${iso}Z`).toLocaleString();
}

const verdictFields: Array<[keyof StockThesis, string]> = [
  ["final_rating", "Final Rating"],
  ["conviction", "Conviction"],
  ["portfolio_role", "Portfolio Role"],
  ["return_multiple", "Return Forecast"],
];

const pillarFields: Array<[keyof StockThesis, string]> = [
  ["business_essence", "Business Essence"],
  ["growth_drivers", "Growth Drivers"],
  ["moat_summary", "Moat"],
  ["financial_quality", "Financial Quality"],
  ["valuation_view", "Valuation View"],
];

const watchFields: Array<[keyof StockThesis, string]> = [
  ["main_risks", "Main Risks"],
  ["thesis_break_triggers", "Thesis Break Triggers"],
  ["daily_review_focus", "Daily Review Focus"],
];

type FeedTab = "all" | "material" | "noise" | "unrelated" | "pending";

// Classify a saved item from its persisted review outcome: pending (not yet reviewed),
// unrelated (reviewed but judged not about this stock), or noise/material by impact level.
function classifyItem(item: NewsItem): Exclude<FeedTab, "all"> {
  if (!item.reviewed_at) {
    return "pending";
  }
  if (item.related_to_stock === false) {
    return "unrelated";
  }
  const normalized = (item.impact_level || "").toLowerCase();
  return normalized === "" || normalized === "noise" || normalized === "none" ? "noise" : "material";
}

function Section({
  index,
  title,
  subtitle,
  action,
  children,
}: {
  index: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Box component="section">
      <Stack
        direction={{ xs: "column", sm: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "flex-end" }}
        spacing={1.5}
        sx={{ borderBottom: `3px solid ${ink}`, pb: 1.25, mb: 0 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="baseline">
          <Typography sx={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: "#8a93a8" }}>{index}</Typography>
          <Box>
            <Typography sx={{ fontFamily: serif, fontWeight: 700, fontSize: { xs: 24, sm: 28 }, lineHeight: 1.1, color: ink }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography sx={{ color: "text.secondary", fontSize: 13, mt: 0.25 }}>{subtitle}</Typography>
            )}
          </Box>
        </Stack>
        {action}
      </Stack>
      <Box sx={{ borderTop: `1px solid ${hairline}`, mt: "3px", pt: 2.5 }}>{children}</Box>
    </Box>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      sx={{
        fontFamily: mono,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "#6b7590",
        mb: 0.75,
      }}
    >
      {children}
    </Typography>
  );
}

function ChangeLevelChip({ level }: { level?: string | null }) {
  const normalized = (level || "").toLowerCase();
  const color =
    normalized === "no change"
      ? "success"
      : normalized === "minor change"
        ? "info"
        : normalized === "watch change"
          ? "warning"
          : normalized === "material change" || normalized === "thesis broken"
            ? "error"
            : "default";
  return (
    <Chip
      size="small"
      label={level || "Unknown"}
      color={color}
      variant={normalized === "thesis broken" ? "filled" : "outlined"}
      sx={{ fontFamily: mono, fontWeight: 600, letterSpacing: "0.04em" }}
    />
  );
}

// Per-item triage/review impact level shown inline on each saved news item.
function ImpactChip({ level }: { level?: string | null }) {
  const normalized = (level || "").toLowerCase();
  const color =
    normalized === "none" || normalized === "noise"
      ? "default"
      : normalized === "minor" || normalized === "low"
        ? "info"
        : normalized === "watch" || normalized === "medium"
          ? "warning"
          : normalized === "major" || normalized === "material" || normalized === "high" || normalized === "critical"
            ? "error"
            : "default";
  return (
    <Chip
      size="small"
      label={level || "—"}
      color={color}
      variant={normalized === "critical" ? "filled" : "outlined"}
      sx={{ fontFamily: mono, fontWeight: 600, letterSpacing: "0.04em", flexShrink: 0 }}
    />
  );
}

function feedCounts(items: NewsItem[]) {
  return {
    all: items.length,
    material: items.filter((item) => classifyItem(item) === "material").length,
    noise: items.filter((item) => classifyItem(item) === "noise").length,
    unrelated: items.filter((item) => classifyItem(item) === "unrelated").length,
    pending: items.filter((item) => classifyItem(item) === "pending").length,
  };
}

// A tabbed, classification-filtered list of saved items, reused by the News and Filings feeds.
function NewsFeed({
  items,
  tab,
  onTab,
  isLoading,
  isError,
  error,
  loadingText,
  emptyTitle,
  emptyMessage,
}: {
  items: NewsItem[];
  tab: FeedTab;
  onTab: (tab: FeedTab) => void;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  loadingText: string;
  emptyTitle: string;
  emptyMessage: string;
}) {
  const counts = feedCounts(items);
  const visible = tab === "all" ? items : items.filter((item) => classifyItem(item) === tab);
  return (
    <Stack spacing={2.5}>
      <Box sx={{ borderBottom: `1px solid ${hairline}` }}>
        <Tabs
          value={tab}
          onChange={(_, value: FeedTab) => onTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 0, "& .MuiTab-root": { minHeight: 0, py: 1.25, fontFamily: mono, fontWeight: 600, letterSpacing: "0.04em", textTransform: "none" } }}
        >
          <Tab value="all" label={`All · ${counts.all}`} />
          <Tab value="material" label={`Material · ${counts.material}`} />
          <Tab value="noise" label={`Noise · ${counts.noise}`} />
          <Tab value="unrelated" label={`Unrelated · ${counts.unrelated}`} />
          <Tab value="pending" label={`Pending · ${counts.pending}`} />
        </Tabs>
      </Box>

      {isLoading && <LoadingState text={loadingText} />}
      {isError && <ErrorState error={error} />}
      {!isLoading && items.length === 0 && <EmptyState title={emptyTitle} message={emptyMessage} />}
      {!isLoading && items.length > 0 && visible.length === 0 && (
        <EmptyState title="Nothing here" message={`No ${tab} items right now.`} />
      )}

      {visible.length > 0 && (
        <Stack spacing={0} sx={{ border: `1px solid ${hairline}`, borderRadius: 2, overflow: "hidden", bgcolor: "#fff" }}>
          {visible.map((item, i) => (
            <Box key={item.id} sx={{ p: 2.25, borderBottom: i < visible.length - 1 ? `1px solid ${hairline}` : "none" }}>
              <Stack direction="row" spacing={1.5} justifyContent="space-between" alignItems="flex-start">
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontFamily: serif, fontWeight: 700, fontSize: 16, lineHeight: 1.35, color: ink }}>{item.title}</Typography>
                  <Typography sx={{ fontFamily: mono, fontSize: 11.5, color: "#8a93a8", mt: 0.5 }}>
                    filed {item.published_date || "unknown date"}
                    {item.source ? ` · ${item.source}` : ""}
                  </Typography>
                  {item.summary && <Typography sx={{ mt: 1, fontSize: 14, lineHeight: 1.6, color: "#3a4356" }}>{item.summary}</Typography>}
                  {item.analysis && (
                    <Box sx={{ mt: 1, pl: 1.5, borderLeft: `3px solid ${hairline}` }}>
                      <Typography sx={{ fontFamily: mono, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#8a93a8", mb: 0.25 }}>
                        Review note
                      </Typography>
                      <Typography sx={{ fontSize: 13.5, lineHeight: 1.6, color: "#3a4356" }}>{item.analysis}</Typography>
                    </Box>
                  )}
                  {item.url && (
                    <Link href={item.url} target="_blank" rel="noreferrer" sx={{ fontFamily: mono, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 0.5, mt: 0.75 }}>
                      Read source <OpenInNew sx={{ fontSize: 13 }} />
                    </Link>
                  )}
                </Box>
                {item.reviewed_at ? (
                  <Tooltip title={`Reviewed ${formatLocal(item.reviewed_at)}`}>
                    <Box sx={{ flexShrink: 0 }}>
                      {item.related_to_stock === false ? (
                        <Chip size="small" label="Unrelated" variant="outlined" sx={{ fontFamily: mono, fontWeight: 600, letterSpacing: "0.04em", flexShrink: 0, color: "#8a93a8", borderColor: hairline }} />
                      ) : (
                        <ImpactChip level={item.impact_level || "Reviewed"} />
                      )}
                    </Box>
                  </Tooltip>
                ) : (
                  <Tooltip title="Will be included in the next review">
                    <Chip size="small" label="Pending review" color="primary" sx={{ fontFamily: mono, fontWeight: 600, flexShrink: 0 }} />
                  </Tooltip>
                )}
              </Stack>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

export function StockDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const stockCodeParam = useParams().stockCode;
  const stockCode = stockCodeParam?.toUpperCase() ?? "";
  const [newsTab, setNewsTab] = useState<FeedTab>("all");
  const [filingTab, setFilingTab] = useState<FeedTab>("all");

  const stockQuery = useQuery({
    queryKey: ["stock", stockCode],
    queryFn: () => stockApi.getStock(stockCode),
    enabled: Boolean(stockCode),
    // Poll while a background review is running so the page updates when it finishes.
    refetchInterval: (query) => query.state.data?.review_status === "RUNNING" ? 3000 : false,
  });
  const thesisQuery = useQuery({
    queryKey: ["thesis", stockCode],
    queryFn: () => thesisApi.getThesis(stockCode),
    enabled: Boolean(stockCode),
    retry: false,
    // Poll every 3 s while the background job is running so the page updates when done.
    refetchInterval: (query) => query.state.data?.generation_status === "RUNNING" ? 3000 : false,
  });
  const newsQuery = useQuery({ queryKey: ["news", stockCode], queryFn: () => newsApi.getNews(stockCode), enabled: Boolean(stockCode) });
  const reviewQuery = useQuery({ queryKey: ["latest-review", stockCode], queryFn: () => reviewApi.getLatestReview(stockCode), enabled: Boolean(stockCode), retry: false });
  const memoryQuery = useQuery({ queryKey: ["monitor-memory", stockCode], queryFn: () => reviewApi.getMonitorMemory(stockCode), enabled: Boolean(stockCode), retry: false });
  const alertsQuery = useQuery({ queryKey: ["stock-alerts", stockCode], queryFn: () => alertApi.getStockAlerts(stockCode), enabled: Boolean(stockCode) });

  const generateThesis = useMutation({
    mutationFn: () => thesisApi.generateThesis(stockCode),
    onSuccess: (data) => {
      // Seed the cache with the 202 payload (status=RUNNING), then the refetchInterval takes over.
      queryClient.setQueryData(["thesis", stockCode], data);
    },
  });

  const ingestNews = useMutation({
    mutationFn: () => newsApi.ingestNews(stockCode),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["news", stockCode] });
    },
  });

  const invalidateAfterReview = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["latest-review", stockCode] }),
      queryClient.invalidateQueries({ queryKey: ["monitor-memory", stockCode] }),
      queryClient.invalidateQueries({ queryKey: ["news", stockCode] }),
      queryClient.invalidateQueries({ queryKey: ["stock", stockCode] }),
      queryClient.invalidateQueries({ queryKey: ["stock-alerts", stockCode] }),
      queryClient.invalidateQueries({ queryKey: ["alerts"] }),
    ]);
  };

  const reviewNews = useMutation({
    mutationFn: () => reviewApi.reviewNews(stockCode),
    onSuccess: invalidateAfterReview,
  });

  const autoReview = useMutation({
    mutationFn: () => reviewApi.autoReview(stockCode),
    onSuccess: (data) => {
      // Seed the stock cache with RUNNING status so polling starts immediately.
      queryClient.setQueryData(["stock", stockCode], (old: typeof stock) =>
        old ? { ...old, review_status: "RUNNING" } : old
      );
      // If the server returned a review synchronously (shouldn't happen now), invalidate immediately.
      if (data.review) invalidateAfterReview();
    },
  });

  // When review_status transitions from RUNNING to null/FAILED, refresh all review-related data.
  // Use stockQuery.data directly (not the `stock` variable below, which is declared after early returns).
  const prevReviewStatusRef = useRef(stockQuery.data?.review_status);
  useEffect(() => {
    const prev = prevReviewStatusRef.current;
    const curr = stockQuery.data?.review_status;
    if (prev === "RUNNING" && curr !== "RUNNING") {
      invalidateAfterReview();
    }
    prevReviewStatusRef.current = curr;
  }, [stockQuery.data?.review_status]);

  const resolveAlert = useMutation({
    mutationFn: alertApi.resolveAlert,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stock-alerts", stockCode] }),
        queryClient.invalidateQueries({ queryKey: ["alerts"] }),
      ]);
    },
  });

  const isReviewing = autoReview.isPending || stockQuery.data?.review_status === "RUNNING";
  const news = newsQuery.data ?? [];
  const pendingNewsCount = news.filter((item) => !item.reviewed_at).length;
  // SEC 8-K filings and Form 4 insider trades are ingested with source "SEC EDGAR"; everything
  // else (headlines, manually saved items) is news.
  const isFiling = (item: NewsItem) => (item.source || "").toUpperCase().includes("SEC EDGAR");
  const newsItems = news.filter((item) => !isFiling(item));
  const filingItems = news.filter((item) => isFiling(item));

  if (stockQuery.isLoading) {
    return <LoadingState text="Loading stock..." />;
  }

  if (stockQuery.isError) {
    return <ErrorState error={stockQuery.error} />;
  }

  const stock = stockQuery.data;
  const thesis = thesisQuery.data;
  const isGenerating = generateThesis.isPending || thesis?.generation_status === "RUNNING";
  const review = reviewQuery.data;
  const memory = memoryQuery.data;
  const alerts = alertsQuery.data ?? [];

  return (
    <Stack spacing={5}>
      {/* ── Masthead ─────────────────────────────────────────────── */}
      <Box>
        <Button startIcon={<ArrowBack />} onClick={() => navigate("/watchlist")} size="small" sx={{ mb: 1.5, color: "#5d6780" }}>
          Watchlist
        </Button>
        <Box
          sx={{
            bgcolor: ink,
            color: "#f4f6fb",
            borderRadius: 2,
            px: { xs: 3, sm: 5 },
            py: { xs: 3.5, sm: 4.5 },
            position: "relative",
            overflow: "hidden",
            backgroundImage:
              "radial-gradient(ellipse 90% 120% at 100% 0%, rgba(94,128,201,0.28), transparent 55%), repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(255,255,255,0.035) 31px, rgba(255,255,255,0.035) 32px)",
          }}
        >
          <Typography sx={{ fontFamily: mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(244,246,251,0.55)" }}>
            Equity Dossier
          </Typography>
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "flex-end" }} spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Typography sx={{ fontFamily: serif, fontWeight: 900, fontSize: { xs: 52, sm: 72 }, lineHeight: 0.95, letterSpacing: "-0.02em" }}>
                {stock?.stock_code}
              </Typography>
              <Typography sx={{ fontFamily: serif, fontWeight: 500, fontSize: { xs: 18, sm: 22 }, color: "rgba(244,246,251,0.85)", mt: 1 }}>
                {stock?.company_name}
              </Typography>
            </Box>
            <Stack spacing={1} alignItems={{ xs: "flex-start", md: "flex-end" }}>
              <StatusChip status={stock?.status} />
              <Typography sx={{ fontFamily: mono, fontSize: 12, color: "rgba(244,246,251,0.55)" }}>
                on watch since {stock?.created_at ? new Date(stock.created_at).toLocaleDateString() : "—"}
              </Typography>
            </Stack>
          </Stack>

          {thesis && (
            <>
            <Box
              sx={{
                mt: 3.5,
                pt: 2.5,
                borderTop: "1px solid rgba(255,255,255,0.18)",
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
                gap: 2.5,
              }}
            >
              {verdictFields.map(([key, label]) => (
                <Box key={key}>
                  <Typography sx={{ fontFamily: mono, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(244,246,251,0.5)" }}>
                    {label}
                  </Typography>
                  <Typography sx={{ fontFamily: serif, fontWeight: 700, fontSize: { xs: 20, sm: 24 }, lineHeight: 1.2, mt: 0.5, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {String(thesis[key] || "—")}
                  </Typography>
                </Box>
              ))}
            </Box>
            {thesis.position_guidance && (
              <Box sx={{ mt: 3, pt: 2.5, borderTop: "1px solid rgba(255,255,255,0.18)" }}>
                <Typography sx={{ fontFamily: mono, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(244,246,251,0.5)", mb: 0.75 }}>
                  Position &amp; Advice
                </Typography>
                <Typography sx={{ fontFamily: serif, fontSize: { xs: 15, sm: 16.5 }, lineHeight: 1.6, color: "rgba(244,246,251,0.92)", whiteSpace: "pre-wrap" }}>
                  {thesis.position_guidance}
                </Typography>
              </Box>
            )}
            </>
          )}
        </Box>
      </Box>

      {/* ── 01 · Buy Thesis ──────────────────────────────────────── */}
      <Section
        index="01"
        title="Buy Thesis"
        subtitle={thesis && thesis.generation_status !== "RUNNING" ? `Last updated ${formatLocal(thesis.updated_at)}` : "The standing case for owning this stock"}
        action={
          <Button startIcon={<AutoAwesome />} variant="contained" onClick={() => generateThesis.mutate()} disabled={isGenerating}>
            {isGenerating ? "Generating…" : thesis ? "Regenerate Thesis" : "Generate Thesis"}
          </Button>
        }
      >
        {isGenerating && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
        {isGenerating && <Alert severity="info" sx={{ mb: 2 }}>Generating thesis in the background — you can leave this page and come back.</Alert>}
        {generateThesis.isError && <ErrorState error={generateThesis.error} />}
        {thesis?.generation_status === "FAILED" && (
          <Alert severity="error" sx={{ mb: 2 }}>Generation failed: {thesis.generation_error || "Unknown error"}</Alert>
        )}
        {thesisQuery.isLoading && <LoadingState text="Loading thesis..." />}
        {!thesisQuery.isLoading && !thesis && !isGenerating && (
          <EmptyState title="No thesis on file" message="Generate a buy thesis to anchor daily news reviews for this stock." />
        )}

        {thesis && (
          <Stack spacing={3.5}>
            {/* Core thesis — the lead */}
            <Box sx={{ borderLeft: `4px solid ${ink}`, pl: { xs: 2.5, sm: 3.5 }, py: 0.5 }}>
              <FieldLabel>Core Thesis</FieldLabel>
              <Typography sx={{ fontFamily: serif, fontSize: { xs: 19, sm: 23 }, fontWeight: 500, lineHeight: 1.45, color: ink, whiteSpace: "pre-wrap" }}>
                {thesis.core_thesis}
              </Typography>
            </Box>

            {thesis.saved_buy_thesis_summary && (
              <Box>
                <FieldLabel>Thesis Summary</FieldLabel>
                <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7, color: "#2c3548" }}>{thesis.saved_buy_thesis_summary}</Typography>
              </Box>
            )}

            {/* Five pillars */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 0, border: `1px solid ${hairline}`, borderRadius: 2, overflow: "hidden" }}>
              {pillarFields.map(([key, label], i) => (
                <Box
                  key={key}
                  sx={{
                    p: 2.5,
                    bgcolor: "#fff",
                    borderBottom: i < pillarFields.length - 1 ? `1px solid ${hairline}` : "none",
                    borderRight: { md: i % 2 === 0 && i < pillarFields.length - 1 ? `1px solid ${hairline}` : "none" },
                    gridColumn: { md: i === pillarFields.length - 1 ? "1 / -1" : "auto" },
                  }}
                >
                  <Stack direction="row" spacing={1.25} alignItems="baseline" sx={{ mb: 0.75 }}>
                    <Typography sx={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: "#9aa3b8" }}>P{i + 1}</Typography>
                    <Typography sx={{ fontFamily: mono, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: ink }}>
                      {label}
                    </Typography>
                  </Stack>
                  <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.65, fontSize: 14.5, color: "#3a4356" }}>{String(thesis[key] || "—")}</Typography>
                </Box>
              ))}
            </Box>

            {/* Growth forecast — the 5-7 year return estimate */}
            {(thesis.return_multiple || thesis.return_basis) && (
              <Box sx={{ bgcolor: "#eef2fb", border: "1px solid #c9d4ec", borderRadius: 2, p: { xs: 2.5, sm: 3 } }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: thesis.return_basis ? 1.5 : 0 }}>
                  <Typography sx={{ fontFamily: mono, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#3f5074" }}>
                    Growth Forecast · 5-7 yr
                  </Typography>
                  {thesis.return_multiple && (
                    <Chip
                      size="small"
                      label={thesis.return_multiple}
                      sx={{ fontFamily: mono, fontWeight: 700, letterSpacing: "0.04em", bgcolor: "#2f4374", color: "#fff" }}
                    />
                  )}
                </Stack>
                {thesis.return_basis && (
                  <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: 0, listStyle: "none" }}>
                    {thesis.return_basis
                      .split(/\r?\n/)
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line, i) => (
                        <Typography component="li" key={i} sx={{ fontSize: 13.5, lineHeight: 1.6, color: "#3a4356" }}>
                          {line}
                        </Typography>
                      ))}
                  </Stack>
                )}
              </Box>
            )}

            {/* Risk watch panel */}
            <Box sx={{ bgcolor: "#fdf7ee", border: "1px solid #ecd9b8", borderRadius: 2, p: { xs: 2.5, sm: 3 } }}>
              <Typography sx={{ fontFamily: mono, fontSize: 11.5, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8a6a2f", mb: 2 }}>
                What could break this thesis
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2.5 }}>
                {watchFields.map(([key, label]) => (
                  <Box key={key}>
                    <Typography sx={{ fontFamily: serif, fontWeight: 700, fontSize: 16, color: "#5c4716", mb: 0.5 }}>{label}</Typography>
                    <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 14, color: "#564a31" }}>{String(thesis[key] || "—")}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Full document, tucked away */}
            {thesis.full_buy_thesis && (
              <Accordion disableGutters elevation={0} sx={{ border: `1px solid ${hairline}`, borderRadius: "8px !important", "&:before": { display: "none" } }}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography sx={{ fontFamily: mono, fontSize: 12.5, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: ink }}>
                    Full Buy Thesis — complete document
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ borderTop: `1px solid ${hairline}`, bgcolor: "#fafbfd" }}>
                  <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.75, fontSize: 14.5, color: "#2c3548" }}>{thesis.full_buy_thesis}</Typography>
                </AccordionDetails>
              </Accordion>
            )}
          </Stack>
        )}
      </Section>

      {/* ── 02 · Daily Review ────────────────────────────────────── */}
      <Section
        index="02"
        title="Daily Review"
        subtitle="The thesis-level verdict on the saved news — per-article classification appears in News & Filings below"
        action={
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              startIcon={<FactCheck />}
              variant="outlined"
              onClick={() => reviewNews.mutate()}
              disabled={reviewNews.isPending || isReviewing || !thesis}
            >
              {reviewNews.isPending ? "Reviewing…" : `Review Pending${pendingNewsCount > 0 ? ` (${pendingNewsCount})` : ""}`}
            </Button>
            <Button
              startIcon={<AutoAwesome />}
              variant="contained"
              onClick={() => autoReview.mutate()}
              disabled={isReviewing || reviewNews.isPending || !thesis}
            >
              {isReviewing ? "Auto reviewing…" : "Auto Review"}
            </Button>
          </Stack>
        }
      >
        <Stack spacing={2.5}>
          {(reviewNews.isPending || isReviewing) && <LinearProgress sx={{ borderRadius: 1 }} />}
          {isReviewing && (
            <Alert severity="info">Reviewing in background — you can leave this page and come back.</Alert>
          )}
          {stock?.review_status === "FAILED" && (
            <Alert severity="error">The background review failed. Check server logs for details, then try again.</Alert>
          )}
          {!thesis && <Alert severity="warning">Generate and save a buy thesis first — the review compares news against it.</Alert>}
          {thesis && !isReviewing && (
            <Alert severity="info">
              {pendingNewsCount > 0
                ? `${pendingNewsCount} saved item${pendingNewsCount === 1 ? "" : "s"} awaiting review. Auto Review also pulls in any fresh news first.`
                : "No unreviewed news is on file. Auto Review will fetch the latest news and review anything new; Review Pending alone would record \"No News Found\"."}
            </Alert>
          )}
          {autoReview.isSuccess && (
            <Alert severity="success">
              {autoReview.data.review
                ? `Auto Review saved ${autoReview.data.new_items_count} new item${autoReview.data.new_items_count === 1 ? "" : "s"} and reviewed the pending backlog.`
                : `Fetched ${autoReview.data.new_items_count} new item${autoReview.data.new_items_count === 1 ? "" : "s"} — review is running in the background.`}
            </Alert>
          )}
          {reviewNews.isError && <ErrorState error={reviewNews.error} />}
          {autoReview.isError && <ErrorState error={autoReview.error} />}

          {reviewQuery.isLoading && <LoadingState text="Loading latest review..." />}
          {!reviewQuery.isLoading && !review && (
            <EmptyState title="No review yet" message="Run the first daily review once a thesis and today's news are in place." />
          )}

          {review && (
            <Box sx={{ border: `1px solid ${hairline}`, borderRadius: 2, overflow: "hidden", bgcolor: "#fff" }}>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
                spacing={1.5}
                sx={{ px: 3, py: 2, bgcolor: "#fafbfd", borderBottom: `1px solid ${hairline}` }}
              >
                <Typography sx={{ fontFamily: mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8a93a8" }}>
                  Latest review · {formatLocal(review.created_at)}
                </Typography>
                <ChangeLevelChip level={review.thesis_change_level} />
              </Stack>

              <Box sx={{ mx: 3, mt: 2.5, px: 2.5, py: 2, bgcolor: "#f2f5fb", borderLeft: `4px solid ${ink}`, borderRadius: "0 8px 8px 0" }}>
                <FieldLabel>Recommended Action</FieldLabel>
                {(() => {
                  const actions = (review.recommended_action || "")
                    .split(/\r?\n/)
                    .map((line) => line.trim())
                    .filter(Boolean);
                  if (actions.length <= 1) {
                    return (
                      <Typography sx={{ fontFamily: serif, fontWeight: 600, fontSize: 16.5, lineHeight: 1.5, color: ink }}>
                        {actions[0] || "—"}
                      </Typography>
                    );
                  }
                  return (
                    <Stack component="ul" spacing={0.75} sx={{ m: 0, pl: 0, listStyle: "none" }}>
                      {actions.map((action, i) => (
                        <Stack component="li" key={i} direction="row" spacing={1.25} alignItems="baseline">
                          <Typography sx={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: "#8a93a8", flexShrink: 0 }}>
                            {String(i + 1).padStart(2, "0")}
                          </Typography>
                          <Typography sx={{ fontFamily: serif, fontWeight: 600, fontSize: 15.5, lineHeight: 1.5, color: ink }}>
                            {action}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  );
                })()}
              </Box>

              <Box sx={{ px: 3, py: 2.5 }}>
                <FieldLabel>Summary</FieldLabel>
                <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7, color: "#2c3548" }}>{review.summary}</Typography>
                <Box sx={{ mt: 2.5 }}>
                  <FieldLabel>Thesis Impact</FieldLabel>
                  <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7, color: "#2c3548" }}>{review.thesis_impact}</Typography>
                </Box>
              </Box>
            </Box>
          )}

          {/* Monitoring journal — the AI's accumulated memory across reviews */}
          {memory && memory.memory_text && (
            <Accordion disableGutters elevation={0} sx={{ border: `1px solid ${hairline}`, borderRadius: "8px !important", "&:before": { display: "none" } }}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }} sx={{ width: "100%" }} justifyContent="space-between">
                  <Typography sx={{ fontFamily: mono, fontSize: 12.5, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: ink }}>
                    Monitoring Journal — what the AI remembers
                  </Typography>
                  <Typography sx={{ fontFamily: mono, fontSize: 11, color: "#8a93a8" }}>
                    updated {new Date(memory.updated_at).toLocaleString()}
                  </Typography>
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ borderTop: `1px solid ${hairline}`, bgcolor: "#fafbfd" }}>
                <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7, fontSize: 14, color: "#2c3548" }}>{memory.memory_text}</Typography>
              </AccordionDetails>
            </Accordion>
          )}
        </Stack>
      </Section>

      {/* ── 03 · News ────────────────────────────────────────────── */}
      <Section
        index="03"
        title="News"
        subtitle="Fetch pulls the latest headlines (and filings) straight into the review backlog. Each item is classified by the daily review."
        action={
          <Button
            startIcon={<Refresh />}
            variant="contained"
            onClick={() => ingestNews.mutate()}
            disabled={ingestNews.isPending || !stockCode}
          >
            {ingestNews.isPending ? "Fetching…" : "Fetch Latest"}
          </Button>
        }
      >
        <Stack spacing={2.5}>
          {ingestNews.isPending && <LinearProgress sx={{ borderRadius: 1 }} />}
          {ingestNews.isError && <ErrorState error={ingestNews.error} />}
          {ingestNews.isSuccess && (
            <Alert severity="success">
              Fetched {ingestNews.data.new_items_count} new item{ingestNews.data.new_items_count === 1 ? "" : "s"} into the review backlog.
            </Alert>
          )}

          <NewsFeed
            items={newsItems}
            tab={newsTab}
            onTab={setNewsTab}
            isLoading={newsQuery.isLoading}
            isError={newsQuery.isError}
            error={newsQuery.error}
            loadingText="Loading news..."
            emptyTitle="No news on file"
            emptyMessage="Fetch the latest news — it goes straight into the backlog and is classified on the next daily review."
          />
        </Stack>
      </Section>

      {/* ── 04 · Filings ─────────────────────────────────────────── */}
      <Section
        index="04"
        title="Filings"
        subtitle="SEC 8-K filings and Form 4 insider trades from EDGAR, classified by the daily review"
      >
        <NewsFeed
          items={filingItems}
          tab={filingTab}
          onTab={setFilingTab}
          isLoading={newsQuery.isLoading}
          isError={newsQuery.isError}
          error={newsQuery.error}
          loadingText="Loading filings..."
          emptyTitle="No filings on file"
          emptyMessage="Fetch the latest — SEC 8-K filings and insider trades for US-listed stocks land here automatically."
        />
      </Section>

      {/* ── 05 · Alerts ──────────────────────────────────────────── */}
      <Section index="05" title="Alerts" subtitle="Raised automatically when a review flags a watch, material, or broken change">
        {alertsQuery.isLoading && <LoadingState text="Loading alerts..." />}
        {alertsQuery.isError && <ErrorState error={alertsQuery.error} />}
        {!alertsQuery.isLoading && alerts.length === 0 ? (
          <EmptyState title="All quiet" message="No alerts have been raised for this stock." />
        ) : (
          <Stack spacing={0} sx={{ border: `1px solid ${hairline}`, borderRadius: 2, overflow: "hidden", bgcolor: "#fff" }}>
            {alerts.map((alert, i) => (
              <Box key={alert.id} sx={{ p: 2.5, borderBottom: i < alerts.length - 1 ? `1px solid ${hairline}` : "none", opacity: alert.resolved ? 0.65 : 1 }}>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5}>
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap">
                      <SeverityChip severity={alert.severity} />
                      <Typography sx={{ fontFamily: serif, fontWeight: 700, fontSize: 16.5, color: ink }}>{alert.title}</Typography>
                    </Stack>
                    <Typography sx={{ fontFamily: mono, fontSize: 11.5, color: "#8a93a8", mt: 0.5 }}>{formatDate(alert.created_at)}</Typography>
                    <Typography sx={{ mt: 1, fontSize: 14.5, lineHeight: 1.65, color: "#3a4356" }}>{alert.message}</Typography>
                  </Box>
                  <Box sx={{ flexShrink: 0, alignSelf: { sm: "center" } }}>
                    {alert.resolved ? (
                      <Chip size="small" label="Resolved" color="success" variant="outlined" sx={{ fontFamily: mono, fontWeight: 600 }} />
                    ) : (
                      <Button variant="outlined" size="small" onClick={() => resolveAlert.mutate(alert.id)} disabled={resolveAlert.isPending}>
                        Resolve
                      </Button>
                    )}
                  </Box>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Section>
    </Stack>
  );
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "Unknown date";
}
