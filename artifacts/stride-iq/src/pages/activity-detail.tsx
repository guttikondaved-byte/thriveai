import { useParams, Link } from "wouter";
import BackButton from "@/components/BackButton";
import { useGetActivity } from "@workspace/api-client-react";
import { format } from "date-fns";
import {
  ArrowLeft, MapPin, Clock, TrendingUp, Heart, Activity as ActivityIcon,
  Flame, Footprints, Gauge, Thermometer, Trophy, Award, ThumbsUp,
  MessageCircle, Mountain, Timer,
} from "lucide-react";
const basePath = import.meta.env.BASE_URL || "";
import { decodePolyline, polylineToSvgPath } from "@/lib/polyline";

const ACTIVITY_LABELS: Record<string, string> = {
  easy_run: "Easy Run", tempo_run: "Tempo", interval: "Interval",
  long_run: "Long Run", race: "Race", cross_training: "Cross Training", rest: "Rest",
};

const ACTIVITY_COLORS: Record<string, string> = {
  easy_run: "text-[#10b981] bg-[#10b981]/10 border-[#10b981]/20",
  tempo_run: "text-accent bg-accent/10 border-accent/20",
  interval: "text-primary bg-primary/10 border-primary/20",
  long_run: "text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/20",
  race: "text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/20",
  cross_training: "text-primary bg-primary/10 border-primary/20",
  rest: "text-muted-foreground bg-secondary border-border",
};

const M_PER_MILE = 1609.344;

function fmtDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.round(totalSeconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// pace per mile from speed in m/s
function paceFromSpeed(speedMs: number): string {
  if (!speedMs) return "—";
  const secPerMile = M_PER_MILE / speedMs;
  const m = Math.floor(secPerMile / 60);
  const s = Math.round(secPerMile % 60);
  return `${m}:${String(s).padStart(2, "0")}/mi`;
}

const metersToFeet = (m: number) => Math.round(m * 3.28084);
const cToF = (c: number) => Math.round((c * 9) / 5 + 32);

function MetricCard({ icon, label, value, sub }: {
  icon: React.ReactNode; label: string; value: string; sub?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-xl font-semibold text-foreground tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export default function ActivityDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "", 10);
  const { data: activity, isLoading, isError } = useGetActivity(id, {
    query: { enabled: Number.isFinite(id) },
  });

  if (isLoading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <BackButton href="/activities" />
        <div className="h-5 w-32 bg-card border border-border rounded animate-pulse mb-6" />
        <div className="h-24 bg-card border border-border rounded-xl animate-pulse mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-card border border-border rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (isError || !activity) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <BackButton href="/activities" />
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <p className="text-sm text-muted-foreground">Activity not found.</p>
        </div>
      </div>
    );
  }

  const movingSec = activity.movingTimeSeconds ?? (activity.durationMinutes != null ? activity.durationMinutes * 60 : null);
  const distance = activity.distanceKm; // stored in miles

  const polyPoints = activity.mapPolyline ? decodePolyline(activity.mapPolyline) : [];
  const mapW = 760, mapH = 260;
  const routePath = polyPoints.length > 1 ? polylineToSvgPath(polyPoints, mapW, mapH) : "";
  const parsePoint = (pt: [number, number]): { x: number; y: number } => {
    const [x, y] = polylineToSvgPath([pt], mapW, mapH).slice(1).split(",").map(Number);
    return { x: x ?? 0, y: y ?? 0 };
  };

  const startLabel = activity.startDateLocal
    ? format(new Date(activity.startDateLocal), "EEEE, MMM d, yyyy · h:mm a")
    : format(new Date(activity.activityDate), "EEEE, MMM d, yyyy");

  const splits = activity.splits ?? [];

  return (
    <div className="p-8 max-w-5xl mx-auto" data-testid={`activity-detail-${activity.id}`}>
  <BackButton href="/activities" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold tracking-wide uppercase ${ACTIVITY_COLORS[activity.type] ?? "text-muted-foreground bg-secondary border-border"}`}>
              {ACTIVITY_LABELS[activity.type] ?? activity.type}
            </span>
            {activity.stravaActivityId != null && (
              <span className="text-[10px] px-2 py-0.5 rounded border border-[#FC4C02]/30 bg-[#FC4C02]/10 text-[#FC4C02] font-semibold uppercase tracking-wide">
                Strava
              </span>
            )}
          </div>
          <h1 className="font-display font-extrabold text-3xl tracking-[-0.01em] text-foreground" data-testid="activity-detail-title">
            {activity.notes || ACTIVITY_LABELS[activity.type] || "Activity"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{startLabel}</p>
        </div>
      </div>

      {/* Route map */}
      {routePath && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <MapPin className="w-4 h-4" />
            <span className="text-[11px] font-medium uppercase tracking-wide">Route</span>
          </div>
          <svg viewBox={`0 0 ${mapW} ${mapH}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet" data-testid="route-map">
            <path d={routePath} fill="none" stroke="#2E90D9" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
            {(() => {
              const start = parsePoint(polyPoints[0]!);
              const end = parsePoint(polyPoints[polyPoints.length - 1]!);
              return (
                <>
                  <circle cx={start.x} cy={start.y} r={5} fill="#10b981" stroke="#ffffff" strokeWidth={2} />
                  <circle cx={end.x} cy={end.y} r={5} fill="#ef4444" stroke="#ffffff" strokeWidth={2} />
                </>
              );
            })()}
          </svg>
        </div>
      )}

      {/* Primary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {distance != null && (
          <MetricCard icon={<ActivityIcon className="w-4 h-4" />} label="Distance" value={`${distance.toFixed(2)} mi`} />
        )}
        {movingSec != null && (
          <MetricCard icon={<Clock className="w-4 h-4" />} label="Moving Time" value={fmtDuration(movingSec)}
            sub={activity.elapsedTimeSeconds != null && activity.elapsedTimeSeconds !== movingSec ? `${fmtDuration(activity.elapsedTimeSeconds)} elapsed` : undefined} />
        )}
        {activity.elevationGainM != null && (
          <MetricCard icon={<TrendingUp className="w-4 h-4" />} label="Elevation Gain" value={`${metersToFeet(activity.elevationGainM)} ft`} />
        )}
        {activity.avgHeartRate != null && (
          <MetricCard icon={<Heart className="w-4 h-4" />} label="Avg Heart Rate" value={`${activity.avgHeartRate} bpm`}
            sub={activity.maxHeartRate != null ? `${activity.maxHeartRate} bpm max` : undefined} />
        )}
        {activity.avgCadence != null && (
          <MetricCard icon={<Footprints className="w-4 h-4" />} label="Avg Cadence" value={`${Math.round(activity.avgCadence * 2)} spm`} />
        )}
        {activity.calories != null && (
          <MetricCard icon={<Flame className="w-4 h-4" />} label="Calories" value={`${Math.round(activity.calories)}`} />
        )}
    {activity.sufferScore != null && (
      <MetricCard icon={<img src={`${window.location.origin}${basePath}/logo-mark.svg`} className="w-4 h-4" alt="effort" />} label="Relative Effort" value={`${activity.sufferScore}`} />
    )}
        {activity.maxSpeed != null && (
          <MetricCard icon={<Timer className="w-4 h-4" />} label="Best Pace" value={paceFromSpeed(activity.maxSpeed)} />
        )}
        {activity.avgWatts != null && (
          <MetricCard icon={<img src={`${window.location.origin}${basePath}/logo-mark.svg`} className="w-4 h-4" alt="power" />} label="Avg Power" value={`${Math.round(activity.avgWatts)} W`} />
        )}
        {(activity.elevHighM != null || activity.elevLowM != null) && (
          <MetricCard icon={<Mountain className="w-4 h-4" />} label="Elevation"
            value={`${activity.elevHighM != null ? metersToFeet(activity.elevHighM) : "—"} ft`}
            sub={activity.elevLowM != null ? `${metersToFeet(activity.elevLowM)} ft low` : undefined} />
        )}
        {activity.avgTemp != null && (
          <MetricCard icon={<Thermometer className="w-4 h-4" />} label="Temperature" value={`${cToF(activity.avgTemp)}°F`} />
        )}
        {activity.perceivedEffort != null && (
          <MetricCard icon={<Gauge className="w-4 h-4" />} label="Perceived Effort" value={`${activity.perceivedEffort}/10`} />
        )}
      </div>

      {/* Social / achievements */}
      {(activity.achievementCount != null || activity.prCount != null || activity.kudosCount != null || activity.commentCount != null || activity.gearName) && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          {activity.prCount != null && activity.prCount > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-foreground"><Trophy className="w-4 h-4 text-[#f59e0b]" /> {activity.prCount} PR{activity.prCount > 1 ? "s" : ""}</span>
          )}
          {activity.achievementCount != null && activity.achievementCount > 0 && (
            <span className="flex items-center gap-1.5 text-sm text-foreground"><Award className="w-4 h-4 text-[#10b981]" /> {activity.achievementCount} achievement{activity.achievementCount > 1 ? "s" : ""}</span>
          )}
          {activity.kudosCount != null && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><ThumbsUp className="w-4 h-4" /> {activity.kudosCount} kudos</span>
          )}
          {activity.commentCount != null && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><MessageCircle className="w-4 h-4" /> {activity.commentCount} comment{activity.commentCount === 1 ? "" : "s"}</span>
          )}
          {activity.gearName && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground"><Footprints className="w-4 h-4" /> {activity.gearName}</span>
          )}
        </div>
      )}

      {/* Description */}
      {activity.description && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{activity.description}</p>
        </div>
      )}

      {/* Splits */}
      {splits.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <Gauge className="w-4 h-4" />
            <span className="text-[11px] font-medium uppercase tracking-wide">Mile Splits</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="splits-table">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 font-medium">Mile</th>
                  <th className="py-2 pr-4 font-medium">Pace</th>
                  <th className="py-2 pr-4 font-medium">Elev</th>
                  <th className="py-2 pr-4 font-medium">Avg HR</th>
                </tr>
              </thead>
              <tbody>
                {splits.map((s) => {
                  const milesFraction = s.distance / M_PER_MILE;
                  const label = milesFraction >= 0.95 ? `${s.split}` : `${s.split} (${milesFraction.toFixed(2)} mi)`;
                  return (
                    <tr key={s.split} className="border-b border-border/50 last:border-0">
                      <td className="py-2 pr-4 text-foreground tabular-nums">{label}</td>
                      <td className="py-2 pr-4 text-foreground tabular-nums">{paceFromSpeed(s.averageSpeed)}</td>
                      <td className="py-2 pr-4 text-muted-foreground tabular-nums">
                        {s.elevationDifference != null ? `${s.elevationDifference >= 0 ? "+" : ""}${metersToFeet(s.elevationDifference)} ft` : "—"}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground tabular-nums">
                        {s.averageHeartrate != null ? `${Math.round(s.averageHeartrate)} bpm` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Best efforts */}
      {activity.bestEfforts && activity.bestEfforts.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-3">
            <Trophy className="w-4 h-4" />
            <span className="text-[11px] font-medium uppercase tracking-wide">Best Efforts</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {activity.bestEfforts.map((b, i) => (
              <div key={`${b.name}-${i}`} className="flex items-center justify-between bg-secondary/40 rounded-lg px-3 py-2">
                <span className="text-sm text-muted-foreground">{b.name}</span>
                <span className="text-sm font-semibold text-foreground tabular-nums">{fmtDuration(b.elapsedTime)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
