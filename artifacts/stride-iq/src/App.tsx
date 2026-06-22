import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import CoachLayout from "@/components/CoachLayout";
import Dashboard from "@/pages/dashboard";
import Activities from "@/pages/activities";
import Plans from "@/pages/plans";
import PlanDetail from "@/pages/plan-detail";
import Alerts from "@/pages/alerts";
import History from "@/pages/history";
import Coach from "@/pages/coach";
import Profile from "@/pages/profile";
import Onboarding from "@/pages/onboarding";
import CoachDashboard from "@/pages/coach-dashboard";
import Team from "@/pages/team";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import { useGetAthleteProfile } from "@workspace/api-client-react";
import { useAuth } from "@workspace/replit-auth-web";
import { useEffect } from "react";

const queryClient = new QueryClient();

const Spinner = () => (
  <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) return <Spinner />;
  if (!isAuthenticated) return <Login />;
  return <>{children}</>;
}

function AthleteRouter() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/activities" component={Activities} />
        <Route path="/plans" component={Plans} />
        <Route path="/plans/:id" component={PlanDetail} />
        <Route path="/alerts" component={Alerts} />
        <Route path="/history" component={History} />
        <Route path="/coach" component={Coach} />
        <Route path="/team" component={Team} />
        <Route path="/profile" component={Profile} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function CoachRouter() {
  return (
    <CoachLayout>
      <Switch>
        <Route path="/" component={CoachDashboard} />
        <Route path="/alerts" component={Alerts} />
        <Route path="/team" component={Team} />
        <Route path="/ai-assistant" component={Coach} />
        <Route path="/profile" component={Profile} />
        <Route component={CoachDashboard} />
      </Switch>
    </CoachLayout>
  );
}

function AppContent() {
  const { data: profile, isLoading } = useGetAthleteProfile();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    const needsOnboarding = !profile?.userRole;
    if (needsOnboarding && location !== "/onboarding") {
      navigate("/onboarding");
    } else if (!needsOnboarding && location === "/onboarding") {
      navigate("/");
    }
  }, [profile, isLoading, location, navigate]);

  if (isLoading) return <Spinner />;

  return (
    <Switch>
      <Route path="/onboarding" component={Onboarding} />
      <Route>
        {profile?.userRole === "coach" ? <CoachRouter /> : <AthleteRouter />}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthGuard>
            <AppContent />
          </AuthGuard>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
