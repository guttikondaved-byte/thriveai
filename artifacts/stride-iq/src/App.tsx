import { useEffect, useRef, useState } from "react";
import { User, Users, ArrowLeft } from "lucide-react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useUser, useClerk, useAuth } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import CoachLayout from "@/components/CoachLayout";
import Dashboard from "@/pages/dashboard";
import Activities from "@/pages/activities";
import ActivityDetail from "@/pages/activity-detail";
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
import { useGetAthleteProfile, setAuthTokenGetter } from "@workspace/api-client-react";

const queryClient = new QueryClient();

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const landingUrl = `${window.location.origin}${basePath || "/"}`;

// REQUIRED — copy verbatim. Resolves the key from window.location.hostname.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim. Empty in dev, auto-set in prod.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL?.trim() || undefined;

function stripBase(path: string): string {
  let normalizedPath = path;

  try {
    const url = new URL(path, window.location.origin);
    normalizedPath = `${url.pathname}${url.search}${url.hash}`;
  } catch {
    normalizedPath = path;
  }

  return basePath && normalizedPath.startsWith(basePath)
    ? normalizedPath.slice(basePath.length) || "/"
    : normalizedPath;
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
    colorPrimary: "#2A504C",
    colorForeground: "#f8fafc",
    colorMutedForeground: "#94a3b8",
    colorDanger: "#ef4444",
    colorBackground: "#06070E",
    colorInput: "#0e1a19",
    colorInputForeground: "#f8fafc",
    colorNeutral: "#2A504C",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "rounded-2xl border border-border w-[440px] max-w-full overflow-hidden shadow-xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none !hidden",
    footerAction: "!hidden",
    footerActionLink: "!hidden",
    headerTitle: "text-white font-bold",
    headerSubtitle: "text-slate-400",
    socialButtonsBlockButtonText: "text-slate-200 font-medium",
    formFieldLabel: "text-slate-300 font-medium",
    dividerText: "text-slate-600",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-emerald-400",
    alertText: "text-white",
    logoBox: "justify-center",
    logoImage: "rounded-xl",
    socialButtonsBlockButton: "border-border bg-[#0e1a19]/50 hover:bg-[#0e1a19]",
    formButtonPrimary: "bg-primary hover:bg-primary/80 text-[#F5F5F5] font-semibold",
    formFieldInput: "bg-[#0e1a19]/50 border-border text-white",
    dividerLine: "bg-border",
    alert: "bg-red-500/10 border-red-500/20",
    otpCodeFieldInput: "bg-[#0e1a19]/50 border-border text-white",
    formFieldRow: "",
    main: "",
  },
};

const Spinner = () => (
  <div className="min-h-screen bg-[#06070E] flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

function SignInPage() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-[#06070E] flex flex-col items-center justify-center px-4">
      <button
        onClick={() => navigate("/")}
        className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={16} />
        Back
      </button>
      <SignIn routing="path" path="/sign-in" signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  const [, navigate] = useLocation();

  const [role, setRole] = useState<"athlete" | "coach" | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const urlRole = params.get("role");
    if (urlRole === "athlete" || urlRole === "coach") {
      sessionStorage.setItem("thrive_pending_role", urlRole);
      return urlRole;
    }
    const stored = sessionStorage.getItem("thrive_pending_role");
    if (stored === "athlete" || stored === "coach") return stored;
    return null;
  });

  function handleSelectRole(r: "athlete" | "coach") {
    sessionStorage.setItem("thrive_pending_role", r);
    setRole(r);
  }

  function clearRole() {
    sessionStorage.removeItem("thrive_pending_role");
    setRole(null);
  }

  if (!role) {
    return (
      <div className="min-h-screen bg-[#06070E] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <button
            onClick={() => navigate("/")}
            className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <div className="flex justify-center mb-8">
            <img src="/logo.svg" alt="Thrive" className="h-14 w-auto" />
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-2">I'm joining as a…</h1>
          <p className="text-slate-400 text-sm text-center mb-8">Choose your role to get started. You can update this later.</p>

          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleSelectRole("athlete")}
              className="w-full text-left rounded-2xl border border-primary/40 p-5 transition-all group hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10"
              style={{ background: "linear-gradient(135deg, rgba(42,80,76,0.08) 0%, rgba(42,80,76,0.03) 100%)" }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, rgba(42,80,76,0.25) 0%, rgba(61,122,116,0.15) 100%)", border: "1px solid rgba(42,80,76,0.4)" }}
                >
                  <User className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white group-hover:text-primary transition-colors">Athlete</p>
                  <p className="text-xs text-slate-500 mt-0.5">Personal training log · AI coach · Injury alerts · Plans</p>
                </div>
                <svg className="w-4 h-4 text-primary/60 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              </div>
            </button>

            <button
              onClick={() => handleSelectRole("coach")}
              className="w-full text-left rounded-2xl border border-[#F2D2CF]/40 p-5 transition-all group hover:border-[#F2D2CF]/60 hover:shadow-lg hover:shadow-[#F2D2CF]/10"
              style={{ background: "linear-gradient(135deg, rgba(242,210,207,0.08) 0%, rgba(242,210,207,0.03) 100%)" }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "linear-gradient(135deg, rgba(242,210,207,0.25) 0%, rgba(242,210,207,0.15) 100%)", border: "1px solid rgba(242,210,207,0.4)" }}
                >
                  <Users className="w-5 h-5 text-[#F2D2CF]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white group-hover:text-[#F2D2CF] transition-colors">Coach</p>
                  <p className="text-xs text-slate-500 mt-0.5">Team roster · Workload monitoring · Risk dashboard · Alerts</p>
                </div>
                <svg className="w-4 h-4 text-[#F2D2CF]/60 group-hover:text-[#F2D2CF] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
              </div>
            </button>
          </div>

        </div>
      </div>
    );
  }

  const roleLabel = role === "athlete" ? "Athlete" : "Coach";
  const roleColor = role === "athlete" ? "text-primary border-primary/30 bg-primary/10" : "text-[#F2D2CF] border-[#F2D2CF]/30 bg-[#F2D2CF]/10";

  return (
    <div className="min-h-screen bg-[#06070E] flex flex-col items-center justify-center px-4 gap-5">
      <button
        onClick={() => navigate("/")}
        className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft size={16} />
        Back
      </button>
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold ${roleColor}`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
          {roleLabel}
        </div>
        <button
          onClick={clearRole}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline underline-offset-2"
        >
          Change
        </button>
      </div>
      <SignUp routing="path" path="/sign-up" signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function AthleteRouter() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/activities" component={Activities} />
        <Route path="/activities/:id" component={ActivityDetail} />
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
  const { data: profile, isLoading, isError, error } = useGetAthleteProfile();
  const [location, navigate] = useLocation();
  const { signOut } = useClerk();
  const [hasHandledAuthError, setHasHandledAuthError] = useState(false);

  function isApiError(err: unknown): err is { status: number } {
    return Boolean(
      err && typeof err === "object" &&
      "status" in err &&
      typeof (err as any).status === "number",
    );
  }

  useEffect(() => {
    if (!isError || hasHandledAuthError) return;
    if (isApiError(error) && (error.status === 401 || error.status === 403)) {
      setHasHandledAuthError(true);
      signOut({ redirectUrl: landingUrl }).catch(() => {
        window.location.href = landingUrl;
      });
    }
  }, [error, hasHandledAuthError, isError, signOut]);

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

/**
 * Registers Clerk's active session token as a Bearer header on every API
 * request. Without this, the first burst of requests after sign-in can arrive
 * at the server before the __session cookie is fully propagated, causing 401s.
 * getToken() always returns a current (auto-refreshed) JWT, so this is safe.
 */
function ClerkAuthTokenProvider() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);
  return null;
}

function HomeContent() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) return <Spinner />;
  if (!isSignedIn) return <Login />;

  return (
    <>
      <ClerkAuthTokenProvider />
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
        <Route path="/sign-in" component={SignInPage} />
        <Route path="/sign-in/*" component={SignInPage} />
        <Route path="/sign-up" component={SignUpPage} />
        <Route path="/sign-up/*" component={SignUpPage} />
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
