import { CircularProgress, Stack, Typography } from "@mui/material";

type Props = {
  text?: string;
};

export function LoadingState({ text = "Loading..." }: Props) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ py: 6 }}>
      <CircularProgress size={28} />
      <Typography color="text.secondary">{text}</Typography>
    </Stack>
  );
}
