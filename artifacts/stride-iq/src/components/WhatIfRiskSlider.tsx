import { useState, useEffect } from "react";
import { Sliders } from "lucide-react";

interface WhatIfScenario {
  deltaKm: number;
  weeklyKm: number;
  ratio: number | null;
  score: number;
  band: string;
  label: string;
}

export interface WhatIfData {
  actualWeeklyKm: number;
  hasEnoughHistory: boolean;
  scenarios: WhatIfScenario[];
}

const BAND_COLOR: Record<string, string> = {
  low: "text-emerald-600",
  moderate: "text-amber-600",
  high: "text-red-600",
  critical: "text-red-700",
};

const BAND_TRACK: Record<string, string> = {
  low: "bg-emerald-500",
  moderate: "bg-amber-500",
  high: "bg-red-500",
  critical: "bg-red-600",
};

function bandFor(score: number): { band: string; label: string } {
  if (score >= 75) return { band: "critical", label: "Critical Risk" };
  if (score >= 50) return { band: "high", label: "Elevated Risk" };
  if (score >= 25) return { band: "moderate", label: "Caution Advised" };
  return { band: "low", label: "Clear to Train" };
}

// Mirrors the server's acwrComponentFor (lib/riskIndex.ts) exactly, so demo
// mode can approximate scenarios client-side without a network call.
function acwrComponentFor(acwr: number | null): number {
  if (acwr === null) return 0;
  if (acwr > 1.3) return Math.min(100, (acwr - 1.3) * 100);
  if (acwr < 0.8) return Math.min(30, (0.8 - acwr) * 50);
  return 0;
}

const WHAT_IF_DELTA_KM = [-10, -5, 0, 5, 10, 15, 20];

/**
 * Demo-only, client-side approximation: holds the current score's non-ACWR
 * components fixed and re-derives only the ACWR-driven 25% slice for each
 * hypothetical mileage delta. Not used for the real (server-backed) simulator
 * — that gets the authoritative computation from the API.
 */
export function buildClientWhatIf(currentScore: number, acuteLoad: number, chronicWeeklyAvg: number, actualWeeklyKm: number): WhatIfData {
  const currentRatio = chronicWeeklyAvg > 0 ? acuteLoad / chronicWeeklyAvg : null;
  const currentAcwrComponent = acwrComponentFor(currentRatio);
  const loadPerKm = actualWeeklyKm > 0 ? acuteLoad / actualWeeklyKm : 10;

  const scenarios: WhatIfScenario[] = WHAT_IF_DELTA_KM.map((deltaKm) => {
    const hypotheticalAcuteLoad = Math.max(0, acuteLoad + deltaKm * loadPerKm);
    const ratio = chronicWeeklyAvg > 0 ? Math.round((hypotheticalAcuteLoad / chronicWeeklyAvg) * 100) / 100 : null;
    const acwrComponent = acwrComponentFor(ratio);
    const score = Math.round(Math.min(100, Math.max(0, currentScore + (acwrComponent - currentAcwrComponent) * 0.25)));
    const { band, label } = bandFor(score);
    return { deltaKm, weeklyKm: Math.round(Math.max(0, actualWeeklyKm + deltaKm) * 10) / 10, ratio, score, band, label };
  });

  return { actualWeeklyKm: Math.round(actualWeeklyKm * 10) / 10, hasEnoughHistory: currentRatio !== null, scenarios };
}

/**
 * "What if I ran N km more/less this week?" — a discrete slider over the
 * server-computed scenarios (same risk-scoring math as the real dashboard,
 * not a client-side approximation), so athletes and coaches can see how
 * sensitive this week's risk score is to a mileage change before making one.
 */
export function WhatIfRiskSlider({ data, loading, athleteLabel = "your" }: { data: WhatIfData | null | undefined; loading: boolean; athleteLabel?: string }) {
  const scenarios = data?.scenarios ?? [];
  const zeroIndex = scenarios.findIndex((s) => s.deltaKm === 0);
  const [index, setIndex] = useState(zeroIndex >= 0 ? zeroIndex : 0);

  useEffect(() => {
    if (zeroIndex >= 0) setIndex(zeroIndex);
  }, [zeroIndex]);

  if (loading) {
    return <div className="h-40 bg-card border border-border rounded-3xl animate-pulse" />;
  }
  if (!data || scenarios.length === 0) {
    return null;
  }
  if (!data.hasEnoughHistory) {
    return (
      <div className="premium-card rounded-3xl p-8 text-center">
        <p className="text-sm text-muted-foreground">Need about two weeks of training history before the what-if simulator can project {athleteLabel} risk score.</p>
      </div>
    );
  }

  const scenario = scenarios[index] ?? scenarios[Math.floor(scenarios.length / 2)];
  const isBaseline = scenario.deltaKm === 0;

  return (
    <div className="premium-card rounded-3xl p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Sliders className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">What-If Risk Simulator</h3>
          <p className="text-xs text-muted-foreground">Drag to see how {athleteLabel} risk score reacts to a mileage change this week.</p>
        </div>
      </div>

      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm font-semibold text-foreground">
          {isBaseline ? "This week" : scenario.deltaKm > 0 ? `+${scenario.deltaKm}km this week` : `${scenario.deltaKm}km this week`}
          <span className="text-muted-foreground font-normal"> ({scenario.weeklyKm}km total)</span>
        </span>
        <span className={`text-sm font-bold ${BAND_COLOR[scenario.band] ?? "text-foreground"}`}>
          {scenario.score}/100 · {scenario.label}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={scenarios.length - 1}
        step={1}
        value={index}
        onChange={(e) => setIndex(Number(e.target.value))}
        className="w-full accent-primary cursor-pointer"
        aria-label="Hypothetical weekly mileage change"
      />
      <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
        {scenarios.map((s) => (
          <span key={s.deltaKm} className={s.deltaKm === scenario.deltaKm ? "text-foreground" : ""}>
            {s.deltaKm > 0 ? `+${s.deltaKm}` : s.deltaKm}
          </span>
        ))}
      </div>

      <div className="mt-5 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${BAND_TRACK[scenario.band] ?? "bg-primary"}`}
          style={{ width: `${Math.min(100, scenario.score)}%` }}
        />
      </div>

      {scenario.ratio !== null && (
        <p className="text-xs text-muted-foreground mt-3">
          Projected workload ratio: <span className="font-semibold text-foreground">{scenario.ratio}</span>
          {scenario.ratio > 1.3 ? " — above the 1.3 danger threshold." : scenario.ratio < 0.8 ? " — below the 0.8 undertraining threshold." : " — within the 0.8–1.3 sweet spot."}
        </p>
      )}
    </div>
  );
}
