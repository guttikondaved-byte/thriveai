import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useGetInjuryRiskIntensityMap, getGetInjuryRiskIntensityMapQueryKey, ApiError } from "@workspace/api-client-react";
import { Activity, ChevronLeft, ChevronRight, MousePointerClick, Lock } from "lucide-react";

const INTENSITY_CLASSES = [
  "bg-secondary",
  "bg-red-500/25",
  "bg-red-500/50",
  "bg-red-500/75",
  "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]",
];

const CARD = "premium-card rounded-3xl";

export default function Intensity() {
  const [, setLocation] = useLocation();

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  // Month navigation: 0 = current month, -1 = last month, etc.
  const [monthOffset, setMonthOffset] = useState(0);
  const selectedMonth = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [monthOffset]);

  const { data, isFetching, error } = useGetInjuryRiskIntensityMap(
    { month: selectedMonth },
    { query: { queryKey: getGetInjuryRiskIntensityMapQueryKey({ month: selectedMonth }), retry: false } },
  );
  const intensityMap = data?.days ?? [];
  const needsUpgrade = error instanceof ApiError && error.status === 402;

  const [selYear, selMonth] = selectedMonth.split("-").map(Number);
  const monthLabel =
    data?.label ?? new Date(selYear, selMonth - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  // Blank leading cells so the 1st of the month lands on its real weekday column.
  const leadingBlanks = new Date(selYear, selMonth - 1, 1).getDay();

  if (needsUpgrade) {
    return (
      <div className="p-8">
        <div className="mb-8">
          <p className="font-display font-semibold text-[11px] uppercase tracking-[0.08em] text-primary">Training Load</p>
          <h1 className="font-display font-extrabold text-3xl tracking-[-0.01em] text-foreground mt-1.5" data-testid="intensity-title">
            Monthly Intensity Map
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every training day scored 0–100 against the hardest day you&apos;ve ever logged.
          </p>
        </div>
        <div className={`${CARD} py-16 px-8 text-center`}>
          <Lock className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1.5">The intensity map is a Pro feature</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
            Upgrade for unlimited AveraAI, automatic Strava sync, and the training intensity calendar.
          </p>
          <button
            type="button"
            onClick={() => setLocation("/profile")}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <p className="font-display font-semibold text-[11px] uppercase tracking-[0.08em] text-primary">Training Load</p>
        <h1 className="font-display font-extrabold text-3xl tracking-[-0.01em] text-foreground mt-1.5" data-testid="intensity-title">
          Monthly Intensity Map
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Every training day scored 0–100 against the hardest day you&apos;ve ever logged.
        </p>
      </div>

      <div className={`${CARD} p-10 mb-8`}>
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonthOffset((o) => o - 1)}
              aria-label="Previous month"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-bold text-foreground uppercase tracking-widest min-w-[150px] text-center">
              {monthLabel}
              {isFetching ? " …" : ""}
            </span>
            <button
              type="button"
              onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}
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

        {intensityMap.length > 0 ? (
          <div className="grid grid-cols-7 gap-2.5 max-w-3xl mx-auto">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={`hdr-${i}`} className="text-center text-[11px] font-bold text-muted-foreground/50 pb-1">
                {d}
              </div>
            ))}
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} />
            ))}
            {intensityMap.map((d) => {
              const dateStr = d.date.slice(0, 10);
              const dayNum = Number(dateStr.slice(8, 10));
              const isFuture = dateStr > todayStr;
              const isToday = dateStr === todayStr;
              const brightText = d.intensity >= 3 && !isFuture;
              const activityCount = d.activityIds.length;
              const clickable = activityCount > 0;
              const goToDay = () => {
                if (activityCount === 1) setLocation(`/activities/${d.activityIds[0]}`);
                else if (activityCount > 1) setLocation(`/activities?date=${dateStr}`);
              };
              return (
                <div
                  key={d.date}
                  onClick={clickable ? goToDay : undefined}
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            goToDay();
                          }
                        }
                      : undefined
                  }
                  role={clickable ? "button" : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  title={
                    `${dateStr}: intensity ${d.score}/100` +
                    (clickable
                      ? ` · ${activityCount} ${activityCount === 1 ? "activity" : "activities"} · click to view`
                      : "")
                  }
                  className={`relative aspect-square rounded-lg p-1 ${
                    isFuture ? "bg-secondary/30 border border-dashed border-border/60" : INTENSITY_CLASSES[d.intensity]
                  } ${isToday ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : ""} ${
                    clickable
                      ? "cursor-pointer hover:ring-2 hover:ring-primary/70 hover:ring-offset-1 hover:ring-offset-card transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                  {activityCount > 1 && (
                    <span
                      className={`absolute bottom-1 left-1 flex items-center gap-0.5 text-[8px] font-bold leading-none ${
                        brightText ? "text-white/80" : "text-muted-foreground/70"
                      }`}
                    >
                      <span className="w-1 h-1 rounded-full bg-current" />
                      {activityCount}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 text-center">
            <Activity className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {isFetching ? "Loading…" : "No training data for this month yet."}
            </p>
          </div>
        )}
      </div>

      {/* How the score works */}
      <div className={`${CARD} p-8`}>
        <h2 className="text-lg font-bold text-foreground mb-4">How the score works</h2>
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed max-w-3xl">
          <p>
            Each square is a real day, showing that day&apos;s <strong className="text-foreground">intensity score from 0 to 100</strong>.
          </p>
          <p>
            The score is your training load for the day, meaning session RPE × duration (or distance when effort isn&apos;t logged),
            scaled against the <strong className="text-foreground">hardest single day in your entire history</strong>. So a 100 is
            your all-time toughest day, and a 50 is roughly half that load. Because it&apos;s scaled across everything you&apos;ve
            ever done, scores mean the same thing from month to month.
          </p>
          <p>
            Color tracks the same score, and a run of high numbers back-to-back (stacking hard days without easy days between)
            is a common overtraining pattern.
          </p>
          <p className="flex items-center gap-1.5 text-foreground">
            <MousePointerClick className="w-4 h-4 text-primary shrink-0" />
            Click any day with a run to open that activity, or see the list when you did more than one.
          </p>
        </div>
      </div>
    </div>
  );
}
