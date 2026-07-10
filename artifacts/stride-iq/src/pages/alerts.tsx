import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListInjuryAlerts,
  useAcknowledgeAlert,
  getListInjuryAlertsQueryKey,
  useGetInjuryRiskDashboard,
  useCreateSorenessEntry,
  getGetInjuryRiskDashboardQueryKey,
  useListAlertComments,
  useCreateAlertComment,
  getListAlertCommentsQueryKey,
  useGetInjuryRiskWhatIf,
  getGetInjuryRiskWhatIfQueryKey,
} from "@workspace/api-client-react";
import type {
  SorenessEntry,
  InjuryRiskDashboardHeartRateZonesItem,
} from "@workspace/api-client-react";
import {
  Shield,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Zap,
  CalendarCheck,
  Lightbulb,
  Plus,
  Activity,
  HeartPulse,
  Stethoscope,
  FileDown,
  Share2,
  TrendingUp,
  TrendingDown,
  Info,
  MessageSquare,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { BODY_PARTS } from "@/lib/bodyParts";
import { WhatIfRiskSlider } from "@/components/WhatIfRiskSlider";

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

const BAND_CHIP_CLASS: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-600",
  moderate: "bg-amber-500/10 text-amber-600",
  high: "bg-red-500/10 text-red-600",
  critical: "bg-red-600/15 text-red-700",
};

const EFFORT_BAND_CHIP: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-600",
  moderate: "bg-amber-500/10 text-amber-600",
  high: "bg-red-500/10 text-red-600",
};

const INTENSITY_CLASSES = ["bg-secondary", "bg-red-500/25", "bg-red-500/50", "bg-red-500/75", "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"];

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
  const [reply, setReply] = useState("");
  const { data: comments, isLoading } = useListAlertComments(alertId);
  const createComment = useCreateAlertComment({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAlertCommentsQueryKey(alertId) });
        setReply("");
        toast({ title: "Reply sent to your coach" });
      },
      onError: () => toast({ title: "Couldn't send reply", variant: "destructive" }),
    },
  });

  if (isLoading) return null;

  return (
    <div className="mt-4 pt-4 border-t border-border">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <MessageSquare className="w-3.5 h-3.5" /> Conversation with your coach
      </p>
      {(comments?.length ?? 0) > 0 && (
        <div className="space-y-2 mb-3">
          {comments!.map((c) => (
            <div key={c.id} className={`rounded-xl px-4 py-2.5 ${c.authorRole === "athlete" ? "bg-primary/10 border border-primary/20" : "bg-secondary/50"}`}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">{c.authorRole === "athlete" ? "You" : "Coach"}</p>
              <p className="text-sm text-foreground">{c.content}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(c.createdAt), "MMM d, HH:mm")}</p>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Reply to your coach…"
          maxLength={1000}
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={() => reply.trim() && createComment.mutate({ id: alertId, data: { content: reply.trim() } })}
          disabled={createComment.isPending || !reply.trim()}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  );
}

function SorenessForm({ onSubmit, onCancel, isPending }: {
  onSubmit: (data: { bodyPart: string; painScore: number }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [bodyPart, setBodyPart] = useState("");
  const [painScore, setPainScore] = useState(3);

  const labelCls = "text-xs text-muted-foreground mb-2 block uppercase tracking-wider font-semibold";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bodyPart) return;
    onSubmit({ bodyPart, painScore });
  };

  const painColor = painScore >= 7 ? "text-red-600" : painScore >= 4 ? "text-amber-600" : "text-emerald-600";

  return (
    <form onSubmit={handleSubmit} className="space-y-5 bg-secondary/40 border border-border rounded-2xl p-4 mb-4">
      <div>
        <label className={labelCls}>Body Part</label>
        <Select value={bodyPart} onValueChange={setBodyPart}>
          <SelectTrigger className="w-full bg-card border-border text-foreground">
            <SelectValue placeholder="Select area…" />
          </SelectTrigger>
          <SelectContent>
            {BODY_PARTS.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className={labelCls}>
          Pain Level: <span className={`font-bold ${painColor}`}>{painScore}/10</span>
        </label>
        <input
          type="range"
          min={0}
          max={10}
          value={painScore}
          onChange={(e) => setPainScore(Number(e.target.value))}
          className="w-full accent-primary cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
          <span>None</span>
          <span>Severe</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="flex-1 min-w-[80px] px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          Cancel
        </button>
        <button type="submit" disabled={isPending || !bodyPart}
          className="flex-1 min-w-[80px] px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
          Save
        </button>
      </div>
    </form>
  );
}

export default function Alerts() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showSorenessForm, setShowSorenessForm] = useState(false);
  const [showCareTeamForm, setShowCareTeamForm] = useState(false);
  const [careNote, setCareNote] = useState("");
  const [careSending, setCareSending] = useState(false);

  async function sendCareTeamMessage() {
    setCareSending(true);
    try {
      const res = await fetch("/api/injury-risk/notify-care-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ note: careNote.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast({
          title: "Couldn't send message",
          description: body.error ?? "Please try again.",
          variant: "destructive",
        });
        return;
      }
      toast({ title: "Message sent to your care team", description: "Your coach will see it in their notifications." });
      setCareNote("");
      setShowCareTeamForm(false);
    } catch {
      toast({ title: "Couldn't send message", description: "Please check your connection and try again.", variant: "destructive" });
    } finally {
      setCareSending(false);
    }
  }

  function shareReport() {
    const d = dashboard;
    const summary = d
      ? `Injury-risk report: ${d.riskLabel} (${d.riskScore}/100).\n${d.insight}`
      : "Injury-risk report from StrideIQ.";
    if (navigator.share) {
      navigator.share({ title: "My Injury-Risk Report", text: summary }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(summary).then(
        () => toast({ title: "Report summary copied", description: "Paste it anywhere to share." }),
        () => toast({ title: "Couldn't copy", variant: "destructive" }),
      );
    } else {
      toast({ title: "Sharing not supported on this browser" });
    }
  }

  const { data: alerts, isLoading: alertsLoading } = useListInjuryAlerts();
  const acknowledge = useAcknowledgeAlert();

  const { data: dashboard, isLoading: dashboardLoading } = useGetInjuryRiskDashboard();
  const { data: whatIf, isLoading: whatIfLoading, error: whatIfError } = useGetInjuryRiskWhatIf({ query: { queryKey: getGetInjuryRiskWhatIfQueryKey(), retry: false } });
  const createSoreness = useCreateSorenessEntry({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetInjuryRiskDashboardQueryKey() });
        setShowSorenessForm(false);
        toast({ title: "Symptoms updated" });
      },
      onError: () => toast({ title: "Error saving", variant: "destructive" }),
    },
  });

  function handleAcknowledge(id: number) {
    acknowledge.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListInjuryAlertsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetInjuryRiskDashboardQueryKey() });
        toast({ title: "Alert acknowledged" });
      },
    });
  }

  const active = alerts?.filter((a) => !a.acknowledged) ?? [];
  const dismissed = alerts?.filter((a) => a.acknowledged) ?? [];

  const latestSorenessByPart = Object.values(
    (dashboard?.soreness ?? []).reduce((acc: Record<string, SorenessEntry>, s) => {
      if (!acc[s.bodyPart]) acc[s.bodyPart] = s;
      return acc;
    }, {}),
  ).slice(0, 5);

  const gaugeOffset = dashboard ? CIRCUMFERENCE * (1 - dashboard.riskScore / 100) : CIRCUMFERENCE;
  const ringClass = dashboard ? BAND_RING_CLASS[dashboard.riskBand] ?? "text-primary" : "text-primary";
  const chipClass = dashboard ? BAND_CHIP_CLASS[dashboard.riskBand] ?? "bg-secondary text-foreground" : "";
  const elevated = dashboard ? dashboard.riskBand !== "low" : false;

  const dailyLoads = dashboard?.workload.daily ?? [];
  const maxLoadVal = Math.max(1, ...dailyLoads.map((d) => d.load), ...dailyLoads.map((d) => d.baseline));
  const peakLoad = Math.max(0, ...dailyLoads.map((d) => d.load));

  const trend = dashboard?.fitnessTrend?.series ?? [];
  const trendMax = Math.max(1, ...trend);
  const trendPct = dashboard?.fitnessTrend?.changePct ?? 0;

  const effort = dashboard?.weeklyRelativeEffort;
  const consistency = dashboard?.activityConsistency;

  // HR zones displayed hottest-first (Z5 → Z1), matching the reference layout.
  const hrZones: InjuryRiskDashboardHeartRateZonesItem[] = dashboard?.heartRateZones ?? [];
  const hrZonesDesc = [...hrZones].reverse();
  const hrMaxSeconds = Math.max(1, ...hrZones.map((z) => z.seconds));
  const hasHrData = hrZones.some((z) => z.seconds > 0);


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

      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <p className="font-display font-semibold text-[11px] uppercase tracking-[0.08em] text-primary mb-1.5">Injury Prevention</p>
          <h1 className="font-display font-extrabold text-3xl md:text-4xl tracking-[-0.01em] text-foreground mb-3" data-testid="alerts-title">
            Injury Risk Analysis
          </h1>
          <p className="text-sm md:text-base text-muted-foreground font-light leading-relaxed">
            Optimization starts with prevention. Your personalized dashboard tracks training load and recovery markers to keep you performing at peak capacity.
          </p>
        </div>
        {dashboard && (
          <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-card border border-border text-xs font-medium text-muted-foreground shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Last update: {format(new Date(dashboard.lastUpdated), "MMM d, HH:mm")}
          </div>
        )}
      </div>

      {dashboardLoading ? (
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
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label="How the Total Risk Index is calculated"
                      className="text-muted-foreground/70 hover:text-primary transition-colors"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="center" className="w-80 text-left p-5">
                    <h4 className="text-sm font-bold text-foreground mb-1">How this score works</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                      A single 0–100 number blended from four evidence-based training-load and recovery signals. Higher means more injury risk.
                    </p>
                    <ul className="space-y-2.5 mb-3">
                      <li className="flex gap-2.5">
                        <span className="text-xs font-bold text-primary shrink-0 w-9 text-right tabular-nums">45%</span>
                        <span className="text-xs text-foreground/90 leading-snug"><span className="font-semibold">Recent run analysis:</span> heart-rate vs. pace mismatch, mileage jumps &gt;20%, prolonged high-intensity efforts, and pain/fatigue in your notes.</span>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="text-xs font-bold text-primary shrink-0 w-9 text-right tabular-nums">25%</span>
                        <span className="text-xs text-foreground/90 leading-snug"><span className="font-semibold">Workload ratio (ACWR)</span>: this week's load vs. your recent weekly average. Flags when acute load outpaces what you're conditioned for.</span>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="text-xs font-bold text-primary shrink-0 w-9 text-right tabular-nums">20%</span>
                        <span className="text-xs text-foreground/90 leading-snug"><span className="font-semibold">Open injury alerts</span>: weighted by severity until you acknowledge them.</span>
                      </li>
                      <li className="flex gap-2.5">
                        <span className="text-xs font-bold text-primary shrink-0 w-9 text-right tabular-nums">10%</span>
                        <span className="text-xs text-foreground/90 leading-snug"><span className="font-semibold">Reported soreness</span>: your worst self-reported pain in the last few days.</span>
                      </li>
                    </ul>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600">0–24 Low</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-600">25–49 Moderate</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/10 text-red-600">50–74 High</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-600/15 text-red-700">75+ Critical</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      We need ~2 weeks of history before scoring workload, so the number is conservative until we know your baseline. It's guidance, not medical advice.
                    </p>
                  </PopoverContent>
                </Popover>
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

              {/* 30-day fitness trend sparkline */}
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
                      <p>Compares your <strong>acute load</strong> (this week) against your <strong>chronic load</strong> (recent weekly average). It's the acute:chronic workload ratio used in sports science to catch training spikes.</p>
                      <p>A ratio of <strong>0.8–1.3</strong> is the "sweet spot." Above <strong>1.3</strong> means you're ramping faster than your body is conditioned for, which is the main driver of overuse injuries.</p>
                      <p>Bars show each day's load; the dashed line is your baseline. We need ~2 weeks of history before showing a ratio.</p>
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
                      {/* baseline marker */}
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

          {/* What-If Risk Simulator */}
          <div className="mb-8">
            <WhatIfRiskSlider data={whatIf} loading={whatIfLoading} error={whatIfError} athleteLabel="your" />
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
                  <p>The sum of Strava's <strong>Relative Effort</strong> (suffer score) across your runs in the last 7 days. It weights time spent at higher heart rates, so hard sessions count more than easy miles.</p>
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
                  <p>How many distinct days you trained in the last 7. Consistent, spread-out training carries far less injury risk than cramming the same volume into a couple of days.</p>
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
              <Link href="/plans" className="mt-4 text-xs font-bold text-primary hover:underline self-start uppercase tracking-widest">
                Adjust Plan →
              </Link>
            </div>
          </div>

          {/* Strava HR zones */}
          <div className="mb-8">
            <div className={`${CARD} p-6`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-muted-foreground" /> Heart Rate Zones
                  <InfoTip title="Heart Rate Zones">
                    <p>Time spent in each of five heart-rate zones over the last 7 days, from your runs' HR data.</p>
                    <p>Zones are % of your estimated max HR (from your age, or the highest HR we've seen): <strong>Z1</strong> recovery, <strong>Z2</strong> aerobic, <strong>Z3</strong> tempo, <strong>Z4</strong> threshold, <strong>Z5</strong> anaerobic. Too much time in Z4–Z5 without recovery raises risk.</p>
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
                <p className="text-xs text-muted-foreground py-6 text-center">No heart-rate data in the last 7 days. Sync runs with HR from Strava to populate zones.</p>
              )}
            </div>
          </div>

          {/* Soreness Log */}
          <div className="mb-10">
            <div className={`${CARD} p-8 flex flex-col`}>
              <h3 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                Soreness Log
                <InfoTip title="Soreness Log">
                  <p>Pain and soreness you log yourself, by body part and severity (0–10). It's the only signal we can't read from your runs, so keeping it current sharpens the risk score.</p>
                  <p>Your worst recent entry feeds directly into the <strong>Total Risk Index</strong>.</p>
                </InfoTip>
              </h3>
              {showSorenessForm ? (
                <SorenessForm
                  isPending={createSoreness.isPending}
                  onCancel={() => setShowSorenessForm(false)}
                  onSubmit={(data) => createSoreness.mutate({ data })}
                />
              ) : (
                <>
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
                  <button
                    onClick={() => setShowSorenessForm(true)}
                    className="mt-8 flex items-center justify-center gap-1.5 py-4 px-6 rounded-2xl bg-primary/10 border border-primary/20 text-primary font-bold text-xs uppercase tracking-[0.2em] hover:bg-primary/15 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Update Symptoms
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className={`${CARD} p-6 mb-10`}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Physical Therapy Access</p>
                  <p className="text-xs text-muted-foreground">Message your coach about any flagged symptoms.</p>
                </div>
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
                <button
                  onClick={() => setShowCareTeamForm((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Message Care Team
                </button>
              </div>
            </div>

            {showCareTeamForm && (
              <div className="mt-5 pt-5 border-t border-border">
                <label htmlFor="care-note" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Message your coach
                </label>
                <textarea
                  id="care-note"
                  value={careNote}
                  onChange={(e) => setCareNote(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder="e.g. Left knee has been sore for 3 days after my long run. Should I adjust this week?"
                  className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
                <div className="flex justify-end gap-2 mt-3">
                  <button
                    onClick={() => {
                      setShowCareTeamForm(false);
                      setCareNote("");
                    }}
                    className="px-4 py-2 rounded-xl border border-border text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sendCareTeamMessage}
                    disabled={careSending}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> {careSending ? "Sending…" : "Send to Coach"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* Alerts */}
      {alertsLoading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => <div key={i} className="h-36 bg-card border border-border rounded-3xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {active.length === 0 && dismissed.length === 0 && (
            <div className={`${CARD} py-16 text-center`}>
              <Shield className="w-8 h-8 text-emerald-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">All clear</p>
              <p className="text-xs text-muted-foreground">No injury risks detected. Keep training smart.</p>
            </div>
          )}

          {active.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Active Alerts</h2>
              <div className="space-y-3">
                {active.map((alert) => {
                  const cfg = RISK_CONFIG[alert.riskLevel] ?? RISK_CONFIG.low;
                  const Icon = cfg.icon;
                  return (
                    <div key={alert.id} className={`bg-card border rounded-2xl p-6 ${cfg.border}`} data-testid={`alert-${alert.id}`}>
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
                      <div className="bg-secondary/50 rounded-xl p-4 mb-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 font-bold">Recommendation</p>
                        <p className="text-sm text-foreground">{alert.recommendation}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAcknowledge(alert.id)}
                        disabled={acknowledge.isPending}
                        data-testid={`button-acknowledge-${alert.id}`}
                        className="gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Acknowledge
                      </Button>
                      <AlertComments alertId={alert.id} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {dismissed.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Dismissed</h2>
              <div className="space-y-2">
                {dismissed.map((alert) => (
                  <div key={alert.id} className="bg-card border border-border rounded-2xl px-6 py-3.5 opacity-60" data-testid={`alert-dismissed-${alert.id}`}>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{alert.bodyPart} · {alert.riskLevel} risk</span>
                      <span className="text-xs text-muted-foreground ml-auto">{format(new Date(alert.createdAt), "MMM d")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
