import {
  ArrowBack,
  AutoAwesome,
  Bookmark,
  BookmarkAdded,
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
  Divider,
  LinearProgress,
  Link,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import type { FetchedNewsItem, NewsCreateRequest, StockThesis } from "../types";

const ink = "#172033";
const serif = '"Fraunces", Georgia, "Times New Roman", serif';
const mono = '"IBM Plex Mono", Consolas, "Courier New", monospace';
const hairline = "#dde3ee";

const verdictFields: Array<[keyof StockThesis, string]> = [
  ["final_rating", "Final Rating"],
  ["conviction", "Conviction"],
  ["portfolio_role", "Portfolio Role"],
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

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function toCreateRequest(item: FetchedNewsItem): NewsCreateRequest {
  return {
    title: item.title.slice(0, 500),
    summary: item.summary || undefined,
    url: item.url && item.url.length <= 1000 ? item.url : undefined,
    // published_date intentionally omitted: the API defaults it to today,
    // which is the only date the daily review scans.
  };
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

export function StockDetailPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const stockCodeParam = useParams().stockCode;
  const stockCode = stockCodeParam?.toUpperCase() ?? "";
  const [newsFetchDate, setNewsFetchDate] = useState(localToday);

  const stockQuery = useQuery({ queryKey: ["stock", stockCode], queryFn: () => stockApi.getStock(stockCode), enabled: Boolean(stockCode) });
  const thesisQuery = useQuery({ queryKey: ["thesis", stockCode], queryFn: () => thesisApi.getThesis(stockCode), enabled: Boolean(stockCode), retry: false });
  const newsQuery = useQuery({ queryKey: ["news", stockCode], queryFn: () => newsApi.getNews(stockCode), enabled: Boolean(stockCode) });
  const secFilingsQuery = useQuery({ queryKey: ["sec-filings", stockCode], queryFn: () => newsApi.fetchSecFilings(stockCode), enabled: Boolean(stockCode) });
  const insiderTradesQuery = useQuery({ queryKey: ["insider-trades", stockCode], queryFn: () => newsApi.fetchInsiderTrades(stockCode), enabled: Boolean(stockCode) });
  const reviewQuery = useQuery({ queryKey: ["latest-review", stockCode], queryFn: () => reviewApi.getLatestReview(stockCode), enabled: Boolean(stockCode), retry: false });
  const alertsQuery = useQuery({ queryKey: ["stock-alerts", stockCode], queryFn: () => alertApi.getStockAlerts(stockCode), enabled: Boolean(stockCode) });

  const generateThesis = useMutation({
    mutationFn: () => thesisApi.generateThesis(stockCode),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["thesis", stockCode] });
    },
  });

  const fetchNews = useMutation({
    mutationFn: async () => {
      const settled = await Promise.allSettled([
        newsApi.fetchLatestNews(stockCode, newsFetchDate),
        newsApi.fetchSecFilings(stockCode, newsFetchDate),
        newsApi.fetchInsiderTrades(stockCode, newsFetchDate),
      ]);
      const sources = ["headlines", "SEC filings", "insider trades"] as const;
      if (settled.every((result) => result.status === "rejected")) {
        throw (settled[0] as PromiseRejectedResult).reason;
      }
      return {
        items: settled.flatMap((result) => (result.status === "fulfilled" ? result.value : [])),
        failedSources: sources.filter((_, i) => settled[i].status === "rejected"),
      };
    },
  });

  const saveOne = useMutation({
    mutationFn: (item: FetchedNewsItem) => newsApi.saveNews(stockCode, toCreateRequest(item)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["news", stockCode] });
    },
  });

  const saveAll = useMutation({
    mutationFn: async (items: FetchedNewsItem[]) => {
      for (const item of items) {
        await newsApi.saveNews(stockCode, toCreateRequest(item));
      }
      return items.length;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["news", stockCode] });
    },
  });

  const reviewNews = useMutation({
    mutationFn: () => reviewApi.reviewNews(stockCode),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["latest-review", stockCode] }),
        queryClient.invalidateQueries({ queryKey: ["stock", stockCode] }),
        queryClient.invalidateQueries({ queryKey: ["stock-alerts", stockCode] }),
        queryClient.invalidateQueries({ queryKey: ["alerts"] }),
      ]);
    },
  });

  const resolveAlert = useMutation({
    mutationFn: alertApi.resolveAlert,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stock-alerts", stockCode] }),
        queryClient.invalidateQueries({ queryKey: ["alerts"] }),
      ]);
    },
  });

  const news = newsQuery.data ?? [];

  // Key on url + title together: insider trades from the same Form 4 filing
  // share one URL, so URL alone cannot identify a saved item.
  const savedKey = (title: string, url?: string | null) =>
    `${url ?? ""}||${title.slice(0, 500).trim().toLowerCase()}`;

  const savedKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const item of news) {
      keys.add(savedKey(item.title, item.url));
    }
    return keys;
  }, [news]);

  const isSaved = (item: FetchedNewsItem) =>
    savedKeys.has(savedKey(item.title, item.url && item.url.length <= 1000 ? item.url : undefined));

  const fetched = fetchNews.data?.items ?? [];
  const failedSources = fetchNews.data?.failedSources ?? [];
  const unsavedFetched = fetched.filter((item) => !isSaved(item));
  const todayIso = localToday();
  const todayNewsCount = news.filter((item) => item.published_date === todayIso).length;

  if (stockQuery.isLoading) {
    return <LoadingState text="Loading stock..." />;
  }

  if (stockQuery.isError) {
    return <ErrorState error={stockQuery.error} />;
  }

  const stock = stockQuery.data;
  const thesis = thesisQuery.data;
  const review = reviewQuery.data;
  const alerts = alertsQuery.data ?? [];

  const usListed = !stock?.exchange || ["NASDAQ", "NYSE", "AMEX", "NYSE ARCA"].includes(stock.exchange.toUpperCase());

  const renderSecList = (
    query: typeof secFilingsQuery,
    label: string,
    emptyMessage: string,
  ) => {
    const all = query.data ?? [];
    const items = all.slice(0, 10);
    return (
      <Box>
        <Typography sx={{ fontFamily: mono, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7590", mb: 1.5 }}>
          {label}
          {all.length > 0 && ` — ${items.length}${all.length > items.length ? ` of ${all.length}` : ""}`}
        </Typography>
        {query.isLoading && <LoadingState text={`Loading ${label.toLowerCase()}...`} />}
        {query.isError && <ErrorState error={query.error} />}
        {query.isSuccess && items.length === 0 && <EmptyState title="Nothing on record" message={emptyMessage} />}
        {items.length > 0 && (
          <Stack spacing={0} sx={{ border: `1px solid ${hairline}`, borderRadius: 2, overflow: "hidden", bgcolor: "#fff" }}>
            {items.map((item, i) => {
              const saved = isSaved(item);
              const savingThis = saveOne.isPending && saveOne.variables === item;
              return (
                <Box key={`${item.url || item.title}-${i}`} sx={{ p: 2, borderBottom: i < items.length - 1 ? `1px solid ${hairline}` : "none" }}>
                  <Stack direction="row" spacing={1.5} justifyContent="space-between" alignItems="flex-start">
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontFamily: serif, fontWeight: 700, fontSize: 15, lineHeight: 1.35, color: ink }}>{item.title}</Typography>
                      <Typography sx={{ fontFamily: mono, fontSize: 11.5, color: "#8a93a8", mt: 0.5 }}>
                        filed {item.published_date || "unknown date"} · {item.source || "SEC EDGAR"}
                      </Typography>
                      {item.url && (
                        <Link href={item.url} target="_blank" rel="noreferrer" sx={{ fontFamily: mono, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 0.5, mt: 0.75 }}>
                          View on EDGAR <OpenInNew sx={{ fontSize: 13 }} />
                        </Link>
                      )}
                    </Box>
                    <Box sx={{ flexShrink: 0 }}>
                      {saved ? (
                        <Chip size="small" icon={<BookmarkAdded />} label="Saved" color="success" variant="outlined" sx={{ fontFamily: mono, fontWeight: 600 }} />
                      ) : (
                        <Button size="small" variant="outlined" startIcon={<Bookmark />} onClick={() => saveOne.mutate(item)} disabled={savingThis || saveAll.isPending}>
                          {savingThis ? "Saving…" : "Save"}
                        </Button>
                      )}
                    </Box>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}
      </Box>
    );
  };

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
            <Box
              sx={{
                mt: 3.5,
                pt: 2.5,
                borderTop: "1px solid rgba(255,255,255,0.18)",
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                gap: 2.5,
              }}
            >
              {verdictFields.map(([key, label]) => (
                <Box key={key}>
                  <Typography sx={{ fontFamily: mono, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(244,246,251,0.5)" }}>
                    {label}
                  </Typography>
                  <Typography sx={{ fontFamily: serif, fontWeight: 700, fontSize: { xs: 20, sm: 24 }, lineHeight: 1.2, mt: 0.5 }}>
                    {String(thesis[key] || "—")}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </Box>

      {/* ── 01 · Buy Thesis ──────────────────────────────────────── */}
      <Section
        index="01"
        title="Buy Thesis"
        subtitle={thesis ? `Last updated ${new Date(thesis.updated_at).toLocaleString()}` : "The standing case for owning this stock"}
        action={
          <Button startIcon={<AutoAwesome />} variant="contained" onClick={() => generateThesis.mutate()} disabled={generateThesis.isPending}>
            {generateThesis.isPending ? "Generating…" : thesis ? "Regenerate Thesis" : "Generate Thesis"}
          </Button>
        }
      >
        {generateThesis.isPending && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}
        {generateThesis.isError && <ErrorState error={generateThesis.error} />}
        {thesisQuery.isLoading && <LoadingState text="Loading thesis..." />}
        {!thesisQuery.isLoading && !thesis && !generateThesis.isPending && (
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

      {/* ── 02 · News Desk ───────────────────────────────────────── */}
      <Section
        index="02"
        title="News Desk"
        subtitle="Fetch headlines, SEC 8-K filings, and insider trades; save the relevant ones, then run the daily review"
        action={
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField
              label="News date"
              type="date"
              size="small"
              value={newsFetchDate}
              onChange={(event) => setNewsFetchDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
            />
            <Button startIcon={<Refresh />} variant="contained" onClick={() => fetchNews.mutate()} disabled={fetchNews.isPending || !stockCode || !newsFetchDate}>
              {fetchNews.isPending ? "Fetching…" : "Fetch News"}
            </Button>
          </Stack>
        }
      >
        <Stack spacing={3}>
          {fetchNews.isPending && <LinearProgress sx={{ borderRadius: 1 }} />}
          {fetchNews.isError && <ErrorState error={fetchNews.error} />}

          {/* Step 1 result: fetched preview */}
          {fetchNews.isSuccess && (
            <Box>
              {failedSources.length > 0 && (
                <Alert severity="warning" sx={{ mb: 1.5 }}>
                  Could not fetch {failedSources.join(" and ")} — showing results from the remaining sources.
                </Alert>
              )}
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1.5} sx={{ mb: 1.5 }}>
                <Typography sx={{ fontFamily: mono, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7590" }}>
                  Wire results — {fetched.length} item{fetched.length === 1 ? "" : "s"} for {newsFetchDate}
                </Typography>
                {unsavedFetched.length > 0 && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Bookmark />}
                    onClick={() => saveAll.mutate(unsavedFetched)}
                    disabled={saveAll.isPending || saveOne.isPending}
                  >
                    {saveAll.isPending ? "Saving…" : `Save all ${unsavedFetched.length} for review`}
                  </Button>
                )}
              </Stack>

              {fetched.length === 0 ? (
                <EmptyState title="Nothing on the wire" message="No headlines, SEC filings, or insider trades were returned for this date. Try another date or fetch again later." />
              ) : (
                <Stack spacing={0} sx={{ border: `1px solid ${hairline}`, borderRadius: 2, overflow: "hidden", bgcolor: "#fff" }}>
                  {fetched.map((item, i) => {
                    const saved = isSaved(item);
                    const savingThis = saveOne.isPending && saveOne.variables === item;
                    return (
                      <Box key={`${item.url || item.title}-${i}`} sx={{ p: 2.25, borderBottom: i < fetched.length - 1 ? `1px solid ${hairline}` : "none" }}>
                        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between">
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontFamily: serif, fontWeight: 700, fontSize: 16.5, lineHeight: 1.35, color: ink }}>{item.title}</Typography>
                            <Typography sx={{ fontFamily: mono, fontSize: 11.5, color: "#8a93a8", mt: 0.5 }}>
                              {[item.source, item.published_date].filter(Boolean).join(" · ") || "source unknown"}
                            </Typography>
                            {item.summary && (
                              <Typography sx={{ mt: 1, fontSize: 14, lineHeight: 1.6, color: "#3a4356" }}>{item.summary}</Typography>
                            )}
                            {item.url && (
                              <Link href={item.url} target="_blank" rel="noreferrer" sx={{ fontFamily: mono, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 0.5, mt: 0.75 }}>
                                Read source <OpenInNew sx={{ fontSize: 13 }} />
                              </Link>
                            )}
                          </Box>
                          <Box sx={{ flexShrink: 0 }}>
                            {saved ? (
                              <Chip size="small" icon={<BookmarkAdded />} label="Saved" color="success" variant="outlined" sx={{ fontFamily: mono, fontWeight: 600 }} />
                            ) : (
                              <Button size="small" variant="outlined" startIcon={<Bookmark />} onClick={() => saveOne.mutate(item)} disabled={savingThis || saveAll.isPending}>
                                {savingThis ? "Saving…" : "Save"}
                              </Button>
                            )}
                          </Box>
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              )}
              <Typography sx={{ fontFamily: mono, fontSize: 11.5, color: "#8a93a8", mt: 1 }}>
                Saved headlines are filed under today's date so the next daily review picks them up.
              </Typography>
            </Box>
          )}
          {(saveOne.isError || saveAll.isError) && <ErrorState error={saveOne.error ?? saveAll.error} />}

          {/* Step 2: what's on file */}
          <Box>
            <Typography sx={{ fontFamily: mono, fontSize: 12, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7590", mb: 1.5 }}>
              On file — {news.length} saved · {todayNewsCount} dated today
            </Typography>
            {newsQuery.isLoading && <LoadingState text="Loading saved news..." />}
            {newsQuery.isError && <ErrorState error={newsQuery.error} />}
            {!newsQuery.isLoading && news.length === 0 ? (
              <EmptyState title="No news on file" message="Fetched headlines are only previews — save the ones that matter and they will appear here for the daily review." />
            ) : (
              <Stack spacing={0} sx={{ border: `1px solid ${hairline}`, borderRadius: 2, overflow: "hidden", bgcolor: "#fff" }}>
                {news.map((item, i) => (
                  <Box key={item.id} sx={{ p: 2.25, borderBottom: i < news.length - 1 ? `1px solid ${hairline}` : "none" }}>
                    <Stack direction="row" spacing={1.5} justifyContent="space-between" alignItems="flex-start">
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontFamily: serif, fontWeight: 700, fontSize: 16, lineHeight: 1.35, color: ink }}>{item.title}</Typography>
                        <Typography sx={{ fontFamily: mono, fontSize: 11.5, color: "#8a93a8", mt: 0.5 }}>
                          filed {item.published_date || "unknown date"}
                        </Typography>
                        {item.summary && <Typography sx={{ mt: 1, fontSize: 14, lineHeight: 1.6, color: "#3a4356" }}>{item.summary}</Typography>}
                        {item.url && (
                          <Link href={item.url} target="_blank" rel="noreferrer" sx={{ fontFamily: mono, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 0.5, mt: 0.75 }}>
                            Read source <OpenInNew sx={{ fontSize: 13 }} />
                          </Link>
                        )}
                      </Box>
                      {item.published_date === todayIso && (
                        <Tooltip title="Will be included in the next daily review">
                          <Chip size="small" label="In today's review" color="primary" sx={{ fontFamily: mono, fontWeight: 600, flexShrink: 0 }} />
                        </Tooltip>
                      )}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      </Section>

      {/* ── 03 · SEC Activity ────────────────────────────────────── */}
      <Section
        index="03"
        title="SEC Activity"
        subtitle="Recent 8-K filings and Form 4 insider trades straight from EDGAR — save any that matter to the thesis"
      >
        {!usListed ? (
          <Alert severity="info">
            SEC EDGAR only covers US-listed companies, so no filings or insider trades are available for {stock?.exchange}-listed{" "}
            {stock?.stock_code}.
          </Alert>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2, 1fr)" }, gap: 3, alignItems: "start" }}>
            {renderSecList(
              secFilingsQuery,
              "Recent 8-K filings",
              "No 8-K filings found for this company on EDGAR.",
            )}
            {renderSecList(
              insiderTradesQuery,
              "Recent insider trades (Form 4)",
              "No recent insider transactions found for this company on EDGAR.",
            )}
          </Box>
        )}
      </Section>

      {/* ── 04 · Daily Review ────────────────────────────────────── */}
      <Section
        index="04"
        title="Daily Review"
        subtitle="AI reads today's saved news against the thesis and flags any change"
        action={
          <Button startIcon={<FactCheck />} variant="contained" onClick={() => reviewNews.mutate()} disabled={reviewNews.isPending || !thesis}>
            {reviewNews.isPending ? "Reviewing…" : `Review Today's News${todayNewsCount > 0 ? ` (${todayNewsCount})` : ""}`}
          </Button>
        }
      >
        <Stack spacing={2.5}>
          {reviewNews.isPending && <LinearProgress sx={{ borderRadius: 1 }} />}
          {!thesis && <Alert severity="warning">Generate and save a buy thesis first — the review compares news against it.</Alert>}
          {thesis && todayNewsCount === 0 && (
            <Alert severity="info">
              No saved news is dated today, so running the review now will record "No News Found". Fetch and save headlines in the News Desk above first.
            </Alert>
          )}
          {reviewNews.isError && <ErrorState error={reviewNews.error} />}

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
                  Latest review · {review.review_date}
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

              {review.news_analysis.length > 0 && (
                <>
                  <Divider />
                  <Box sx={{ px: 3, py: 2.5 }}>
                    <FieldLabel>Article-by-article analysis</FieldLabel>
                    <Stack spacing={0} sx={{ mt: 1, border: `1px solid ${hairline}`, borderRadius: 2, overflow: "hidden" }}>
                      {review.news_analysis.map((item, i) => (
                        <Box key={item.id} sx={{ p: 2, bgcolor: "#fafbfd", borderBottom: i < review.news_analysis.length - 1 ? `1px solid ${hairline}` : "none" }}>
                          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1}>
                            <Typography sx={{ fontFamily: serif, fontWeight: 700, fontSize: 15, color: ink }}>{item.news_title}</Typography>
                            <Chip size="small" label={item.impact_level} variant="outlined" sx={{ fontFamily: mono, fontWeight: 600, flexShrink: 0 }} />
                          </Stack>
                          <Typography sx={{ mt: 1, fontSize: 14, lineHeight: 1.65, color: "#3a4356" }}>{item.analysis}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                </>
              )}
            </Box>
          )}
        </Stack>
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
