import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Bot, Settings, LogOut, Calendar, X, Zap, Check } from "lucide-react";
import { useAuth } from "@workspace/replit-auth-web";
import NotificationBell from "./NotificationBell";
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
      <div className="bg-[#0d1529] border border-cyan-500/30 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800 bg-cyan-500/5">
          <div className="w-6 h-6 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Zap className="w-3 h-3 text-cyan-400" />
          </div>
          <span className="text-xs font-semibold text-cyan-400">AveraAI has a suggestion</span>
          <button
            onClick={() => { setDismissed(true); setVisible(false); }}
            className="ml-auto text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="px-4 py-3">
          <p className="text-sm text-slate-300 leading-relaxed">{tip}</p>
        </div>

        {flow === "proposal" && proposal && (
          <div className="mx-4 mb-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-400">
              <Calendar className="w-3 h-3" /> Proposed plan
            </div>
            <p className="mt-1.5 text-sm font-semibold text-white">{proposal.name}</p>
            <p className="text-xs text-slate-400">for {proposal.athleteName}</p>
            <div className="mt-2 space-y-1 text-xs text-slate-400">
              <p><span className="text-slate-500">Goal:</span> {proposal.goal}</p>
              <p>
                <span className="text-slate-500">Volume:</span> {proposal.weeklyMileage} mi/wk · {proposal.sessions.length} sessions
              </p>
              <p><span className="text-slate-500">Dates:</span> {proposal.startDate} → {proposal.endDate}</p>
            </div>
            {proposal.rationale && (
              <p className="mt-2 text-xs italic text-slate-500 leading-relaxed">"{proposal.rationale}"</p>
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
              className="text-xs font-medium text-slate-900 bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-md px-2.5 py-1.5"
            >
              Build a training plan
            </button>
          )}

          {flow === "loading" && (
            <span className="text-xs text-cyan-400 font-medium">Avera is designing a plan…</span>
          )}

          {flow === "proposal" && (
            <>
              <button
                onClick={applyPlan}
                className="text-xs font-medium text-slate-900 bg-cyan-400 hover:bg-cyan-300 transition-colors rounded-md px-2.5 py-1.5"
              >
                Add to training plan
              </button>
              <button
                onClick={() => { setFlow("idle"); setProposal(null); }}
                className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
              >
                Cancel
              </button>
            </>
          )}

          {flow === "applying" && (
            <span className="text-xs text-cyan-400 font-medium">Adding plan…</span>
          )}

          {flow === "done" && (
            <Link
              href="/plans"
              onClick={() => setVisible(false)}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
            >
              View plans →
            </Link>
          )}

          {flow === "error" && (
            <button
              onClick={buildPlan}
              className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Try again
            </button>
          )}

          {flow !== "done" && (
            <Link
              href="/ai-assistant"
              onClick={() => setVisible(false)}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
            >
              Open AveraAI →
            </Link>
          )}

          <button
            onClick={() => { setDismissed(true); setVisible(false); }}
            className="ml-auto text-xs text-slate-500 hover:text-slate-400 transition-colors"
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
  const { user, logout } = useAuth();

  const initials = user
    ? `${user.firstName?.charAt(0) ?? ""}${user.lastName?.charAt(0) ?? ""}`.toUpperCase() || "C"
    : "C";

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <aside className="w-60 flex-shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">
        <div className="px-5 py-5 border-b border-sidebar-border flex items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-bold text-primary">T</div>
            <div>
              <div className="text-sm font-bold text-foreground tracking-tight">Thrive</div>
              <div className="text-[10px] text-primary font-bold uppercase tracking-[0.15em]">Coach Portal</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
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
            {user?.profileImageUrl ? (
              <img src={user.profileImageUrl} alt="avatar" className="w-8 h-8 rounded-full object-cover shadow-sm border border-border" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shadow-sm">
                {initials}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-foreground truncate">{user?.firstName ?? "Coach"}</div>
              <div className="text-[10px] text-muted-foreground font-medium truncate">{user?.email ?? "Thrive Athletics"}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground font-medium hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <LogOut size={14} className="opacity-70" />
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 h-14 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-end px-6">
          <NotificationBell />
        </header>
        {children}
      </main>

      <AveraTipPopup />
    </div>
  );
}
