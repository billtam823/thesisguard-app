import { Alert } from "@mui/material";

type Props = {
  error: unknown;
  fallback?: string;
};

export function ErrorState({ error, fallback = "Something went wrong." }: Props) {
  const message = error instanceof Error ? error.message : fallback;
  return <Alert severity="error">{message}</Alert>;
}
