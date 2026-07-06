import { Activity } from "lucide-react";
import { Eyebrow } from "@/components/coach/PageHeader";

const INTENSITY_CLASSES = [
  "bg-secondary",
  "bg-red-500/25",
  "bg-red-500/50",
  "bg-red-500/75",
  "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]",
];

export interface IntensityDay {
  date: string;
  score: number;
  intensity: number;
  activityIds: number[];
}

/**
 * Read-only monthly training-load heatmap for a coach viewing an athlete's
 * profile. Unlike the athlete's own /intensity page, this has no month
 * navigation (always shows the current month) and days aren't clickable —
 * coaches don't have a route to view another athlete's individual activity.
 */
export function IntensityGrid({ days, monthLabel }: { days: IntensityDay[]; monthLabel: string }) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const leadingBlanks = days.length > 0 ? new Date(days[0].date + "T00:00:00").getDay() : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <Eyebrow>Intensity Map · {monthLabel}</Eyebrow>
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">Low</span>
          {INTENSITY_CLASSES.map((cls, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-[2px] ${cls}`} />
          ))}
          <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">High</span>
        </div>
      </div>

      {days.length > 0 ? (
        <div className="grid grid-cols-7 gap-1.5">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={`hdr-${i}`} className="text-center text-[9px] font-bold text-muted-foreground/50 pb-0.5">
              {d}
            </div>
          ))}
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {days.map((d) => {
            const dayNum = Number(d.date.slice(8, 10));
            const isFuture = d.date > todayStr;
            const isToday = d.date === todayStr;
            const brightText = d.intensity >= 3 && !isFuture;
            return (
              <div
                key={d.date}
                title={`${d.date}: intensity ${d.score}/100`}
                className={`relative aspect-square rounded p-0.5 ${
                  isFuture ? "bg-secondary/30 border border-dashed border-border/60" : INTENSITY_CLASSES[d.intensity]
                } ${isToday ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : ""}`}
              >
                <span
                  className={`absolute top-0.5 right-1 text-[7px] font-bold leading-none ${
                    brightText ? "text-white/70" : "text-muted-foreground/60"
                  }`}
                >
                  {dayNum}
                </span>
                {!isFuture && d.score > 0 && (
                  <span
                    className={`absolute inset-0 flex items-center justify-center text-[10px] font-extrabold leading-none ${
                      brightText ? "text-white" : "text-foreground"
                    }`}
                  >
                    {d.score}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-10 text-center">
          <Activity className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No training data this month yet.</p>
        </div>
      )}
    </div>
  );
}
