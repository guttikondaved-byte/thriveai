import { useEffect, useState } from "react";
import { X, Activity, AlertTriangle, Heart, Target } from "lucide-react";


export interface AthleteProfileDetail {
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
  recentActivities: Array<{
    id: number;
    type: string;
    distanceKm: number | null;
    durationMinutes: number | null;
    avgHeartRate: number | null;
    perceivedEffort: number | null;
    activityDate: string;
  }>;
  alerts: Array<{
    id: number;
    riskLevel: string;
    bodyPart: string;
    message: string;
    recommendation: string;
    createdAt: string;
  }>;
}

interface Props {
  teamId: number;
  userId: string;
  onClose: () => void;
}

export default function AthleteProfileModal({ teamId, userId, onClose }: Props) {
  const [data, setData] = useState<AthleteProfileDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    setData(null);
    fetch(`/api/teams/${teamId}/members/${userId}/profile`, { credentials: "include" })
      .then(async r => {
        if (!r.ok) {
          if (r.status === 401) throw new Error("Your session expired. Please sign in again.");
          if (r.status === 403) throw new Error("You don't have access to this athlete's profile.");
          if (r.status === 404) throw new Error("This athlete is no longer on your team.");
          throw new Error("Couldn't load this athlete's profile. Please try again.");
        }
        return r.json() as Promise<AthleteProfileDetail>;
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoading(false);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, userId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="p-6 flex flex-col items-center text-center gap-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Couldn't load profile</h2>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={load}
                className="py-2 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Try again
              </button>
              <button
                onClick={onClose}
                className="py-2 px-4 rounded-lg border border-border bg-background text-foreground text-sm font-medium hover:bg-secondary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : data ? (
          <div className="p-6 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-lg font-bold text-primary shrink-0">
                  {data.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-foreground truncate">{data.name}</h2>
                  {data.email && <p className="text-xs text-muted-foreground truncate">{data.email}</p>}
                  <p className="text-[11px] text-muted-foreground">Joined {new Date(data.joinedAt).toLocaleDateString()}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-secondary transition-colors shrink-0"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Stat grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Activity className="w-3 h-3" /> This week
                </p>
                <p className="text-base font-bold text-foreground mt-1">
                  {data.weeklyDistanceKm.toFixed(1)} mi
                </p>
              </div>
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Target className="w-3 h-3" /> Weekly goal
                </p>
                <p className="text-base font-bold text-foreground mt-1">
                  {data.profile?.weeklyMileageGoal != null
                    ? `${data.profile.weeklyMileageGoal.toFixed(0)} mi`
                    : "—"}
                </p>
              </div>
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Heart className="w-3 h-3" /> Resting HR
                </p>
                <p className="text-base font-bold text-foreground mt-1">
                  {data.profile?.restingHeartRate != null ? `${data.profile.restingHeartRate} bpm` : "—"}
                </p>
              </div>
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">HRV</p>
                <p className="text-base font-bold text-foreground mt-1">
                  {data.profile?.hrv != null ? data.profile.hrv.toFixed(0) : "—"}
                </p>
              </div>
            </div>

            {/* Profile details */}
            {data.profile && (
              <div className="bg-background border border-border rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Age</span>
                  <span className="text-foreground font-medium">{data.profile.age ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Fitness level</span>
                  <span className="text-foreground font-medium capitalize">{data.profile.fitnessLevel}</span>
                </div>
                <div className="flex items-center justify-between text-sm gap-3">
                  <span className="text-muted-foreground shrink-0">Primary goal</span>
                  <span className="text-foreground font-medium text-right">{data.profile.primaryGoal}</span>
                </div>
              </div>
            )}

            {/* Personal records */}
            {data.profile && (data.profile.pr5k || data.profile.pr10k || data.profile.prHalf || data.profile.prMarathon) && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Personal Records</p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "5K", val: data.profile.pr5k },
                    { label: "10K", val: data.profile.pr10k },
                    { label: "Half", val: data.profile.prHalf },
                    { label: "Full", val: data.profile.prMarathon },
                  ].map(pr => (
                    <div key={pr.label} className="bg-background border border-border rounded-lg p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">{pr.label}</p>
                      <p className="text-xs font-bold text-foreground mt-0.5">{pr.val || "—"}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk alerts */}
            {data.alerts.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-500" /> Active Risk Alerts
                </p>
                <div className="space-y-2">
                  {data.alerts.map(a => (
                    <div key={a.id} className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground capitalize">{a.bodyPart}</span>
                        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          a.riskLevel === "high" ? "bg-red-500/15 text-red-400" :
                          a.riskLevel === "medium" ? "bg-amber-500/15 text-amber-400" :
                          "bg-yellow-500/15 text-yellow-400"
                        }`}>{a.riskLevel}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{a.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Health notes */}
            {data.profile?.healthNotes && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Health Notes</p>
                <p className="text-sm text-foreground bg-background border border-border rounded-lg p-3">{data.profile.healthNotes}</p>
              </div>
            )}

            {/* Recent activities */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent Activity</p>
              {data.recentActivities.length === 0 ? (
                <p className="text-sm text-muted-foreground bg-background border border-border rounded-lg p-3">No runs logged yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.recentActivities.map(a => (
                    <div key={a.id} className="flex items-center justify-between bg-background border border-border rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground capitalize truncate">{a.type.replace(/_/g, " ")}</p>
                        <p className="text-[11px] text-muted-foreground">{new Date(a.activityDate).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-foreground">
                          {a.distanceKm != null ? `${a.distanceKm.toFixed(1)} mi` : "—"}
                        </p>
                        {a.durationMinutes != null && (
                          <p className="text-[11px] text-muted-foreground">{a.durationMinutes} min</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
