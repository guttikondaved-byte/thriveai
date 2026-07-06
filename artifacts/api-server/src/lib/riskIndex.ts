export type RiskBand = "low" | "moderate" | "high" | "critical";

export interface RiskIndexResult {
  score: number; // 0-100
  band: RiskBand;
  label: string;
}

const ALERT_SEVERITY_WEIGHT: Record<string, number> = {
  low: 10,
  medium: 25,
  high: 45,
  critical: 70,
};

/** The ACWR-driven slice of the risk score — pulled out so a hypothetical
 * ("what if I ran X more/less this week") scenario can be scored with the
 * exact same math as the real dashboard, instead of an approximation that
 * could drift from it. */
export function acwrComponentFor(acwr: number | null): number {
  if (acwr === null) return 0;
  if (acwr > 1.3) return Math.min(100, (acwr - 1.3) * 100);
  if (acwr < 0.8) return Math.min(30, (0.8 - acwr) * 50);
  return 0;
}

export function bandFor(score: number): { band: RiskBand; label: string } {
  if (score >= 75) return { band: "critical", label: "Critical Risk" };
  if (score >= 50) return { band: "high", label: "Elevated Risk" };
  if (score >= 25) return { band: "moderate", label: "Caution Advised" };
  return { band: "low", label: "Clear to Train" };
}

/**
 * Aggregates an athlete's current injury risk from several signals:
 * recent per-activity risk scores, acute:chronic workload ratio (ACWR),
 * open injury alerts, and self-reported soreness.
 */
export function computeRiskIndex(input: {
  recentActivityRiskScores: number[]; // 0-100 scores from assessInjuryRisk, last 7 days
  acwr: number | null;
  openAlertRiskLevels: string[]; // unacknowledged injury_alerts.riskLevel
  recentMaxSorenessScore: number | null; // 0-10, last 3 days
}): RiskIndexResult {
  const { recentActivityRiskScores, acwr, openAlertRiskLevels, recentMaxSorenessScore } = input;

  const activityComponent =
    recentActivityRiskScores.length > 0
      ? recentActivityRiskScores.reduce((sum, s) => sum + s, 0) / recentActivityRiskScores.length
      : 0;

  const acwrComponent = acwrComponentFor(acwr);

  const alertsComponent = openAlertRiskLevels.reduce(
    (max, level) => Math.max(max, ALERT_SEVERITY_WEIGHT[level] ?? 0),
    0,
  );

  const sorenessComponent = recentMaxSorenessScore !== null ? (recentMaxSorenessScore / 10) * 100 : 0;

  const score = Math.round(
    Math.min(
      100,
      Math.max(
        0,
        activityComponent * 0.45 + acwrComponent * 0.25 + alertsComponent * 0.2 + sorenessComponent * 0.1,
      ),
    ),
  );

  const { band, label } = bandFor(score);
  return { score, band, label };
}
