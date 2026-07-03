import { useState } from "react";
import { useLocation } from "wouter";
import {
  Shield,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Zap,
  CalendarCheck,
  Lightbulb,
  Plus,
  HeartPulse,
  Mountain,
  Stethoscope,
  FileDown,
  Share2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { format } from "date-fns";
import { DEMO_DATA } from "@/lib/demoData";

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  low: { label: "Low Risk", color: "text-emerald-600", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: Shield },
  medium: { label: "Medium Risk", color: "text-amber-600", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: AlertTriangle },
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

const HR_ZONE_BAR = ["bg-slate-400", "bg-sky-400", "bg-primary", "bg-amber-500", "bg-red-500"];

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CARD = "bg-card border border-border rounded-3xl";

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

export default function DemoAlerts() {
  const [, navigate] = useLocation();
  const [showSorenessForm, setShowSorenessForm] = useState(false);
  const [sorenessSaved, setSorenessSaved] = useState(false);

  const dashboard = DEMO_DATA.riskDashboard;

  const gaugeOffset = CIRCUMFERENCE * (1 - dashboard.riskScore / 100);
  const ringClass = BAND_RING_CLASS[dashboard.riskBand] ?? "text-primary";
  const elevated = dashboard.riskBand !== "low";

  const dailyLoads = dashboard.workload.daily;
  const maxLoadVal = Math.max(1, ...dailyLoads.map(d => d.load), ...dailyLoads.map(d => d.baseline));
  const peakLoad = Math.max(0, ...dailyLoads.map(d => d.load));

  const trend = dashboard.fitnessTrend.series;
  const trendMax = Math.max(1, ...trend);
  const trendPct = dashboard.fitnessTrend.changePct;

  const effort = dashboard.weeklyRelativeEffort;
  const consistency = dashboard.activityConsistency;

  const hrZonesDesc = [...dashboard.heartRateZones].reverse();
  const hrMaxSeconds = Math.max(1, ...dashboard.heartRateZones.map(z => z.seconds));

  const segments = dashboard.segments;

  const active = DEMO_DATA.activeAlerts;
  const dismissed = DEMO_DATA.dismissedAlerts;

  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto">
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="max-w-2xl">
          <h1 className="font-display font-extrabold text-3xl md:text-4xl tracking-[-0.01em] text-foreground mb-3">
            Injury Risk Analysis
          </h1>
          <p className="text-sm md:text-base text-muted-foreground font-light leading-relaxed">
            Optimization starts with prevention. Your personalized dashboard tracks training load and recovery markers to keep you performing at peak capacity.
          </p>
        </div>
        <div className="flex items-center gap-3 px-5 py-2.5 rounded-full bg-card border border-border text-xs font-medium text-muted-foreground shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Last update: {format(new Date(dashboard.lastUpdated), "MMM d, HH:mm")}
        </div>
      </div>

      {/* Risk gauge + Workload ratio */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className={`${CARD} p-10 flex flex-col items-center text-center`}>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mb-8">Total Risk Index</h3>
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
              <h3 className="text-xl font-bold text-foreground mb-1">Workload Ratio</h3>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Acute vs Chronic Balance</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary" />Current</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-secondary" />Baseline</span>
            </div>
          </div>
          <div className="flex justify-end mb-2">
            <div className="text-right">
              <span className="text-3xl font-extrabold text-foreground">{dashboard.workload.ratio}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest ml-1">ACWR</span>
            </div>
          </div>
          <div className="flex-1 flex items-end justify-between gap-3 h-40">
            {dailyLoads.map(d => {
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
            {dailyLoads.map(d => <span key={d.date} className="flex-1 text-center">{d.day}</span>)}
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
          </div>
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-4xl font-extrabold text-foreground">{effort.total}</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${EFFORT_BAND_CHIP[effort.band]}`}>
              {effort.band}
            </span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (effort.total / 600) * 100)}%` }} />
          </div>
        </div>

        <div className={`${CARD} p-8`}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Activity Consistency</p>
          </div>
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-4xl font-extrabold text-foreground">{consistency.daysActive}/{consistency.totalDays}</span>
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Days ({consistency.pct}%)</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${consistency.pct}%` }} />
          </div>
        </div>

        <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-bold text-primary uppercase tracking-[0.15em]">Training Insight</h4>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed italic">{dashboard.insight}</p>
          <button onClick={() => navigate("/demo/plans")} className="mt-4 text-xs font-bold text-primary hover:underline self-start uppercase tracking-widest">
            Adjust Plan →
          </button>
        </div>
      </div>

      {/* HR zones + Best Efforts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8 items-start">
        <div className={`${CARD} p-6`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <HeartPulse className="w-4 h-4 text-muted-foreground" /> Heart Rate Zones
            </h3>
            <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">Last 7 days</span>
          </div>
          <div className="space-y-2">
            {hrZonesDesc.map(z => (
              <div key={z.zone} className="flex items-center gap-3">
                <span className="w-20 text-[11px] font-bold text-muted-foreground uppercase tracking-wider shrink-0">Z{z.zone} {z.label}</span>
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${HR_ZONE_BAR[z.zone - 1]}`} style={{ width: `${(z.seconds / hrMaxSeconds) * 100}%` }} />
                </div>
                <span className="w-14 text-right text-[11px] font-semibold text-foreground tabular-nums">{formatDuration(z.seconds)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`${CARD} p-8`}>
          <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-6">
            <Mountain className="w-5 h-5 text-muted-foreground" /> Best Efforts
          </h3>
          <div className="space-y-5">
            {segments.map(s => (
              <div key={s.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-foreground">{s.name}</span>
                  {s.isPr && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[9px] font-bold uppercase tracking-wider">PR</span>
                  )}
                </div>
                <div className="flex items-baseline gap-3">
                  <div>
                    <p className="text-lg font-bold text-foreground tabular-nums">{formatDuration(s.currentTimeSeconds)}</p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Current</p>
                  </div>
                  <div className="text-muted-foreground/60">·</div>
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground tabular-nums">{formatDuration(s.prTimeSeconds)}</p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Best</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Soreness Log */}
      <div className="mb-10">
        <div className={`${CARD} p-8 flex flex-col`}>
          <h3 className="text-xl font-bold text-foreground mb-6">Soreness Log</h3>
          {showSorenessForm ? (
            <SorenessForm
              onCancel={() => setShowSorenessForm(false)}
              onSubmit={() => {
                setShowSorenessForm(false);
                setSorenessSaved(true);
              }}
            />
          ) : (
            <>
              <div className="space-y-6 flex-1">
                {dashboard.soreness.map(s => (
                  <div key={s.bodyPart}>
                    <div className="flex justify-between text-xs font-bold mb-2">
                      <span className="text-muted-foreground uppercase tracking-wider">{s.bodyPart}</span>
                      <span className="text-foreground">{s.painScore}/10</span>
                    </div>
                    <div className="h-1 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${sorenessBarColor(s.painScore)}`} style={{ width: `${(s.painScore / 10) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {sorenessSaved && (
                  <p className="text-xs text-emerald-600 font-medium">Symptoms updated (demo entry, sign up to track this for real).</p>
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
      <div className={`${CARD} p-6 mb-10 flex flex-col sm:flex-row items-center justify-between gap-4`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Physical Therapy Access</p>
            <p className="text-xs text-muted-foreground">Message your care team about any flagged symptoms.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/sign-up")}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <FileDown className="w-3.5 h-3.5" /> Export PDF
          </button>
          <button
            onClick={() => navigate("/sign-up")}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" /> Share Report
          </button>
        </div>
      </div>

      {/* Alerts */}
      {active.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Active Alerts</h2>
          <div className="space-y-3">
            {active.map(alert => {
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
            {dismissed.map(alert => (
              <div key={alert.id} className="bg-card border border-border rounded-2xl px-6 py-3.5 opacity-60">
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
    </div>
  );
}

const BODY_PARTS = ["Right knee", "Left knee", "Right ankle", "Left ankle", "Right hip", "Left hip", "Lower back", "Right calf", "Left calf", "Achilles"];

function SorenessForm({ onSubmit, onCancel }: { onSubmit: () => void; onCancel: () => void }) {
  const [bodyPart, setBodyPart] = useState("");
  const [painScore, setPainScore] = useState(3);

  const painColor = painScore >= 7 ? "text-red-600" : painScore >= 4 ? "text-amber-600" : "text-emerald-600";

  return (
    <form
      onSubmit={e => { e.preventDefault(); if (bodyPart) onSubmit(); }}
      className="space-y-5 bg-secondary/40 border border-border rounded-2xl p-4 mb-4"
    >
      <div>
        <label className="text-xs text-muted-foreground mb-2 block uppercase tracking-wider font-semibold">Body Part</label>
        <select
          value={bodyPart}
          onChange={e => setBodyPart(e.target.value)}
          className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground"
        >
          <option value="">Select area…</option>
          {BODY_PARTS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-2 block uppercase tracking-wider font-semibold">
          Pain Level: <span className={`font-bold ${painColor}`}>{painScore}/10</span>
        </label>
        <input
          type="range"
          min={0}
          max={10}
          value={painScore}
          onChange={e => setPainScore(Number(e.target.value))}
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
        <button type="submit" disabled={!bodyPart}
          className="flex-1 min-w-[80px] px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50">
          Save
        </button>
      </div>
    </form>
  );
}
