import { useGetDashboardSummary } from "@workspace/api-client-react";
import { AlertTriangle, Activity, TrendingUp, Zap, X } from "lucide-react";
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
  low: "text-emerald-400", moderate: "text-cyan-400",
  high: "text-amber-400", very_high: "text-red-400",
};

const RISK_COLORS: Record<string, string> = {
  low: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  high: "bg-red-500/20 text-red-400 border-red-500/30",
  critical: "bg-red-600/30 text-red-300 border-red-600/40",
};

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub?: string; icon: React.ElementType }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
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
    <div className={`mb-6 flex items-center gap-4 rounded-xl border px-5 py-4 ${autoPrompt ? "border-[#FC4C02]/50 bg-[#FC4C02]/10" : "border-slate-700/60 bg-slate-800/40"}`}>
      <span className="text-2xl shrink-0">🟠</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">
          {autoPrompt ? "One more step — connect Strava" : "Connect Strava for automatic run syncing"}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">Every run will appear in Thrive automatically. No imports needed.</p>
      </div>
      <a
        href="/api/strava/connect"
        className="shrink-0 px-4 py-2 rounded-lg bg-[#FC4C02] hover:bg-[#e34400] text-white text-xs font-bold transition-colors"
      >
        Connect Strava
      </a>
      <button onClick={() => setDismissed(true)} className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors" aria-label="Dismiss">
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
    ? `${Math.floor(data.avgPaceMinPerKm)}:${String(Math.round((data.avgPaceMinPerKm % 1) * 60)).padStart(2, "0")} /km`
    : "—";

  const loadLabel = data.trainingLoad.replace("_", " ");

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground" data-testid="dashboard-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {format(new Date(), "EEEE, MMMM d")}
        </p>
      </div>

      <StravaBanner />

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label="Weekly Distance" value={`${data.weeklyDistanceKm} km`} sub="last 7 days" icon={Activity} />
        <StatCard label="Weekly Runs" value={data.weeklyRuns} sub="this week" icon={TrendingUp} />
        <StatCard label="Avg Pace" value={paceStr} sub="per km" icon={Zap} />
        <StatCard label="Injury Alerts" value={data.activeAlerts} sub="active" icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Training Load */}
        <div className="col-span-1">
          <div className="bg-card border border-border rounded-lg p-5 mb-4">
            <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Training Load</h2>
            <div className={`text-xl font-semibold capitalize ${LOAD_COLORS[data.trainingLoad] ?? "text-foreground"}`}>
              {loadLabel}
            </div>
            <div className="mt-3 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: data.trainingLoad === "low" ? "25%" : data.trainingLoad === "moderate" ? "50%" : data.trainingLoad === "high" ? "75%" : "95%" }}
              />
            </div>
          </div>

          {/* Active plan */}
          {data.currentPlanName && (
            <div className="bg-card border border-border rounded-lg p-5">
              <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Active Plan</h2>
              <p className="text-sm font-medium text-foreground">{data.currentPlanName}</p>
              <Link href="/plans" className="text-xs text-primary hover:underline mt-2 inline-block" data-testid="link-view-plan">View plan</Link>
            </div>
          )}

          {/* Alerts preview */}
          {data.activeAlerts > 0 && (
            <div className="bg-card border border-border rounded-lg p-5 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs text-muted-foreground uppercase tracking-wider">Alerts</h2>
                <Link href="/alerts" className="text-xs text-primary hover:underline" data-testid="link-view-alerts">View all</Link>
              </div>
              <p className="text-sm text-foreground">
                <span className="text-red-400 font-semibold">{data.activeAlerts}</span> active risk {data.activeAlerts === 1 ? "alert" : "alerts"}
              </p>
            </div>
          )}
        </div>

        {/* Recent activities */}
        <div className="col-span-2">
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs text-muted-foreground uppercase tracking-wider">Recent Activity</h2>
              <Link href="/activities" className="text-xs text-primary hover:underline" data-testid="link-view-activities">View all</Link>
            </div>
            {data.recentActivities.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No activities logged yet</div>
            ) : (
              <div className="space-y-2">
                {data.recentActivities.map(a => (
                  <div key={a.id} className="flex items-center justify-between py-3 border-b border-border last:border-0" data-testid={`activity-row-${a.id}`}>
                    <div>
                      <span className="text-sm font-medium text-foreground">{ACTIVITY_LABELS[a.type] ?? a.type}</span>
                      <span className="text-xs text-muted-foreground ml-3">{format(new Date(a.activityDate), "MMM d")}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {a.distanceKm && <span>{a.distanceKm} km</span>}
                      {a.durationMinutes && <span>{a.durationMinutes} min</span>}
                      {a.avgHeartRate && <span>{a.avgHeartRate} bpm</span>}
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
