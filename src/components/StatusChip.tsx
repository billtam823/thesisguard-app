import { Chip } from "@mui/material";

type Props = {
  status?: string | null;
};

export function StatusChip({ status }: Props) {
  const normalized = (status || "").toLowerCase();
  const color =
    normalized === "strong hold"
      ? "success"
      : normalized === "hold"
        ? "primary"
        : normalized === "watch" || normalized === "reduce review"
          ? "warning"
          : normalized === "sell review"
            ? "error"
            : "default";

  return <Chip size="small" label={status || "Unknown"} color={color} variant="outlined" />;
}
