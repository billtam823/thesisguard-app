import { ArrowBack } from "@mui/icons-material";
import { Alert, Autocomplete, Button, Card, CardContent, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { stockApi } from "../api/stockApi";
import { ErrorState } from "../components/ErrorState";
import type { StockSearchMatch } from "../types";

export function AddStockPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ticker, setTicker] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [selectedStock, setSelectedStock] = useState<StockSearchMatch | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  // Debounce the typed query before hitting the lookup endpoint.
  useEffect(() => {
    const id = setTimeout(() => setSearchTerm(inputValue.trim()), 300);
    return () => clearTimeout(id);
  }, [inputValue]);

  const searchQuery = useQuery({
    queryKey: ["stock-search", searchTerm],
    queryFn: () => stockApi.searchStocks(searchTerm),
    enabled: searchTerm.length >= 1,
  });

  const createStock = useMutation({
    mutationFn: stockApi.createStock,
    onSuccess: async (stock) => {
      await queryClient.invalidateQueries({ queryKey: ["stocks"] });
      navigate(`/stocks/${stock.stock_code}`);
    },
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createStock.mutate({ ticker: ticker.trim().toUpperCase(), companyName: companyName.trim() });
  };

  const applyStockSelection = (stock: StockSearchMatch | null) => {
    setSelectedStock(stock);
    if (!stock) {
      return;
    }
    setTicker(stock.symbol);
    setCompanyName(stock.name);
  };

  const options = searchQuery.data ?? [];

  return (
    <Stack spacing={3} maxWidth={720}>
      <Button startIcon={<ArrowBack />} onClick={() => navigate("/watchlist")} sx={{ alignSelf: "flex-start" }}>
        Back
      </Button>
      <Stack spacing={0.5}>
        <Typography variant="h4" fontWeight={900}>
          Add Stock
        </Typography>
        <Typography color="text.secondary">Search any US-listed company, then generate a thesis from the stock detail page.</Typography>
      </Stack>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Stack component="form" spacing={2.5} onSubmit={onSubmit}>
            <Autocomplete
              options={options}
              value={selectedStock}
              onChange={(_, value) => applyStockSelection(value)}
              inputValue={inputValue}
              onInputChange={(_, value) => setInputValue(value)}
              filterOptions={(opts) => opts}
              loading={searchQuery.isFetching}
              noOptionsText={
                searchTerm.length < 1 ? "Type a ticker or company name" : searchQuery.isFetching ? "Searching…" : "No US stocks found"
              }
              getOptionLabel={(option) => `${option.symbol} - ${option.name}`}
              isOptionEqualToValue={(option, value) => option.symbol === value.symbol}
              renderOption={(props, option) => (
                <li {...props} key={option.symbol}>
                  <Stack spacing={0.25}>
                    <Typography fontWeight={800}>{option.symbol}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {option.name}
                    </Typography>
                  </Stack>
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search US stock"
                  placeholder="Type ticker or company name"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {searchQuery.isFetching ? <CircularProgress color="inherit" size={18} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
            {searchQuery.isError && <ErrorState error={searchQuery.error} />}
            <TextField
              label="Ticker"
              value={ticker}
              onChange={(event) => {
                setTicker(event.target.value.toUpperCase());
                setSelectedStock(null);
              }}
              required
              inputProps={{ maxLength: 16 }}
            />
            <TextField
              label="Company name"
              value={companyName}
              onChange={(event) => {
                setCompanyName(event.target.value);
                setSelectedStock(null);
              }}
              required
            />
            <Alert severity="info">
              Search results come from SEC/EDGAR (US-listed companies). The exchange is auto-detected when the stock is added.
            </Alert>
            {createStock.isError && <ErrorState error={createStock.error} />}
            <Button type="submit" variant="contained" disabled={createStock.isPending || !ticker.trim() || !companyName.trim()}>
              {createStock.isPending ? "Adding..." : "Add Stock"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
