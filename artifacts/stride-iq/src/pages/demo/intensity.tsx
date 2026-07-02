import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { Activity, ChevronLeft, ChevronRight, MousePointerClick } from "lucide-react";
import { generateDemoIntensityMonth } from "@/lib/demoData";

const INTENSITY_CLASSES = [
  "bg-secondary",
  "bg-red-500/25",
  "bg-red-500/50",
  "bg-red-500/75",
  "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]",
];

const CARD = "bg-card border border-border rounded-3xl";

export default function DemoIntensity() {
  const [, navigate] = useLocation();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const [monthOffset, setMonthOffset] = useState(0);
  const selectedMonth = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, [monthOffset]);

  const intensityMap = useMemo(
    () => generateDemoIntensityMonth(selectedMonth.year, selectedMonth.month, monthOffset === 0),
    [selectedMonth, monthOffset],
  );

  const monthLabel = new Date(selectedMonth.year, selectedMonth.month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const leadingBlanks = new Date(selectedMonth.year, selectedMonth.month - 1, 1).getDay();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" /> Monthly Intensity Map
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every training day scored 0–100 against the hardest day you've ever logged.
        </p>
      </div>

      <div className={`${CARD} p-10 mb-8`}>
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonthOffset(o => o - 1)}
              aria-label="Previous month"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-bold text-foreground uppercase tracking-widest min-w-[150px] text-center">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() => setMonthOffset(o => Math.min(0, o + 1))}
              disabled={monthOffset >= 0}
              aria-label="Next month"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">Low</span>
            {INTENSITY_CLASSES.map((cls, i) => (
              <div key={i} className={`w-3.5 h-3.5 rounded-[3px] ${cls}`} />
            ))}
            <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">High</span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2.5 max-w-3xl mx-auto">
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <div key={`hdr-${i}`} className="text-center text-[11px] font-bold text-muted-foreground/50 pb-1">
              {d}
            </div>
          ))}
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {intensityMap.map(d => {
            const dayNum = Number(d.date.slice(8, 10));
            const isFuture = d.date > todayStr && monthOffset === 0;
            const isToday = d.date === todayStr;
            const brightText = d.intensity >= 3 && !isFuture;
            const clickable = d.activityIds.length > 0;
            return (
              <div
                key={d.date}
                onClick={clickable ? () => navigate("/demo/activities") : undefined}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                title={`${d.date} — intensity ${d.score}/100`}
                className={`relative aspect-square rounded-lg p-1 ${
                  isFuture ? "bg-secondary/30 border border-dashed border-border/60" : INTENSITY_CLASSES[d.intensity]
                } ${isToday ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""} ${
                  clickable
                    ? "cursor-pointer hover:ring-2 hover:ring-primary/70 hover:ring-offset-1 hover:ring-offset-card transition-shadow"
                    : ""
                }`}
              >
                <span
                  className={`absolute top-1 right-1 text-[9px] font-bold leading-none ${
                    brightText ? "text-white/70" : "text-muted-foreground/60"
                  }`}
                >
                  {dayNum}
                </span>
                {!isFuture && (
                  <span
                    className={`absolute inset-0 flex items-center justify-center text-base font-extrabold leading-none ${
                      brightText ? "text-white" : d.score > 0 ? "text-foreground" : "text-muted-foreground/40"
                    }`}
                  >
                    {d.score}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={`${CARD} p-8`}>
        <h2 className="text-lg font-bold text-foreground mb-4">How the score works</h2>
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed max-w-3xl">
          <p>
            Each square is a real day, showing that day's <strong className="text-foreground">intensity score from 0 to 100</strong>.
          </p>
          <p>
            The score is your training load for the day — session RPE × duration (or distance when effort isn't logged) —
            scaled against the <strong className="text-foreground">hardest single day in your entire history</strong>. So a 100 is
            your all-time toughest day, and a 50 is roughly half that load.
          </p>
          <p className="flex items-center gap-1.5 text-foreground">
            <MousePointerClick className="w-4 h-4 text-primary shrink-0" />
            Click any day with a run to see that day's activity.
          </p>
        </div>
      </div>
    </div>
  );
}
