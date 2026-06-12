import { AppBar, Box, Button, Container, Toolbar, Typography } from "@mui/material";
import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { label: "Watchlist", to: "/watchlist" },
  { label: "Alerts", to: "/alerts" },
];

export function AppLayout() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f6f8fb" }}>
      <AppBar position="sticky" elevation={0} sx={{ bgcolor: "#172033", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
        <Toolbar>
          <Typography variant="h6" fontWeight={900} sx={{ flexGrow: 1 }}>
            ThesisGuard
          </Typography>
          {navItems.map((item) => (
            <Button
              key={item.to}
              color="inherit"
              component={NavLink}
              to={item.to}
              sx={{ mx: 0.5, "&.active": { bgcolor: "rgba(255,255,255,0.14)" } }}
            >
              {item.label}
            </Button>
          ))}
        </Toolbar>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Outlet />
      </Container>
    </Box>
  );
}
