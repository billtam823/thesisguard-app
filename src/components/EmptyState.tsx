import { Box, Typography } from "@mui/material";

type Props = {
  title?: string;
  message: string;
};

export function EmptyState({ title = "Nothing here yet", message }: Props) {
  return (
    <Box sx={{ border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 3, bgcolor: "background.default" }}>
      <Typography variant="subtitle1" fontWeight={700}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
        {message}
      </Typography>
    </Box>
  );
}
