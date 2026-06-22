import { useEffect, useRef } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useUser, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
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
import CoachPlans from "@/pages/coach-plans";
import Team from "@/pages/team";
import Login from "@/pages/login";
import NotFound from "@/pages/not-found";
import { useGetAthleteProfile } from "@workspace/api-client-react";

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// REQUIRED — copy verbatim. Resolves the key from window.location.hostname.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim. Empty in dev, auto-set in prod.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "#0ac7e8",
    colorForeground: "#f8fafc",
    colorMutedForeground: "#94a3b8",
    colorDanger: "#ef4444",
    colorBackground: "#0d1525",
    colorInput: "#1a2438",
    colorInputForeground: "#f8fafc",
    colorNeutral: "#334155",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "rounded-2xl border border-slate-700/50 w-[440px] max-w-full overflow-hidden shadow-xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-white font-bold",
    headerSubtitle: "text-slate-400",
    socialButtonsBlockButtonText: "text-slate-200 font-medium",
    formFieldLabel: "text-slate-300 font-medium",
    footerActionLink: "text-cyan-400 hover:text-cyan-300",
    footerActionText: "text-slate-500",
    dividerText: "text-slate-600",
    identityPreviewEditButton: "text-cyan-400",
    formFieldSuccessText: "text-emerald-400",
    alertText: "text-white",
    logoBox: "justify-center",
    logoImage: "rounded-xl",
    socialButtonsBlockButton: "border-slate-700/60 bg-slate-800/50 hover:bg-slate-700/60",
    formButtonPrimary: "bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-semibold",
    formFieldInput: "bg-slate-800/50 border-slate-700/50 text-white",
    footerAction: "bg-transparent",
    dividerLine: "bg-slate-700/50",
    alert: "bg-red-500/10 border-red-500/20",
    otpCodeFieldInput: "bg-slate-800/50 border-slate-700/50 text-white",
    formFieldRow: "",
    main: "",
  },
};

const Spinner = () => (
  <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

function SignInPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] flex items-center justify-center px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
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
        <Route path="/team" component={Team} />
        <Route path="/plans" component={CoachPlans} />
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

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function HomeContent() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) return <Spinner />;
  if (!isSignedIn) return <Login />;

  return (
    <>
      <ClerkQueryClientCacheInvalidator />
      <AppContent />
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <Switch>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={HomeContent} />
      </Switch>
    </ClerkProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={basePath}>
          <ClerkProviderWithRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
