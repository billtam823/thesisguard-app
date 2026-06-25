import {
  ArrowBack,
  AutoAwesome,
  ExpandMore,
  OpenInNew,
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
  MenuItem,
  Stack,
  TextField,
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

// Rank a reviewed item by impact so the most material news sorts to the top of a review's list.
function impactRank(item: NewsItem): number {
  if (item.related_to_stock === false) return 0;
  const n = (item.impact_level || "").toLowerCase();
  if (n.includes("critical") || n.includes("broken")) return 4;
  if (n.includes("material") || n.includes("major") || n.includes("high")) return 3;
  if (n.includes("watch") || n.includes("minor") || n.includes("medium") || n.includes("low")) return 2;
  return 1; // noise / none
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

// A flat list of saved news/filing item cards, scoped to a single review by the caller.
function NewsItemList({ items, emptyTitle, emptyMessage }: { items: NewsItem[]; emptyTitle: string; emptyMessage: string }) {
  if (items.length === 0) {
    return <EmptyState title={emptyTitle} message={emptyMessage} />;
  }
  return (
    <Stack spacing={0} sx={{ border: `1px solid ${hairline}`, borderRadius: 2, overflow: "hidden", bgcolor: "#fff" }}>
      {items.map((item, i) => (
        <Box key={item.id} sx={{ p: 2.25, borderBottom: i < items.length - 1 ? `1px solid ${hairline}` : "none" }}>
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
            <Tooltip title={item.reviewed_at ? `Reviewed ${formatLocal(item.reviewed_at)}` : "Pending review"}>
              <Box sx={{ flexShrink: 0 }}>
                {item.related_to_stock === false ? (
                  <Chip size="small" label="Unrelated" variant="outlined" sx={{ fontFamily: mono, fontWeight: 600, letterSpacing: "0.04em", flexShrink: 0, color: "#8a93a8", borderColor: hairline }} />
                ) : (
                  <ImpactChip level={item.impact_level || "Reviewed"} />
                )}
              </Box>
            </Tooltip>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

export function StockDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const stockCodeParam = useParams().stockCode;
  const stockCode = stockCodeParam?.toUpperCase() ?? "";
  const [selectedReviewId, setSelectedReviewId] = useState<number | null>(null);

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
  const reviewsQuery = useQuery({ queryKey: ["daily-reviews", stockCode], queryFn: () => reviewApi.getDailyReviews(stockCode), enabled: Boolean(stockCode), retry: false });
  const memoryQuery = useQuery({ queryKey: ["monitor-memory", stockCode], queryFn: () => reviewApi.getMonitorMemory(stockCode), enabled: Boolean(stockCode), retry: false });
  const alertsQuery = useQuery({ queryKey: ["stock-alerts", stockCode], queryFn: () => alertApi.getStockAlerts(stockCode), enabled: Boolean(stockCode) });

  const generateThesis = useMutation({
    mutationFn: () => thesisApi.generateThesis(stockCode),
    onSuccess: (data) => {
      // Seed the cache with the 202 payload (status=RUNNING), then the refetchInterval takes over.
      queryClient.setQueryData(["thesis", stockCode], data);
    },
  });

  const invalidateAfterReview = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["daily-reviews", stockCode] }),
      queryClient.invalidateQueries({ queryKey: ["monitor-memory", stockCode] }),
      queryClient.invalidateQueries({ queryKey: ["news", stockCode] }),
      queryClient.invalidateQueries({ queryKey: ["stock", stockCode] }),
      queryClient.invalidateQueries({ queryKey: ["stock-alerts", stockCode] }),
      queryClient.invalidateQueries({ queryKey: ["alerts"] }),
    ]);
  };

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
      setSelectedReviewId(null); // jump to the newest (just-completed) review
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
  // SEC 8-K filings and Form 4 insider trades are ingested with source "SEC EDGAR"; everything
  // else (headlines, manually saved items) is news.
  const isFiling = (item: NewsItem) => (item.source || "").toUpperCase().includes("SEC EDGAR");
  const reviews = reviewsQuery.data ?? [];
  const selectedReview = reviews.find((r) => r.id === selectedReviewId) ?? reviews[0] ?? null;
  const reviewItemIds = new Set((selectedReview?.news_analysis ?? []).map((a) => a.news_item_id));
  const reviewNewsItems = news.filter((item) => reviewItemIds.has(item.id)).sort((a, b) => impactRank(b) - impactRank(a));
  const scopedNews = reviewNewsItems.filter((item) => !isFiling(item));
  const scopedFilings = reviewNewsItems.filter((item) => isFiling(item));

  if (stockQuery.isLoading) {
    return <LoadingState text="Loading stock..." />;
  }

  if (stockQuery.isError) {
    return <ErrorState error={stockQuery.error} />;
  }

  const stock = stockQuery.data;
  const thesis = thesisQuery.data;
  const isGenerating = generateThesis.isPending || thesis?.generation_status === "RUNNING";
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
        subtitle="The thesis-level verdict on each batch of reviewed news. Pick a past review to revisit it."
        action={
          <Button
            startIcon={<AutoAwesome />}
            variant="contained"
            onClick={() => autoReview.mutate()}
            disabled={isReviewing || !thesis}
          >
            {isReviewing ? "Auto reviewing…" : "Auto Review"}
          </Button>
        }
      >
        <Stack spacing={2.5}>
          {isReviewing && <LinearProgress sx={{ borderRadius: 1 }} />}
          {isReviewing && (
            <Alert severity="info">Reviewing in background — fetching the latest news and assessing it against your thesis. You can leave this page and come back.</Alert>
          )}
          {stock?.review_status === "FAILED" && (
            <Alert severity="error">The background review failed. Check server logs for details, then try again.</Alert>
          )}
          {!thesis && <Alert severity="warning">Generate and save a buy thesis first — the review compares news against it.</Alert>}
          {autoReview.isError && <ErrorState error={autoReview.error} />}

          {reviewsQuery.isLoading && <LoadingState text="Loading reviews..." />}
          {!reviewsQuery.isLoading && reviews.length === 0 && (
            <EmptyState title="No review yet" message="Run Auto Review — it fetches the latest news and assesses it against your thesis." />
          )}

          {selectedReview && (
            <>
              <TextField
                select
                size="small"
                label="Review"
                value={selectedReview.id}
                onChange={(event) => setSelectedReviewId(Number(event.target.value))}
                sx={{ maxWidth: 380 }}
              >
                {reviews.map((r) => (
                  <MenuItem key={r.id} value={r.id}>
                    {formatLocal(r.created_at)} · {r.thesis_change_level}
                  </MenuItem>
                ))}
              </TextField>

              <Box sx={{ border: `1px solid ${hairline}`, borderRadius: 2, overflow: "hidden", bgcolor: "#fff" }}>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  spacing={1.5}
                  sx={{ px: 3, py: 2, bgcolor: "#fafbfd", borderBottom: `1px solid ${hairline}` }}
                >
                  <Typography sx={{ fontFamily: mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8a93a8" }}>
                    Review · {formatLocal(selectedReview.created_at)}
                  </Typography>
                  <ChangeLevelChip level={selectedReview.thesis_change_level} />
                </Stack>

                <Box sx={{ mx: 3, mt: 2.5, px: 2.5, py: 2, bgcolor: "#f2f5fb", borderLeft: `4px solid ${ink}`, borderRadius: "0 8px 8px 0" }}>
                  <FieldLabel>Recommended Action</FieldLabel>
                  {(() => {
                    const actions = (selectedReview.recommended_action || "")
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
                  <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7, color: "#2c3548" }}>{selectedReview.summary}</Typography>
                  <Box sx={{ mt: 2.5 }}>
                    <FieldLabel>Thesis Impact</FieldLabel>
                    <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7, color: "#2c3548" }}>{selectedReview.thesis_impact}</Typography>
                  </Box>
                </Box>
              </Box>
            </>
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
        subtitle="Headlines included in the selected review."
      >
        {newsQuery.isLoading ? (
          <LoadingState text="Loading news..." />
        ) : newsQuery.isError ? (
          <ErrorState error={newsQuery.error} />
        ) : (
          <NewsItemList
            items={scopedNews}
            emptyTitle="No news in this review"
            emptyMessage="This review included no headlines. Run Auto Review to pull and assess the latest news."
          />
        )}
      </Section>

      {/* ── 04 · Filings ─────────────────────────────────────────── */}
      <Section
        index="04"
        title="Filings"
        subtitle="SEC 8-K filings and Form 4 insider trades included in the selected review."
      >
        {newsQuery.isLoading ? (
          <LoadingState text="Loading filings..." />
        ) : newsQuery.isError ? (
          <ErrorState error={newsQuery.error} />
        ) : (
          <NewsItemList
            items={scopedFilings}
            emptyTitle="No filings in this review"
            emptyMessage="This review included no SEC filings or insider trades."
          />
        )}
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
