import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Bot, Settings, LogOut, Calendar, X, Check, Menu } from "lucide-react";
import { useUser, useClerk } from "@clerk/react";
import { useGetAthleteProfile } from "@workspace/api-client-react";
import NotificationBell from "./NotificationBell";
import { getFocusConfig } from "@/lib/coachingFocus";
import { useState, useEffect, useRef } from "react";

const NAV = [
  { href: "/", label: "Team Dashboard", icon: LayoutDashboard },
  { href: "/team", label: "Athlete Roster", icon: Users },
  { href: "/plans", label: "Training Plans", icon: Calendar },
  { href: "/ai-assistant", label: "AveraAI", icon: Bot },
  { href: "/profile", label: "Settings", icon: Settings },
];

type PlanSession = {
  weekNumber: number;
  dayOfWeek: number;
  sessionType: string;
  description: string;
  distanceMiles: number;
  durationMinutes: number;
};

type PlanProposal = {
  athleteUserId: string;
  athleteName: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  weeklyMileage: number;
  rationale: string;
  sessions: PlanSession[];
};

type PlanFlow = "idle" | "loading" | "proposal" | "applying" | "done" | "error";

function AveraTipPopup() {
  const [tip, setTip] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [flow, setFlow] = useState<PlanFlow>("idle");
  const [proposal, setProposal] = useState<PlanProposal | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const cancelAutoHide = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem("avera_tip_shown");
    if (alreadyShown) return;

    const fetchTip = async () => {
      try {
        // Only show suggestions when the coach actually has team members
        const teamRes = await fetch("/api/teams/my", { credentials: "include" });
        if (!teamRes.ok) return;
        const teamData = await teamRes.json() as { team: { memberCount: number } | null };
        if (!teamData.team || teamData.team.memberCount === 0) return;

        const res = await fetch("/api/openai/coach-tip", { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json() as { tip: string | null };
        if (data.tip) {
          setTip(data.tip);
          setVisible(true);
          sessionStorage.setItem("avera_tip_shown", "1");
          timerRef.current = setTimeout(() => setVisible(false), 30000);
        }
      } catch {
        // silently fail — popup is non-critical
      }
    };

    const delay = setTimeout(fetchTip, 5000);
    return () => {
      clearTimeout(delay);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const buildPlan = async () => {
    cancelAutoHide();
    setFlow("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/openai/suggest-plan", { credentials: "include" });
      const data = await res.json() as { proposal?: PlanProposal; error?: string };
      if (!res.ok || !data.proposal) {
        setErrorMsg(data.error || "Couldn't generate a plan. Try again.");
        setFlow("error");
        return;
      }
      setProposal(data.proposal);
      setFlow("proposal");
    } catch {
      setErrorMsg("Network error. Try again.");
      setFlow("error");
    }
  };

  const applyPlan = async () => {
    if (!proposal) return;
    setFlow("applying");
    setErrorMsg("");
    try {
      const res = await fetch("/api/openai/apply-plan", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proposal),
      });
      const data = await res.json() as { planId?: number; error?: string };
      if (!res.ok || !data.planId) {
        setErrorMsg(data.error || "Couldn't add the plan. Try again.");
        setFlow("error");
        return;
      }
      setFlow("done");
    } catch {
      setErrorMsg("Network error. Try again.");
      setFlow("error");
    }
  };

  if (!visible || dismissed || !tip) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-background border border-primary/30 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-primary/5">
          <div className="w-6 h-6 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            <Bot className="w-3 h-3 text-primary" />
          </div>
          <span className="text-xs font-semibold text-primary">AveraAI has a suggestion</span>
          <button
            onClick={() => { setDismissed(true); setVisible(false); }}
            className="ml-auto text-muted-foreground hover:text-muted-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-4 py-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{tip}</p>
        </div>

        {flow === "proposal" && proposal && (
          <div className="mx-4 mb-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
              <Calendar className="w-3 h-3" /> Proposed plan
            </div>
            <p className="mt-1.5 text-sm font-semibold text-foreground">{proposal.name}</p>
            <p className="text-xs text-muted-foreground">for {proposal.athleteName}</p>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <p><span className="text-muted-foreground">Goal:</span> {proposal.goal}</p>
              <p>
                <span className="text-muted-foreground">Volume:</span> {proposal.weeklyMileage} mi/wk · {proposal.sessions.length} sessions
              </p>
              <p><span className="text-muted-foreground">Dates:</span> {proposal.startDate} → {proposal.endDate}</p>
            </div>
            {proposal.rationale && (
              <p className="mt-2 text-xs italic text-muted-foreground leading-relaxed">"{proposal.rationale}"</p>
            )}
          </div>
        )}

        {flow === "done" && proposal && (
          <div className="mx-4 mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-300"><Check className="w-4 h-4" /> Plan added for {proposal.athleteName}</p>
          </div>
        )}

        {flow === "error" && errorMsg && (
          <div className="mx-4 mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-xs text-red-300">{errorMsg}</p>
          </div>
        )}

        <div className="px-4 pb-3 flex items-center gap-2">
          {flow === "idle" && (
            <button
              onClick={buildPlan}
              className="text-xs font-medium text-[#F5F5F5] bg-primary hover:bg-primary/80 transition-colors rounded-md px-2.5 py-1.5"
            >
              Build a training plan
            </button>
          )}

          {flow === "loading" && (
            <span className="text-xs text-primary font-medium">Avera is designing a plan…</span>
          )}

          {flow === "proposal" && (
            <>
              <button
                onClick={applyPlan}
                className="text-xs font-medium text-[#F5F5F5] bg-primary hover:bg-primary/80 transition-colors rounded-md px-2.5 py-1.5"
              >
                Add to training plan
              </button>
              <button
                onClick={() => { setFlow("idle"); setProposal(null); }}
                className="text-xs text-muted-foreground hover:text-muted-foreground transition-colors"
              >
                Cancel
              </button>
            </>
          )}

          {flow === "applying" && (
            <span className="text-xs text-primary font-medium">Adding plan…</span>
          )}

          {flow === "done" && (
            <Link
              href="/plans"
              onClick={() => setVisible(false)}
              className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
            >
              View plans →
            </Link>
          )}

          {flow === "error" && (
            <button
              onClick={buildPlan}
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Try again
            </button>
          )}

          {flow !== "done" && (
            <Link
              href="/ai-assistant"
              onClick={() => setVisible(false)}
              className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Open AveraAI →
            </Link>
          )}

          <button
            onClick={() => { setDismissed(true); setVisible(false); }}
            className="ml-auto text-xs text-muted-foreground hover:text-muted-foreground transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const basePath = import.meta.env.BASE_URL.replace(/\/\$/, "");
  const logoutRedirectUrl = `${window.location.origin}${basePath || "/"}`;
  const { data: profile } = useGetAthleteProfile();
  const focus = getFocusConfig(profile?.primaryGoal);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const initials = user
    ? `${user.firstName?.charAt(0) ?? ""}${user.lastName?.charAt(0) ?? ""}`.toUpperCase() || "C"
    : "C";

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 max-w-[80vw] flex-shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border transform transition-transform duration-200 lg:static lg:w-60 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 py-5 border-b border-sidebar-border flex items-center gap-3">
          <img src="/logo.svg" alt="Thrive" className="h-7 w-auto" />
          <div className={`text-[10px] font-bold uppercase tracking-[0.15em] ${focus.accentText}`}>{focus.label} Coach</div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden ml-auto text-muted-foreground hover:text-foreground"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                  ${active
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
              >
                <Icon size={16} className={active ? "opacity-100" : "opacity-70"} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-4 py-4 border-t border-sidebar-border space-y-3">
          <div className="flex items-center gap-3">
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover shadow-sm border border-border" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shadow-sm">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">{user?.firstName ?? "Coach"}</div>
              <div className="text-[10px] text-muted-foreground font-medium truncate">{user?.primaryEmailAddress?.emailAddress ?? "Thrive Athletics"}</div>
            </div>
          </div>
          <button
            onClick={() => signOut({ redirectUrl: logoutRedirectUrl })}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground font-medium hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <LogOut size={14} className="opacity-70" />
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto">
        <header className="sticky top-0 z-20 h-14 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between gap-3 px-4 lg:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden text-muted-foreground hover:text-foreground"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <NotificationBell />
        </header>
        {children}
      </main>

      <AveraTipPopup />
    </div>
  );
}
