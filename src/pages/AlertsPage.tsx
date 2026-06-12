import { Button, Card, CardContent, Divider, Stack, Typography } from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { alertApi } from "../api/alertApi";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { SeverityChip } from "../components/SeverityChip";

export function AlertsPage() {
  const queryClient = useQueryClient();
  const alertsQuery = useQuery({ queryKey: ["alerts"], queryFn: alertApi.getAlerts });
  const resolveAlert = useMutation({
    mutationFn: alertApi.resolveAlert,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });

  if (alertsQuery.isLoading) {
    return <LoadingState text="Loading alerts..." />;
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h4" fontWeight={900}>
          Alerts
        </Typography>
        <Typography color="text.secondary">Thesis events that need attention.</Typography>
      </Stack>

      {alertsQuery.isError && <ErrorState error={alertsQuery.error} />}

      {alertsQuery.data?.length === 0 ? (
        <EmptyState message="No active or resolved alerts have been created yet." />
      ) : (
        <Stack spacing={2}>
          {alertsQuery.data?.map((alert) => (
            <Card variant="outlined" sx={{ borderRadius: 2 }} key={alert.id}>
              <CardContent>
                <Stack spacing={1.5}>
                  <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                    <Stack spacing={0.5}>
                      <Typography fontWeight={900}>{alert.title}</Typography>
                      <Typography color="text.secondary">
                        {alert.stock_code} · Stock #{alert.stock_id} · {formatDate(alert.created_at)}
                      </Typography>
                    </Stack>
                    <SeverityChip severity={alert.severity} />
                  </Stack>
                  <Divider />
                  <Typography>{alert.message}</Typography>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography color={alert.resolved ? "success.main" : "warning.main"} fontWeight={700}>
                      {alert.resolved ? "Resolved" : "Open"}
                    </Typography>
                    {!alert.resolved && (
                      <Button variant="outlined" onClick={() => resolveAlert.mutate(alert.id)} disabled={resolveAlert.isPending}>
                        Resolve
                      </Button>
                    )}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : "Unknown date";
}
