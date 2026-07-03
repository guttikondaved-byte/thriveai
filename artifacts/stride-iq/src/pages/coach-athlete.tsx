import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Activity, AlertTriangle, Heart, Target, TrendingUp, Flame, Timer } from "lucide-react";
import { StatCard } from "@/components/coach/StatCard";
import { Eyebrow } from "@/components/coach/PageHeader";

type RiskLevel = "high" | "medium" | "low";

export interface AthleteActivity {
  id: number;
  type: string;
  distanceKm: number | null;
  durationMinutes: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  perceivedEffort: number | null;
  activityDate: string;
  elevationGainM: number | null;
  avgSpeed: number | null;
  movingTimeSeconds: number | null;
  calories: number | null;
  sufferScore: number | null;
  notes: string | null;
  description: string | null;
}

export interface AthleteDetail {
  userId: string;
  name: string;
  email: string | null;
  joinedAt: string;
  profile: {
    age: number | null;
    fitnessLevel: string;
    primaryGoal: string;
    weeklyMileageGoal: number | null;
    restingHeartRate: number | null;
    hrv: number | null;
    pr5k: string | null;
    pr10k: string | null;
    prHalf: string | null;
    prMarathon: string | null;
    healthNotes: string | null;
  } | null;
  weeklyDistanceKm: number;
  weeklyWorkouts: number;
  totalActivities: number;
  totalDistanceKm: number;
  weeklyTrend: Array<{ weekStart: string; distanceKm: number; workouts: number }>;
  recentActivities: AthleteActivity[];
  alerts: Array<{
    id: number;
    riskLevel: string;
    bodyPart: string;
    message: string;
    recommendation: string;
    createdAt: string;
  }>;
}

interface TeamInfo {
  id: number;
}

function paceFor(a: AthleteActivity): string | null {
  const minutes = a.movingTimeSeconds != null ? a.movingTimeSeconds / 60 : a.durationMinutes;
  if (minutes == null || a.distanceKm == null || a.distanceKm <= 0) return null;
  const paceMin = minutes / a.distanceKm;
  const m = Math.floor(paceMin);
  const s = Math.round((paceMin - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}/mi`;
}

function durationFor(a: AthleteActivity): string | null {
  const totalMin = a.movingTimeSeconds != null ? Math.round(a.movingTimeSeconds / 60) : a.durationMinutes;
  if (totalMin == null) return null;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

const NOT_SET = <span className="text-muted-foreground/50 text-base italic font-normal">Not set</span>;

export default function CoachAthleteDetail({ params }: { params: { userId: string } }) {
  const [, navigate] = useLocation();
  const [data, setData] = useState<AthleteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/teams/my", { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject(new Error("Couldn't load your team.")))
      .then((d: { team: TeamInfo | null }) => {
        if (!d.team) throw new Error("You don't have a team yet.");
        return fetch(`/api/teams/${d.team.id}/members/${params.userId}/profile`, { credentials: "include" });
      })
      .then(async r => {
        if (!r.ok) {
          if (r.status === 401) throw new Error("Your session expired. Please sign in again.");
          if (r.status === 403) throw new Error("You don't have access to this athlete's profile.");
          if (r.status === 404) throw new Error("This athlete is no longer on your team.");
          throw new Error("Couldn't load this athlete's profile. Please try again.");
        }
        return r.json() as Promise<AthleteDetail>;
      })
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch((err: Error) => { if (!cancelled) { setError(err.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [params.userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <div className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="w-5 h-5 text-destructive" />
        </div>
        <h2 className="text-base font-semibold text-foreground">Couldn't load athlete</h2>
        <p className="text-sm text-muted-foreground mt-1">{error ?? "Something went wrong."}</p>
        <button
          onClick={() => navigate("/")}
          className="mt-4 py-2 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return <AthleteDetailView data={data} onBack={() => navigate("/")} />;
}

export function AthleteDetailView({ data, onBack }: { data: AthleteDetail; onBack: () => void }) {
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);
  const maxWeekMiles = Math.max(...data.weeklyTrend.map(w => w.distanceKm), 1);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-xl font-bold text-primary shrink-0">
            {data.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <Eyebrow accent>Athlete Profile</Eyebrow>
            <h1 className="font-display font-extrabold text-3xl tracking-[-0.01em] text-foreground truncate mt-0.5">{data.name}</h1>
            <p className="text-sm text-muted-foreground truncate">{data.email ? `${data.email} · ` : ""}Joined {new Date(data.joinedAt).toLocaleDateString()}</p>
          </div>
        </div>
        {data.alerts.length > 0 && (
          <a
            href="#alerts"
            className="flex items-center gap-1.5 px-3 py-2 rounded-md font-display font-semibold text-xs uppercase tracking-[0.06em] text-amber-600 bg-amber-500/10 border border-amber-500/20 shrink-0"
          >
            <AlertTriangle className="w-4 h-4" />
            {data.alerts.length} alert{data.alerts.length !== 1 ? "s" : ""}
          </a>
        )}
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard size="sm" icon={Activity} label="This week" value={<>{data.weeklyDistanceKm.toFixed(1)} <span className="text-sm font-medium text-muted-foreground">mi</span></>} />
        <StatCard size="sm" icon={Timer} label="Workouts" value={data.weeklyWorkouts} sub="this week" />
        <StatCard size="sm" icon={Target} label="Weekly goal" value={data.profile?.weeklyMileageGoal != null ? <>{data.profile.weeklyMileageGoal.toFixed(0)} <span className="text-sm font-medium text-muted-foreground">mi</span></> : NOT_SET} />
        <StatCard size="sm" icon={Heart} label="Resting HR" value={data.profile?.restingHeartRate != null ? <>{data.profile.restingHeartRate} <span className="text-sm font-medium text-muted-foreground">bpm</span></> : NOT_SET} />
        <StatCard size="sm" icon={TrendingUp} label="HRV" value={data.profile?.hrv != null ? <>{data.profile.hrv.toFixed(0)} <span className="text-sm font-medium text-muted-foreground">ms</span></> : NOT_SET} />
        <StatCard size="sm" icon={Flame} label="All time" value={<>{data.totalDistanceKm.toFixed(0)} <span className="text-sm font-medium text-muted-foreground">mi</span></>} sub={`${data.totalActivities} activities`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6 items-start">
        {/* Weekly trend */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <Eyebrow className="mb-4">Weekly Mileage · Last 8 Weeks</Eyebrow>
          <div className="flex items-end gap-2 h-36">
            {data.weeklyTrend.map((w, i) => (
              <div
                key={w.weekStart}
                className="relative flex-1 flex flex-col items-center justify-end h-full"
                onMouseEnter={() => setHoveredWeek(i)}
                onMouseLeave={() => setHoveredWeek(null)}
              >
                {hoveredWeek === i && (
                  <div className="absolute -top-1 -translate-y-full bg-popover border border-border rounded-lg px-2.5 py-1.5 text-xs shadow-md whitespace-nowrap z-10">
                    <span className="font-semibold text-foreground">{w.distanceKm.toFixed(1)} mi</span>
                    <span className="text-muted-foreground"> · {w.workouts} workout{w.workouts !== 1 ? "s" : ""}</span>
                  </div>
                )}
                <div
                  className={`w-full max-w-8 rounded-t bg-primary transition-opacity ${hoveredWeek != null && hoveredWeek !== i ? "opacity-50" : ""}`}
                  style={{ height: `${Math.max((w.distanceKm / maxWeekMiles) * 100, w.distanceKm > 0 ? 4 : 1)}%` }}
                />
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  {new Date(w.weekStart + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Profile details */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <Eyebrow>Profile</Eyebrow>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Age</span>
            <span className="text-foreground font-medium">{data.profile?.age ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Fitness level</span>
            <span className="text-foreground font-medium capitalize">{data.profile?.fitnessLevel ?? "—"}</span>
          </div>
          <div className="flex items-center justify-between text-sm gap-3">
            <span className="text-muted-foreground shrink-0">Primary goal</span>
            <span className="text-foreground font-medium text-right">{data.profile?.primaryGoal ?? "—"}</span>
          </div>
          <div className="pt-2 border-t border-border">
            <p className="font-display font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.08em] mb-2">Personal Records</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "5K", val: data.profile?.pr5k },
                { label: "10K", val: data.profile?.pr10k },
                { label: "Half", val: data.profile?.prHalf },
                { label: "Full", val: data.profile?.prMarathon },
              ].map(pr => (
                <div key={pr.label} className="bg-background border border-border rounded-lg p-2 text-center">
                  <p className="text-[10px] text-muted-foreground">{pr.label}</p>
                  <p className="text-xs font-bold text-foreground mt-0.5">{pr.val || "—"}</p>
                </div>
              ))}
            </div>
          </div>
          {data.profile?.healthNotes && (
            <div className="pt-2 border-t border-border">
              <p className="font-display font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.08em] mb-1.5">Health Notes</p>
              <p className="text-sm text-foreground">{data.profile.healthNotes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Risk alerts */}
      {data.alerts.length > 0 && (
        <div id="alerts" className="bg-card border border-amber-500/30 rounded-xl p-5 mb-6">
          <Eyebrow className="mb-3 flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3 text-amber-500" /> Active Risk Alerts
          </Eyebrow>
          <div className="space-y-2">
            {data.alerts.map(a => (
              <div key={a.id} className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground capitalize">{a.bodyPart}</span>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    a.riskLevel === "high" ? "bg-red-500/15 text-red-600" :
                    a.riskLevel === "medium" ? "bg-amber-500/15 text-amber-600" :
                    "bg-yellow-500/15 text-yellow-600"
                  }`}>{a.riskLevel}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{a.message}</p>
                {a.recommendation && <p className="text-xs text-foreground mt-2 font-medium">{a.recommendation}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity history */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <Eyebrow>Activity History</Eyebrow>
          <span className="text-muted-foreground text-xs">last {data.recentActivities.length} activities</span>
        </div>
        {data.recentActivities.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">No activities logged yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-muted-foreground uppercase tracking-wider border-b border-border">
                  <th className="px-5 py-2.5 font-semibold">Date</th>
                  <th className="px-3 py-2.5 font-semibold">Type</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Distance</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Duration</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Pace</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Avg HR</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Elev</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Effort</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.recentActivities.map(a => (
                  <tr key={a.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 text-foreground whitespace-nowrap">{new Date(a.activityDate + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}</td>
                    <td className="px-3 py-3">
                      <span className="capitalize text-foreground">{a.type.replace(/_/g, " ")}</span>
                      {(a.notes || a.description) && (
                        <p className="text-[11px] text-muted-foreground truncate max-w-48" title={a.notes ?? a.description ?? undefined}>{a.notes ?? a.description}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-foreground whitespace-nowrap">{a.distanceKm != null ? `${a.distanceKm.toFixed(1)} mi` : "—"}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground whitespace-nowrap">{durationFor(a) ?? "—"}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground whitespace-nowrap">{paceFor(a) ?? "—"}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground whitespace-nowrap">{a.avgHeartRate != null ? `${a.avgHeartRate}${a.maxHeartRate != null ? ` / ${a.maxHeartRate}` : ""}` : "—"}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground whitespace-nowrap">{a.elevationGainM != null ? `${Math.round(a.elevationGainM)} m` : "—"}</td>
                    <td className="px-5 py-3 text-right text-muted-foreground whitespace-nowrap">{a.sufferScore ?? (a.perceivedEffort != null ? `${a.perceivedEffort}/10` : "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
