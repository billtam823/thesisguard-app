import { ArrowBack } from "@mui/icons-material";
import { Alert, Autocomplete, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { stockApi } from "../api/stockApi";
import { stockUniverse } from "../api/stockUniverse";
import { ErrorState } from "../components/ErrorState";
import type { StockLookupOption } from "../types/stockLookup";

export function AddStockPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ticker, setTicker] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [sector, setSector] = useState("");
  const [industry, setIndustry] = useState("");
  const [theme, setTheme] = useState("");
  const [selectedStock, setSelectedStock] = useState<StockLookupOption | null>(null);

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

  const applyStockSelection = (stock: StockLookupOption | null) => {
    setSelectedStock(stock);
    if (!stock) {
      return;
    }

    setTicker(stock.ticker);
    setCompanyName(stock.companyName);
    setSector(stock.sector);
    setIndustry(stock.industry);
    setTheme(stock.theme);
  };

  return (
    <Stack spacing={3} maxWidth={720}>
      <Button startIcon={<ArrowBack />} onClick={() => navigate("/watchlist")} sx={{ alignSelf: "flex-start" }}>
        Back
      </Button>
      <Stack spacing={0.5}>
        <Typography variant="h4" fontWeight={900}>
          Add Stock
        </Typography>
        <Typography color="text.secondary">Create a watchlist entry and generate a thesis from the stock detail page.</Typography>
      </Stack>
      <Card variant="outlined" sx={{ borderRadius: 2 }}>
        <CardContent>
          <Stack component="form" spacing={2.5} onSubmit={onSubmit}>
            <Autocomplete
              options={stockUniverse}
              value={selectedStock}
              onChange={(_, value) => applyStockSelection(value)}
              filterOptions={(options, state) => {
                const input = state.inputValue.trim().toLowerCase();
                if (!input) {
                  return options.slice(0, 8);
                }

                return options
                  .filter((option) =>
                    [option.ticker, option.companyName, option.sector, option.industry, option.theme]
                      .join(" ")
                      .toLowerCase()
                      .includes(input),
                  )
                  .slice(0, 12);
              }}
              getOptionLabel={(option) => `${option.ticker} - ${option.companyName}`}
              isOptionEqualToValue={(option, value) => option.ticker === value.ticker}
              renderOption={(props, option) => (
                <li {...props} key={option.ticker}>
                  <Stack spacing={0.25}>
                    <Typography fontWeight={800}>
                      {option.ticker} · {option.companyName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {option.sector} · {option.industry}
                    </Typography>
                  </Stack>
                </li>
              )}
              renderInput={(params) => <TextField {...params} label="Search stock" placeholder="Type ticker or company name" required />}
            />
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
            <TextField label="Sector" value={sector} InputProps={{ readOnly: true }} />
            <TextField label="Industry" value={industry} InputProps={{ readOnly: true }} />
            <TextField label="Theme" value={theme} InputProps={{ readOnly: true }} />
            <Alert severity="info">
              Select a stock to fill company details. The current backend stores only ticker and companyName; sector, industry, and theme are shown for selection context.
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
