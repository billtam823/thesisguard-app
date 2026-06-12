import { Chip } from "@mui/material";

type Props = {
  severity?: string | null;
};

export function SeverityChip({ severity }: Props) {
  const normalized = (severity || "").toLowerCase();
  const color =
    normalized === "critical" || normalized === "high" || normalized === "material"
      ? "error"
      : normalized === "medium" || normalized === "watch"
        ? "warning"
        : "default";

  return <Chip size="small" label={severity || "Unknown"} color={color} variant="outlined" />;
}
