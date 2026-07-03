import { useLocation } from "wouter";
import { Activity, AlertTriangle, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { DEMO_DATA, ACTIVITY_LABELS } from "@/lib/demoData";

const LOAD_COLORS: Record<string, string> = {
  low: "text-primary",
  moderate: "text-[#10b981]",
  high: "text-[#f59e0b]",
  very_high: "text-[#ef4444]",
};

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub?: string; icon: React.ElementType }) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function DemoDashboard() {
  const [, navigate] = useLocation();
  const data = DEMO_DATA;

  const paceStr = `${Math.floor(data.avgPaceMinPerKm)}:${String(Math.round((data.avgPaceMinPerKm % 1) * 60)).padStart(2, "0")} /mi`;
  const loadLabel = data.trainingLoad.replace("_", " ");

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display font-extrabold text-3xl tracking-[-0.01em] text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">{format(new Date(), "EEEE, MMMM d")}</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard label="Weekly Distance" value={`${data.weeklyDistanceKm} mi`} sub="last 7 days" icon={Activity} />
        <StatCard label="Weekly Runs" value={data.weeklyRuns} sub="this week" icon={TrendingUp} />
        <StatCard label="Avg Pace" value={paceStr} sub="per mi" icon={TrendingUp} />
        <StatCard label="Injury Alerts" value={data.activeAlerts.length} sub="active" icon={AlertTriangle} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1">
          <div className="bg-card border border-border rounded-lg p-5 mb-4">
            <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Training Load</h2>
            <div className={`text-xl font-semibold capitalize ${LOAD_COLORS[data.trainingLoad] ?? "text-foreground"}`}>
              {loadLabel}
            </div>
            <div className="mt-3 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-[#10b981]" style={{ width: "50%" }} />
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-5 mb-4">
            <h2 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Active Plan</h2>
            <p className="text-sm font-medium text-foreground">{data.currentPlanName}</p>
            <button onClick={() => navigate("/demo/plans")} className="text-xs text-primary hover:underline mt-2 inline-block">
              View plan
            </button>
          </div>

          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs text-muted-foreground uppercase tracking-wider">Alerts</h2>
              <button onClick={() => navigate("/demo/alerts")} className="text-xs text-primary hover:underline">View all</button>
            </div>
            <p className="text-sm text-foreground">
              <span className="text-red-600 font-semibold">{data.activeAlerts.length}</span> active risk alert
            </p>
          </div>
        </div>

        <div className="col-span-2">
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs text-muted-foreground uppercase tracking-wider">Recent Activity</h2>
              <button onClick={() => navigate("/demo/activities")} className="text-xs text-primary hover:underline">View all</button>
            </div>
            <div className="space-y-2">
              {data.recentActivities.slice(0, 4).map(a => (
                <div key={a.id} className="flex items-center justify-between py-4 border-b border-border last:border-0 px-3 -mx-3 rounded-lg">
                  <div>
                    <span className="text-sm font-semibold text-foreground">{ACTIVITY_LABELS[a.type] ?? a.type}</span>
                    <span className="text-xs text-muted-foreground ml-3 font-medium">{format(new Date(a.activityDate), "MMM d")}</span>
                  </div>
                  <div className="flex items-center gap-5 text-sm font-medium text-foreground">
                    <span>{a.distanceKm} mi</span>
                    <span className="text-muted-foreground">{a.durationMinutes} min</span>
                    <span className="text-muted-foreground">{a.avgHeartRate} bpm</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
