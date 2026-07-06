import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Shield,
  ShieldAlert,
  AlertTriangle,
  Zap,
  CalendarCheck,
  Lightbulb,
  HeartPulse,
  FileDown,
  Share2,
  TrendingUp,
  TrendingDown,
  Info,
  MessageSquare,
} from "lucide-react";
import { format } from "date-fns";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useListAlertComments, useCreateAlertComment, getListAlertCommentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { DEMO_ALERT_COMMENTS } from "@/lib/demoData";

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  low: { label: "Low Risk", color: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: Shield },
  medium: { label: "Medium Risk", color: "text-amber-600", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: AlertTriangle },
  high: { label: "High Risk", color: "text-red-600", bg: "bg-red-500/10", border: "border-red-500/30", icon: ShieldAlert },
  critical: { label: "Critical", color: "text-red-600", bg: "bg-red-500/20", border: "border-red-500/40", icon: ShieldAlert },
};

const BAND_RING_CLASS: Record<string, string> = {
  low: "text-emerald-500",
  moderate: "text-amber-500",
  high: "text-red-500",
  critical: "text-red-600",
};

const EFFORT_BAND_CHIP: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-600",
  moderate: "bg-amber-500/10 text-amber-600",
  high: "bg-red-500/10 text-red-600",
};

// Z1 → Z5, cool to hot.
const HR_ZONE_BAR = ["bg-slate-400", "bg-sky-400", "bg-primary", "bg-amber-500", "bg-red-500"];

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const CARD = "premium-card rounded-3xl";

function sorenessBarColor(score: number): string {
  if (score >= 7) return "bg-red-500";
  if (score >= 4) return "bg-amber-500";
  return "bg-emerald-500";
}

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function InfoTip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`How ${title} works`}
          className="text-muted-foreground/70 hover:text-primary transition-colors shrink-0"
        >
          <Info className="w-3.5 h-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 text-left p-4">
        <h4 className="text-sm font-bold text-foreground mb-1.5">{title}</h4>
        <div className="text-xs text-muted-foreground leading-relaxed space-y-2">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

function AlertComments({ alertId }: { alertId: number }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const { data: comments, isLoading } = useListAlertComments(alertId);
  const createComment = useCreateAlertComment({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAlertCommentsQueryKey(alertId) });
        setNote("");
        toast({ title: "Note sent to athlete" });
      },
      onError: () => toast({ title: "Couldn't post note", variant: "destructive" }),
    },
  });

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <MessageSquare className="w-3.5 h-3.5" /> Coach Notes
      </p>
      {!isLoading && (comments?.length ?? 0) > 0 && (
        <div className="space-y-2 mb-3">
          {comments!.map((c) => (
            <div key={c.id} className="bg-secondary/50 rounded-xl px-4 py-2.5">
              <p className="text-sm text-foreground">{c.content}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(c.createdAt), "MMM d, HH:mm")}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Leave a note for the athlete…"
          maxLength={1000}
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={() => note.trim() && createComment.mutate({ id: alertId, data: { content: note.trim() } })}
          disabled={createComment.isPending || !note.trim()}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  );
}

function DemoAlertComments({ alertId }: { alertId: number }) {
  const { toast } = useToast();
  const [note, setNote] = useState("");
  const [comments, setComments] = useState(() => DEMO_ALERT_COMMENTS[alertId] ?? []);

  function send() {
    const content = note.trim();
    if (!content) return;
    setComments((prev) => [...prev, { id: Date.now(), content, createdAt: new Date().toISOString() }]);
    setNote("");
    toast({ title: "Note sent to athlete" });
  }

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <MessageSquare className="w-3.5 h-3.5" /> Coach Notes
      </p>
      {comments.length > 0 && (
        <div className="space-y-2 mb-3">
          {comments.map((c) => (
            <div key={c.id} className="bg-secondary/50 rounded-xl px-4 py-2.5">
              <p className="text-sm text-foreground">{c.content}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(c.createdAt), "MMM d, HH:mm")}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Leave a note for the athlete…"
          maxLength={1000}
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={send}
          disabled={!note.trim()}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export interface InjuryRiskDashboard {
  riskScore: number;
  riskBand: string;
  riskLabel: string;
  insight: string;
  lastUpdated: string;
  workload: { daily: Array<{ date: string; day: string; load: number; baseline: number }>; ratio: number | null };
  intensityMap: unknown[];
  weeklyRelativeEffort: { total: number; band: string } | null;
  activityConsistency: { daysActive: number; totalDays: number; pct: number } | null;
  fitnessTrend: { series: number[]; changePct: number } | null;
  heartRateZones: Array<{ zone: number; label: string; seconds: number }>;
  segments: unknown[];
  alerts: Array<{ id: number; riskLevel: string; bodyPart: string; message: string; recommendation: string; createdAt: string }>;
  soreness: Array<{ bodyPart: string; painScore: number; createdAt: string }>;
}

export default function CoachAthleteInjuryRisk({ params }: { params: { userId: string } }) {
  const [dashboard, setDashboard] = useState<InjuryRiskDashboard | null>(null);
  const [athleteName, setAthleteName] = useState<string>("Athlete");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/teams/my", { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject(new Error("Couldn't load your team.")))
      .then((d: { team: { id: number } | null }) => {
        if (!d.team) throw new Error("You don't have a team yet.");
        return Promise.all([
          fetch(`/api/teams/${d.team.id}/members/${params.userId}/injury-risk`, { credentials: "include" }),
          fetch(`/api/teams/${d.team.id}/members/${params.userId}/profile`, { credentials: "include" }),
        ]);
      })
      .then(async ([riskRes, profileRes]) => {
        if (!riskRes.ok) {
          if (riskRes.status === 401) throw new Error("Your session expired. Please sign in again.");
          if (riskRes.status === 403) throw new Error("You don't have access to this athlete's data.");
          if (riskRes.status === 404) throw new Error("This athlete is no longer on your team.");
          throw new Error("Couldn't load this athlete's injury risk analysis. Please try again.");
        }
        const risk = (await riskRes.json()) as InjuryRiskDashboard;
        const profile = profileRes.ok ? await profileRes.json().catch(() => null) : null;
        return { risk, name: profile?.name as string | undefined };
      })
      .then(({ risk, name }) => {
        if (cancelled) return;
        setDashboard(risk);
        if (name) setAthleteName(name);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [params.userId]);

  return (
    <InjuryRiskView
      dashboard={dashboard}
      athleteName={athleteName}
      loading={loading}
      error={error}
      backHref={`/athletes/${params.userId}`}
    />
  );
}

export function InjuryRiskView({
  dashboard,
  athleteName,
  loading,
  error,
  backHref,
  demo = false,
}: {
  dashboard: InjuryRiskDashboard | null;
  athleteName: string;
  loading: boolean;
  error: string | null;
  backHref: string;
  demo?: boolean;
}) {
  const { toast } = useToast();

  function shareReport() {
    const d = dashboard;
    const summary = d
      ? `${athleteName}'s injury-risk report: ${d.riskLabel} (${d.riskScore}/100).\n${d.insight}`
      : "Injury-risk report from StrideIQ.";
    if (navigator.share) {
      navigator.share({ title: `${athleteName}'s Injury-Risk Report`, text: summary }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(summary).then(
        () => toast({ title: "Report summary copied", description: "Paste it anywhere to share." }),
        () => toast({ title: "Couldn't copy", variant: "destructive" }),
      );
    } else {
      toast({ title: "Sharing not supported on this browser" });
    }
  }

  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <div className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="w-5 h-5 text-destructive" />
        </div>
        <h2 className="text-base font-semibold text-foreground">Couldn't load injury risk analysis</h2>
        <p className="text-sm text-muted-foreground mt-1">{error}</p>
        <Link
          href={backHref}
          className="inline-block mt-4 py-2 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Back to profile
        </Link>
      </div>
    );
  }

  const latestSorenessByPart = Object.values(
    (dashboard?.soreness ?? []).reduce((acc: Record<string, { bodyPart: string; painScore: number }>, s) => {
      if (!acc[s.bodyPart]) acc[s.bodyPart] = s;
      return acc;
    }, {}),
  ).slice(0, 5);

  const gaugeOffset = dashboard ? CIRCUMFERENCE * (1 - dashboard.riskScore / 100) : CIRCUMFERENCE;
  const ringClass = dashboard ? BAND_RING_CLASS[dashboard.riskBand] ?? "text-primary" : "text-primary";
  const elevated = dashboard ? dashboard.riskBand !== "low" : false;

  const dailyLoads = dashboard?.workload.daily ?? [];
  const maxLoadVal = Math.max(1, ...dailyLoads.map((d) => d.load), ...dailyLoads.map((d) => d.baseline));
  const peakLoad = Math.max(0, ...dailyLoads.map((d) => d.load));

  const trend = dashboard?.fitnessTrend?.series ?? [];
  const trendMax = Math.max(1, ...trend);
  const trendPct = dashboard?.fitnessTrend?.changePct ?? 0;

  const effort = dashboard?.weeklyRelativeEffort;
  const consistency = dashboard?.activityConsistency;

  const hrZones = dashboard?.heartRateZones ?? [];
  const hrZonesDesc = [...hrZones].reverse();
  const hrMaxSeconds = Math.max(1, ...hrZones.map((z) => z.seconds));
  const hasHrData = hrZones.some((z) => z.seconds > 0);

  const alerts = dashboard?.alerts ?? [];

  return (
    <div
      className="p-6 md:p-12 max-w-7xl mx-auto"
      style={{ background: "radial-gradient(circle at top right, hsl(var(--primary) / 0.06), transparent 60%)" }}
    >
      <style>{`
        .premium-card {
          background: hsl(var(--card));
          border: 1px solid hsl(var(--border));
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .premium-card:hover {
          border-color: hsl(var(--primary) / 0.35);
          box-shadow: 0 6px 20px -12px hsl(var(--primary) / 0.4);
        }
      `}</style>

      <Link
        href={backHref}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 w-fit"
      >
        <ArrowLeft className="w-4 h-4" /> Back to profile
      </Link>

      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="font-display font-semibold text-[11px] uppercase tracking-[0.08em] text-primary mb-1.5">Injury Prevention</p>
          <h1 className="font-display font-extrabold text-3xl md:text-4xl tracking-[-0.01em] text-foreground mb-3">
            {athleteName}'s Injury Risk Analysis
          </h1>
          <p className="text-sm md:text-base text-muted-foreground font-light leading-relaxed">
            Training load and recovery markers tracked the same way your athlete sees them, so you can catch overtraining before it becomes an injury.
          </p>
        </div>
        {dashboard && (
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-card border border-border text-xs font-medium text-muted-foreground shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Last update: {format(new Date(dashboard.lastUpdated), "MMM d, HH:mm")}
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {[...Array(2)].map((_, i) => <div key={i} className="h-72 bg-card border border-border rounded-3xl animate-pulse" />)}
        </div>
      ) : dashboard ? (
        <>
          {/* Risk gauge + Workload ratio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className={`${CARD} p-10 flex flex-col items-center text-center`}>
              <div className="flex items-center gap-1.5 mb-8">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">Total Risk Index</h3>
                <InfoTip title="How this score works">
                  <p>A single 0–100 number blended from four evidence-based training-load and recovery signals. Higher means more injury risk.</p>
                  <p><strong>0–24</strong> Low · <strong>25–49</strong> Moderate · <strong>50–74</strong> High · <strong>75+</strong> Critical.</p>
                  <p>We need ~2 weeks of history before scoring workload, so the number is conservative until we know their baseline. It's guidance, not medical advice.</p>
                </InfoTip>
              </div>
              <div className="relative w-52 h-52 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle className="text-secondary" cx="50" cy="50" fill="none" r={RADIUS} stroke="currentColor" strokeWidth="5" />
                  <circle
                    className={`${ringClass} transition-all duration-700`}
                    cx="50" cy="50" fill="none" r={RADIUS}
                    stroke="currentColor" strokeWidth="5" strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={gaugeOffset}
                  />
                </svg>
                <div className="flex flex-col items-center">
                  <span className="text-6xl font-extrabold text-foreground tracking-tight">{dashboard.riskScore}</span>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2">{dashboard.riskLabel}</span>
                </div>
              </div>

              <div className="w-full mt-8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">30D Fitness Trend</span>
                  <span className={`text-[11px] font-bold inline-flex items-center gap-0.5 ${trendPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {trendPct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {trendPct >= 0 ? "+" : ""}{trendPct}%
                  </span>
                </div>
                <div className="flex items-end justify-between gap-[3px] h-10">
                  {trend.map((v, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-sm ${i === trend.length - 1 ? "bg-primary" : "bg-secondary"}`}
                      style={{ height: `${Math.max(6, (v / trendMax) * 100)}%` }}
                    />
                  ))}
                </div>
              </div>

              <div className={`mt-6 w-full flex items-start gap-3 rounded-2xl px-4 py-3 text-left ${elevated ? "bg-amber-500/10 border border-amber-500/20" : "bg-emerald-500/10 border border-emerald-500/20"}`}>
                <Shield className={`w-4 h-4 mt-0.5 shrink-0 ${elevated ? "text-amber-600" : "text-emerald-600"}`} />
                <div>
                  <p className={`text-xs font-bold ${elevated ? "text-amber-700" : "text-emerald-700"}`}>{elevated ? "Caution Advised" : "Cleared to Train"}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {elevated ? "Elevated load or recovery markers detected this week." : "Load and recovery markers look balanced."}
                  </p>
                </div>
              </div>
            </div>

            <div className={`${CARD} p-10 flex flex-col`}>
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <h3 className="text-xl font-bold text-foreground">Workload Ratio</h3>
                    <InfoTip title="Workload Ratio (ACWR)">
                      <p>Compares <strong>acute load</strong> (this week) against <strong>chronic load</strong> (recent weekly average) — the acute:chronic workload ratio used in sports science to catch training spikes.</p>
                      <p>A ratio of <strong>0.8–1.3</strong> is the "sweet spot." Above <strong>1.3</strong> means they're ramping faster than their body is conditioned for.</p>
                    </InfoTip>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Acute vs Chronic Balance</p>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" />Current</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-secondary" />Baseline</span>
                </div>
              </div>
              <div className="flex justify-end mb-2">
                <div className="text-right">
                  <span className="text-3xl font-extrabold text-foreground">{dashboard.workload.ratio ?? "—"}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest ml-1">ACWR</span>
                </div>
              </div>
              <div className="flex-1 flex items-end justify-between gap-3 h-40">
                {dailyLoads.map((d) => {
                  const heightPct = Math.max(4, (d.load / maxLoadVal) * 100);
                  const baselinePct = Math.max(2, (d.baseline / maxLoadVal) * 100);
                  const isPeak = d.load > 0 && d.load === peakLoad;
                  return (
                    <div key={d.date} className="relative flex-1 flex flex-col items-center gap-2 h-full justify-end" title={`${d.day}: ${d.load} load`}>
                      <div className="absolute left-0 right-0 border-t border-dashed border-border" style={{ bottom: `${baselinePct}%` }} />
                      <div
                        className={`w-full rounded-t-md transition-all ${isPeak ? "bg-primary shadow-lg shadow-primary/20" : "bg-secondary"}`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                {dailyLoads.map((d) => <span key={d.date} className="flex-1 text-center">{d.day}</span>)}
              </div>
            </div>
          </div>

          {/* Weekly Relative Effort + Activity Consistency + Training Insight */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div className={`${CARD} p-8`}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Zap className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Weekly Relative Effort</p>
                <InfoTip title="Weekly Relative Effort">
                  <p>The sum of Strava's <strong>Relative Effort</strong> (suffer score) across their runs in the last 7 days.</p>
                  <p>Bands: <strong>Low</strong> under 150, <strong>Moderate</strong> 150–349, <strong>High</strong> 350+.</p>
                </InfoTip>
              </div>
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-4xl font-extrabold text-foreground">{effort?.total ?? 0}</span>
                {effort && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${EFFORT_BAND_CHIP[effort.band]}`}>
                    {effort.band}
                  </span>
                )}
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, ((effort?.total ?? 0) / 600) * 100)}%` }} />
              </div>
            </div>

            <div className={`${CARD} p-8`}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Activity Consistency</p>
                <InfoTip title="Activity Consistency">
                  <p>How many distinct days they trained in the last 7. Consistent, spread-out training carries far less injury risk than cramming volume into a couple of days.</p>
                </InfoTip>
              </div>
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-4xl font-extrabold text-foreground">{consistency?.daysActive ?? 0}/{consistency?.totalDays ?? 7}</span>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Days ({consistency?.pct ?? 0}%)</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${consistency?.pct ?? 0}%` }} />
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-4 h-4 text-primary" />
                <h4 className="text-xs font-bold text-primary uppercase tracking-[0.15em]">Training Insight</h4>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed italic">{dashboard.insight}</p>
              <Link href={backHref} className="mt-4 text-xs font-bold text-primary hover:underline self-start uppercase tracking-widest">
                Back to Profile →
              </Link>
            </div>
          </div>

          {/* Heart Rate Zones */}
          <div className="mb-8">
            <div className={`${CARD} p-6`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-muted-foreground" /> Heart Rate Zones
                  <InfoTip title="Heart Rate Zones">
                    <p>Time spent in each of five heart-rate zones over the last 7 days.</p>
                    <p><strong>Z1</strong> recovery, <strong>Z2</strong> aerobic, <strong>Z3</strong> tempo, <strong>Z4</strong> threshold, <strong>Z5</strong> anaerobic. Too much time in Z4–Z5 without recovery raises risk.</p>
                  </InfoTip>
                </h3>
                <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">Last 7 days</span>
              </div>
              {hasHrData ? (
                <div className="space-y-2">
                  {hrZonesDesc.map((z) => (
                    <div key={z.zone} className="flex items-center gap-3">
                      <span className="w-20 text-[11px] font-bold text-muted-foreground uppercase tracking-wider shrink-0">Z{z.zone} {z.label}</span>
                      <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${HR_ZONE_BAR[z.zone - 1]}`} style={{ width: `${(z.seconds / hrMaxSeconds) * 100}%` }} />
                      </div>
                      <span className="w-14 text-right text-[11px] font-semibold text-foreground tabular-nums">{formatDuration(z.seconds)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-6 text-center">No heart-rate data in the last 7 days.</p>
              )}
            </div>
          </div>

          {/* Soreness Log (read-only — only the athlete logs their own symptoms) */}
          <div className="mb-10">
            <div className={`${CARD} p-8 flex flex-col`}>
              <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                Soreness Log
                <InfoTip title="Soreness Log">
                  <p>Pain and soreness the athlete logs themselves, by body part and severity (0–10). Their worst recent entry feeds directly into the <strong>Total Risk Index</strong>.</p>
                </InfoTip>
              </h3>
              <div className="space-y-6 flex-1">
                {latestSorenessByPart.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No symptoms logged recently.</p>
                ) : (
                  latestSorenessByPart.map((s) => (
                    <div key={s.bodyPart}>
                      <div className="flex justify-between text-xs font-bold mb-2">
                        <span className="text-muted-foreground uppercase tracking-wider">{s.bodyPart}</span>
                        <span className="text-foreground">{s.painScore}/10</span>
                      </div>
                      <div className="h-1 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${sorenessBarColor(s.painScore)}`} style={{ width: `${(s.painScore / 10) * 100}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className={`${CARD} p-6 mb-10`}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">Share this report</p>
                <p className="text-xs text-muted-foreground">Export or share {athleteName}'s injury-risk analysis.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5" /> Export PDF
                </button>
                <button
                  onClick={shareReport}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" /> Share Report
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {/* Alerts (active only — acknowledging is an athlete action, not a coach one) */}
      <div>
        {alerts.length === 0 ? (
          <div className={`${CARD} py-16 text-center`}>
            <Shield className="w-8 h-8 text-emerald-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">All clear</p>
            <p className="text-xs text-muted-foreground">No active injury risks for {athleteName}.</p>
          </div>
        ) : (
          <>
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Active Alerts</h2>
            <div className="space-y-3">
              {alerts.map((alert) => {
                const cfg = RISK_CONFIG[alert.riskLevel] ?? RISK_CONFIG.low;
                const Icon = cfg.icon;
                return (
                  <div key={alert.id} className={`bg-card border rounded-2xl p-6 ${cfg.border}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wide ${cfg.bg} ${cfg.color}`}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{alert.bodyPart}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{format(new Date(alert.createdAt), "MMM d")}</span>
                    </div>
                    <p className="text-sm text-foreground mb-3">{alert.message}</p>
                    <div className="bg-secondary/50 rounded-xl p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 font-bold">Recommendation</p>
                      <p className="text-sm text-foreground">{alert.recommendation}</p>
                    </div>
                    {demo ? <DemoAlertComments alertId={alert.id} /> : <AlertComments alertId={alert.id} />}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
