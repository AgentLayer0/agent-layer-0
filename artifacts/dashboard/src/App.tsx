import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";

import LoginPage from "@/pages/login";
import OverviewPage from "@/pages/overview";
import PollsPage from "@/pages/polls";
import AgentsPage from "@/pages/agents";
import TransactionsPage from "@/pages/transactions";
import { AuthGuard } from "@/components/layout/AuthGuard";
import { AppLayout } from "@/components/layout/AppLayout";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={LoginPage} />

      <Route path="/overview">
        <AuthGuard>
          <AppLayout>
            <OverviewPage />
          </AppLayout>
        </AuthGuard>
      </Route>
      <Route path="/polls">
        <AuthGuard>
          <AppLayout>
            <PollsPage />
          </AppLayout>
        </AuthGuard>
      </Route>
      <Route path="/agents">
        <AuthGuard>
          <AppLayout>
            <AgentsPage />
          </AppLayout>
        </AuthGuard>
      </Route>
      <Route path="/transactions">
        <AuthGuard>
          <AppLayout>
            <TransactionsPage />
          </AppLayout>
        </AuthGuard>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base="/dashboard">
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
