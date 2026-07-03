import { useGetDashboardSummary, useGetInjuryRiskDashboard } from "@workspace/api-client-react";
import { AlertTriangle, Activity, TrendingUp, X, Mountain } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

function useStravaStatus() {
  return useQuery({
    queryKey: ["strava-status"],
    queryFn: async () => {
      const r = await fetch("/api/strava/status", { credentials: "include" });
      return r.json() as Promise<{ connected: boolean; stravaAthleteId: number | null }>;
    },
  });
}

const ACTIVITY_LABELS: Record<string, string> = {
  easy_run: "Easy Run", tempo_run: "Tempo", interval: "Interval",
  long_run: "Long Run", race: "Race", cross_training: "Cross Training", rest: "Rest",
};

const LOAD_COLORS: Record<string, string> = {
  low: "text-primary",
  moderate: "text-[#10b981]", // Emerald
  high: "text-[#f59e0b]", // Amber
  very_high: "text-[#ef4444]", // Red
};

const RISK_COLORS: Record<string, string> = {
  low: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  high: "bg-red-500/10 text-red-600 border-red-500/20",
  critical: "bg-red-600/20 text-red-300 border-red-600/30",
};

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/** All-time fastest times at standard distances, from Strava best-effort data. */
function BestEffortsCard() {
  const { data } = useGetInjuryRiskDashboard();
  const segments = data?.segments ?? [];
  if (segments.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5 mt-4" data-testid="card-best-efforts">
      <h2 className="font-display font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.08em] flex items-center gap-1.5 mb-4">
        <Mountain className="w-3.5 h-3.5" /> Best Efforts
      </h2>
      <div className="space-y-3">
        {segments.map((s) => (
          <div key={s.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-foreground truncate">{s.name}</span>
              {s.isPr && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[9px] font-bold uppercase tracking-wider shrink-0" title="Set on your latest run">New</span>
              )}
            </div>
            <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">{formatDuration(s.prTimeSeconds)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub?: string; icon: React.ElementType }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="font-display font-semibold text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <p className="font-display font-extrabold text-2xl tracking-tight text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function StravaBanner() {
  const stravaStatus = useStravaStatus();
  const [dismissed, setDismissed] = useState(false);

  // Auto-prompt if user arrived with ?connect=strava
  const [autoPrompt] = useState(() => new URLSearchParams(window.location.search).get("connect") === "strava");

  useEffect(() => {
    if (autoPrompt) window.history.replaceState({}, "", "/");
  }, [autoPrompt]);

  if (dismissed || stravaStatus.isLoading || stravaStatus.data?.connected) return null;

  return (
    <div className={`mb-6 flex items-center gap-4 rounded-xl border px-5 py-4 ${autoPrompt ? "border-[#FC4C02]/30 bg-[#FC4C02]/5" : "border-border bg-secondary"}`}>
      <Activity className="w-6 h-6 shrink-0 text-[#FC4C02]" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          {autoPrompt ? "One more step: connect Strava" : "Connect Strava for automatic run syncing"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Every run will appear in Thrive automatically. No imports needed.</p>
      </div>
      <a
        href="/api/strava/connect"
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 px-4 py-2 rounded-lg bg-[#FC4C02] hover:bg-[#e34400] text-foreground text-xs font-bold transition-colors"
      >
        Connect Strava
      </a>
      <button onClick={() => setDismissed(true)} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors" aria-label="Dismiss">
        <X size={15} />
      </button>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useGetDashboardSummary();

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="h-8 w-32 bg-secondary rounded animate-pulse mb-8" />
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-card border border-border rounded-lg animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const paceStr = data.avgPaceMinPerKm
    ? `${Math.floor(data.avgPaceMinPerKm)}:${String(Math.round((data.avgPaceMinPerKm % 1) * 60)).padStart(2, "0")} /mi`
    : "—";

  const loadLabel = data.trainingLoad.replace("_", " ");

  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="font-display font-semibold text-[11px] uppercase tracking-[0.08em] text-primary">Athlete Portal</p>
        <h1 className="font-display font-extrabold text-3xl tracking-[-0.01em] text-foreground mt-1.5" data-testid="dashboard-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {format(new Date(), "EEEE, MMMM d")}
        </p>
      </div>

      <StravaBanner />

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label="Weekly Distance" value={`${data.weeklyDistanceKm} mi`} sub="last 7 days" icon={Activity} />
        <StatCard label="Weekly Runs" value={data.weeklyRuns} sub="this week" icon={TrendingUp} />
  <StatCard label="Avg Pace" value={paceStr} sub="per mi" icon={TrendingUp} />
        <StatCard label="Injury Alerts" value={data.activeAlerts} sub="active" icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Training Load */}
        <div className="col-span-1">
          <div className="bg-card border border-border rounded-xl p-5 mb-4">
            <h2 className="font-display font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.08em] mb-4">Training Load</h2>
            <div className={`font-display font-extrabold text-xl tracking-tight capitalize ${LOAD_COLORS[data.trainingLoad] ?? "text-foreground"}`}>
              {loadLabel}
            </div>
            <div className="mt-3 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  data.trainingLoad === "low" ? "bg-primary" :
                  data.trainingLoad === "moderate" ? "bg-[#10b981]" :
                  data.trainingLoad === "high" ? "bg-[#f59e0b]" :
                  "bg-[#ef4444]"
                }`}
                style={{ width: data.trainingLoad === "low" ? "25%" : data.trainingLoad === "moderate" ? "50%" : data.trainingLoad === "high" ? "75%" : "95%" }}
              />
            </div>
          </div>

          {/* Active plan */}
          {data.currentPlanName && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-display font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.08em] mb-3">Active Plan</h2>
              <p className="text-sm font-medium text-foreground">{data.currentPlanName}</p>
              <Link href="/plans" className="text-xs text-primary hover:underline mt-2 inline-block" data-testid="link-view-plan">View plan</Link>
            </div>
          )}

          {/* Alerts preview */}
          {data.activeAlerts > 0 && (
            <div className="bg-card border border-border rounded-xl p-5 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.08em]">Alerts</h2>
                <Link href="/alerts" className="text-xs text-primary hover:underline" data-testid="link-view-alerts">View all</Link>
              </div>
              <p className="text-sm text-foreground">
                <span className="text-red-600 font-semibold">{data.activeAlerts}</span> active risk {data.activeAlerts === 1 ? "alert" : "alerts"}
              </p>
            </div>
          )}

          {/* Best efforts (Strava PRs) */}
          <BestEffortsCard />
        </div>

        {/* Recent activities */}
        <div className="col-span-2">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.08em]">Recent Activity</h2>
              <Link href="/activities" className="text-xs text-primary hover:underline" data-testid="link-view-activities">View all</Link>
            </div>
            {data.recentActivities.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No activities logged yet</div>
            ) : (
              <div className="space-y-2">
                {data.recentActivities.map(a => (
                  <div key={a.id} className="flex items-center justify-between py-4 border-b border-border last:border-0 hover:bg-secondary/20 transition-colors px-3 -mx-3 rounded-lg" data-testid={`activity-row-${a.id}`}>
                    <div>
                      <span className="text-sm font-semibold text-foreground">{ACTIVITY_LABELS[a.type] ?? a.type}</span>
                      <span className="text-xs text-muted-foreground ml-3 font-medium">{format(new Date(a.activityDate), "MMM d")}</span>
                    </div>
                    <div className="flex items-center gap-5 text-sm font-medium text-foreground">
                      {a.distanceKm && <span>{a.distanceKm} mi</span>}
                      {a.durationMinutes && <span className="text-muted-foreground">{a.durationMinutes} min</span>}
                      {a.avgHeartRate && <span className="text-muted-foreground">{a.avgHeartRate} bpm</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
