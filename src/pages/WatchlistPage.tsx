import { Add, ArrowForward, DeleteOutline } from "@mui/icons-material";
import {
  Button,
  Card,
  CardActionArea,
  CardActions,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { stockApi } from "../api/stockApi";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { StatusChip } from "../components/StatusChip";
import type { Stock } from "../types";

export function WatchlistPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const stocksQuery = useQuery({ queryKey: ["stocks"], queryFn: stockApi.getStocks });
  const [pendingRemoval, setPendingRemoval] = useState<Stock | null>(null);

  const removeStock = useMutation({
    mutationFn: (stockCode: string) => stockApi.deleteStock(stockCode),
    onSuccess: () => {
      setPendingRemoval(null);
      queryClient.invalidateQueries({ queryKey: ["stocks"] });
    },
  });

  if (stocksQuery.isLoading) {
    return <LoadingState text="Loading watchlist..." />;
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="h4" fontWeight={900}>
            Watchlist
          </Typography>
          <Typography color="text.secondary">Long-term holdings under thesis monitoring.</Typography>
        </Stack>
        <Button startIcon={<Add />} variant="contained" onClick={() => navigate("/watchlist/new")}>
          Add Stock
        </Button>
      </Stack>

      {stocksQuery.isError && <ErrorState error={stocksQuery.error} />}

      {stocksQuery.data?.length === 0 ? (
        <EmptyState title="No stocks yet" message="Add a company to start monitoring its long-term buy thesis." />
      ) : (
        <Grid container spacing={2}>
          {stocksQuery.data?.map((stock) => (
            <Grid item xs={12} md={6} lg={4} key={stock.id}>
              <Card
                variant="outlined"
                sx={{
                  borderRadius: 2,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  transition: "transform .15s ease, box-shadow .15s ease, border-color .15s ease",
                  "&:hover": {
                    borderColor: "primary.main",
                    boxShadow: "0 6px 20px rgba(36, 84, 166, 0.15)",
                    transform: "translateY(-2px)",
                  },
                  "&:hover .view-details-arrow": { transform: "translateX(3px)" },
                }}
              >
                <CardActionArea sx={{ flexGrow: 1 }} onClick={() => navigate(`/stocks/${stock.stock_code}`)}>
                  <CardContent>
                    <Stack spacing={2}>
                      <Stack direction="row" justifyContent="space-between" spacing={2}>
                        <Typography variant="h5" fontWeight={900}>
                          {stock.stock_code}
                        </Typography>
                        <StatusChip status={stock.status} />
                      </Stack>
                      <Typography fontWeight={700}>{stock.company_name}</Typography>
                      <Typography color="text.secondary">
                        {[stock.sector, stock.industry].filter(Boolean).join(" · ") || "—"}
                      </Typography>
                    </Stack>
                  </CardContent>
                </CardActionArea>
                <CardActions sx={{ justifyContent: "space-between", px: 2, pb: 1.5, pt: 0 }}>
                  <Button
                    size="small"
                    endIcon={<ArrowForward className="view-details-arrow" sx={{ transition: "transform .15s ease" }} />}
                    onClick={() => navigate(`/stocks/${stock.stock_code}`)}
                  >
                    View details
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteOutline />}
                    onClick={() => setPendingRemoval(stock)}
                  >
                    Remove
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={Boolean(pendingRemoval)} onClose={() => !removeStock.isPending && setPendingRemoval(null)}>
        <DialogTitle>Remove {pendingRemoval?.stock_code} from the watchlist?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently deletes {pendingRemoval?.company_name} along with its saved thesis, news, daily reviews, and
            alerts. This cannot be undone.
          </DialogContentText>
          {removeStock.isError && (
            <Stack sx={{ mt: 2 }}>
              <ErrorState error={removeStock.error} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingRemoval(null)} disabled={removeStock.isPending}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => pendingRemoval && removeStock.mutate(pendingRemoval.stock_code)}
            disabled={removeStock.isPending}
          >
            {removeStock.isPending ? "Removing…" : "Remove"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
