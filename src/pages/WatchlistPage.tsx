import { Add } from "@mui/icons-material";
import { Button, Card, CardActionArea, CardContent, Grid, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { stockApi } from "../api/stockApi";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { StatusChip } from "../components/StatusChip";

export function WatchlistPage() {
  const navigate = useNavigate();
  const stocksQuery = useQuery({ queryKey: ["stocks"], queryFn: stockApi.getStocks });

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
              <Card variant="outlined" sx={{ borderRadius: 2, height: "100%" }}>
                <CardActionArea sx={{ height: "100%" }} onClick={() => navigate(`/stocks/${stock.stock_code}`)}>
                  <CardContent>
                    <Stack spacing={2}>
                      <Stack direction="row" justifyContent="space-between" spacing={2}>
                        <Typography variant="h5" fontWeight={900}>
                          {stock.stock_code}
                        </Typography>
                        <StatusChip status={stock.status} />
                      </Stack>
                      <Typography fontWeight={700}>{stock.company_name}</Typography>
                      <Typography color="text.secondary">Sector and theme are not returned by the current API.</Typography>
                    </Stack>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Stack>
  );
}
