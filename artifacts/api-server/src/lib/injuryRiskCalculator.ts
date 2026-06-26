import { Activity, AthleteProfile } from "@workspace/db";

export interface RiskFactor {
  factor: string;
  severity: "low" | "medium" | "high";
  value: string;
  explanation: string;
}

export interface InjuryRiskAssessment {
  riskLevel: "low" | "medium" | "high" | "critical";
  riskScore: number; // 0-100
  primaryBodyParts: string[];
  riskFactors: RiskFactor[];
  message: string;
  recommendation: string;
}

/**
 * Calculate max heart rate using the Karvonen formula
 * Default to 220 - age if age not available
 */
function estimateMaxHeartRate(age: number | null | undefined, maxHRFromActivity?: number | null): number {
  if (maxHRFromActivity && maxHRFromActivity > 150) {
    return maxHRFromActivity;
  }
  if (age && age > 0) {
    return 220 - age;
  }
  return 200; // Conservative default
}

/**
 * Calculate heart rate reserve (for training zones)
 */
function calculateHeartRateReserve(maxHR: number, restingHR: number | null | undefined): number {
  const rhr = restingHR || 60; // Default resting HR
  return maxHR - rhr;
}

/**
 * Assess effort-to-pace mismatch (high HR at slow pace indicates fatigue/struggle)
 */
function assessEffortPaceMismatch(
  avgHR: number | null | undefined,
  maxHR: number,
  durationMinutes: number | null | undefined,
  distanceKm: number | null | undefined,
  rpe: number | null | undefined,
): RiskFactor | null {
  if (!avgHR || !durationMinutes || !distanceKm || distanceKm === 0) return null;

  // Calculate pace (min/km)
  const paceMinPerKm = durationMinutes / distanceKm;

  // Calculate HR as % of max
  const hrPercent = (avgHR / maxHR) * 100;

  // Easy pace should be 70-80% of max HR
  // If doing easy pace (> 6:00 min/km) but HR is very high (> 85%), that's a mismatch
  if (paceMinPerKm > 6.0 && hrPercent > 85) {
    const value = `${avgHR} bpm avg (${hrPercent.toFixed(0)}% of max) at ${paceMinPerKm.toFixed(1)} min/km pace`;
    return {
      factor: "Effort-Pace Mismatch",
      severity: "high",
      value,
      explanation:
        "Your heart rate is very high for the pace you're running. This suggests fatigue, overexertion, or cardiovascular stress. You may be recovering poorly or pushing too hard on what should be easy effort.",
    };
  }

  // If doing tempo/threshold pace (5:00-6:00 min/km) with extremely high HR and high RPE
  if (paceMinPerKm > 5.0 && paceMinPerKm <= 6.0 && hrPercent > 90 && (rpe ?? 0) >= 8) {
    const value = `${avgHR} bpm (${hrPercent.toFixed(0)}% max) at ${paceMinPerKm.toFixed(1)} min/km with RPE ${rpe}`;
    return {
      factor: "Extreme Effort-Pace Mismatch",
      severity: "high",
      value,
      explanation: "You're exerting yourself intensely for a moderate pace. This indicates potential overtraining or inadequate recovery.",
    };
  }

  return null;
}

/**
 * Assess RPE-HR correlation issues
 */
function assessRPEHeartRateIssues(
  rpe: number | null | undefined,
  avgHR: number | null | undefined,
  maxHR: number,
): RiskFactor | null {
  if (!rpe || !avgHR) return null;

  const hrPercent = (avgHR / maxHR) * 100;

  // Very high RPE (9-10) with extremely high HR
  if (rpe >= 9 && hrPercent >= 90) {
    const value = `RPE ${rpe}/10 with avg HR ${avgHR} bpm (${hrPercent.toFixed(0)}% max)`;
    return {
      factor: "Extreme Effort & High Heart Rate",
      severity: "high",
      value,
      explanation:
        "You reported maximum or near-maximum effort with very elevated heart rate. This level of exertion, especially combined with high HR, significantly increases injury risk from overtraining.",
    };
  }

  // High RPE (8-9) with sustained high HR
  if (rpe >= 8 && hrPercent >= 85) {
    const value = `RPE ${rpe}/10 with sustained high HR (${hrPercent.toFixed(0)}% max)`;
    return {
      factor: "High Effort with Elevated Heart Rate",
      severity: "medium",
      value,
      explanation: "High perceived effort combined with elevated heart rate. Monitor recovery carefully after workouts at this intensity.",
    };
  }

  return null;
}

/**
 * Assess rapid mileage increase
 */
function assessMileageSpike(currentKm: number, previousWeekKm: number | null): RiskFactor | null {
  if (!previousWeekKm || previousWeekKm === 0) return null;

  const percentIncrease = ((currentKm - previousWeekKm) / previousWeekKm) * 100;

  // Running rules: don't increase > 10% per week
  if (percentIncrease > 30) {
    const value = `${currentKm.toFixed(1)} km (${percentIncrease.toFixed(0)}% increase from ${previousWeekKm.toFixed(1)} km last week)`;
    return {
      factor: "Severe Mileage Spike",
      severity: "high",
      value,
      explanation:
        "You've increased your weekly mileage by more than 30% in one week. This violates the '10% rule' and significantly increases injury risk. Gradually build mileage over 2-3 weeks.",
    };
  }

  // 20-30% increase is still risky
  if (percentIncrease > 20) {
    const value = `${currentKm.toFixed(1)} km (${percentIncrease.toFixed(0)}% increase from ${previousWeekKm.toFixed(1)} km last week)`;
    return {
      factor: "Significant Mileage Spike",
      severity: "medium",
      value,
      explanation: "You've increased mileage by over 20% this week. While not as severe as 30%+, this is still above the safe 10% threshold.",
    };
  }

  return null;
}

/**
 * Assess duration of high-intensity effort
 */
function assessDurationStress(
  durationMinutes: number | null | undefined,
  avgHR: number | null | undefined,
  maxHR: number,
  rpe: number | null | undefined,
): RiskFactor | null {
  if (!durationMinutes || !avgHR) return null;

  const hrPercent = (avgHR / maxHR) * 100;

  // > 90 minutes at > 85% HR is excessive
  if (durationMinutes > 90 && hrPercent > 85) {
    const value = `${durationMinutes} min at ${hrPercent.toFixed(0)}% max HR`;
    return {
      factor: "Prolonged High-Intensity Effort",
      severity: "high",
      value,
      explanation: `Extended effort at elevated heart rate (${durationMinutes} minutes) can deplete glycogen and elevate injury risk. Ensure adequate recovery.`,
    };
  }

  // > 60 minutes at > 90% HR is risky
  if (durationMinutes > 60 && hrPercent > 90) {
    const value = `${durationMinutes} min at ${hrPercent.toFixed(0)}% max HR (high intensity)`;
    return {
      factor: "Long High-Intensity Workout",
      severity: "medium",
      value,
      explanation: "Extended high-intensity effort requires significant recovery. Take easy/rest days to follow.",
    };
  }

  return null;
}

/**
 * Parse notes for subjective pain/overexertion indicators
 */
function assessSubjectiveWarnings(notes: string | null | undefined): RiskFactor | null {
  if (!notes) return null;

  const lowerNotes = notes.toLowerCase();

  // Death-related comments indicate severe distress
  const deathPhrases = ["dying", "dead", "going to die", "death"];
  if (deathPhrases.some((phrase) => lowerNotes.includes(phrase))) {
    return {
      factor: "Subjective Overexertion",
      severity: "high",
      value: `Notes: "${notes}"`,
      explanation:
        "Your subjective description ('dying', 'dead', etc.) indicates severe distress during the activity. This suggests extreme fatigue or cardiovascular stress requiring immediate recovery.",
    };
  }

  // Pain indicators
  const painPhrases = ["pain", "ache", "sore", "hurt", "injured", "tear", "strain", "sharp"];
  if (painPhrases.some((phrase) => lowerNotes.includes(phrase))) {
    return {
      factor: "Reported Pain or Discomfort",
      severity: "high",
      value: `Notes: "${notes}"`,
      explanation: "You reported pain or discomfort during this activity. Stop doing high-impact work and assess the injury before training again.",
    };
  }

  // Fatigue indicators
  const fatiguePhrase = [
    "exhausted",
    "shattered",
    "wrecked",
    "gassed",
    "completely tired",
    "no energy",
    "struggled",
    "couldn't",
    "drained",
  ];
  if (fatiguePhrase.some((phrase) => lowerNotes.includes(phrase))) {
    return {
      factor: "Extreme Fatigue",
      severity: "medium",
      value: `Notes: "${notes}"`,
      explanation: "You reported extreme fatigue. This may indicate insufficient recovery, poor sleep, or overtraining. Reduce intensity or take a rest day.",
    };
  }

  return null;
}

/**
 * Main injury risk calculation function
 */
export async function assessInjuryRisk(
  activity: Activity,
  athleteProfile: AthleteProfile | null,
  previousWeekDistanceKm: number,
  recentActivities: Activity[], // Last 7 days of activities
): Promise<InjuryRiskAssessment> {
  const riskFactors: RiskFactor[] = [];
  let riskScore = 0;

  const maxHR = estimateMaxHeartRate(athleteProfile?.age, activity.maxHeartRate);
  const avgHR = activity.avgHeartRate || null;
  const rpe = activity.perceivedEffort || null;
  const distanceKm = activity.distanceKm ? Number(activity.distanceKm) : null;
  const durationMinutes = activity.durationMinutes || null;

  // ── Check effort-to-pace mismatch ──
  if (avgHR && distanceKm && durationMinutes) {
    const effortMismatch = assessEffortPaceMismatch(avgHR, maxHR, durationMinutes, distanceKm, rpe);
    if (effortMismatch) {
      riskFactors.push(effortMismatch);
      riskScore += effortMismatch.severity === "high" ? 30 : 15;
    }
  }

  // ── Check RPE & Heart Rate correlation ──
  if (avgHR && rpe) {
    const rpeHRIssue = assessRPEHeartRateIssues(rpe, avgHR, maxHR);
    if (rpeHRIssue) {
      riskFactors.push(rpeHRIssue);
      riskScore += rpeHRIssue.severity === "high" ? 35 : 20;
    }
  }

  // ── Check mileage spike ──
  if (distanceKm) {
    const mileageSpike = assessMileageSpike(distanceKm, previousWeekDistanceKm);
    if (mileageSpike) {
      riskFactors.push(mileageSpike);
      riskScore += mileageSpike.severity === "high" ? 30 : 15;
    }
  }

  // ── Check duration stress ──
  if (durationMinutes && avgHR) {
    const durationStress = assessDurationStress(durationMinutes, avgHR, maxHR, rpe);
    if (durationStress) {
      riskFactors.push(durationStress);
      riskScore += durationStress.severity === "high" ? 25 : 15;
    }
  }

  // ── Check subjective warnings ──
  const subjectiveWarning = assessSubjectiveWarnings(activity.notes);
  if (subjectiveWarning) {
    riskFactors.push(subjectiveWarning);
    riskScore += subjectiveWarning.severity === "high" ? 40 : 20;
  }

  // ── Determine risk level and affected body parts ──
  let riskLevel: "low" | "medium" | "high" | "critical" = "low";
  let primaryBodyParts: string[] = [];

  // High RPE or very high HR consistently stresses lower body
  if ((rpe && rpe >= 9) || (avgHR && avgHR / maxHR > 0.95)) {
    primaryBodyParts.push("lower legs", "knees", "hips");
  }

  // Long duration stresses feet, ankles, knees
  if (durationMinutes && durationMinutes > 90) {
    if (!primaryBodyParts.includes("feet")) primaryBodyParts.push("feet", "ankles");
    if (!primaryBodyParts.includes("knees")) primaryBodyParts.push("knees");
  }

  // Determine overall risk level based on score and factor severity
  if (riskScore >= 75 || riskFactors.some((f) => f.severity === "high" && riskFactors.length >= 2)) {
    riskLevel = "critical";
  } else if (riskScore >= 50 || riskFactors.some((f) => f.severity === "high")) {
    riskLevel = "high";
  } else if (riskScore >= 25 || riskFactors.some((f) => f.severity === "medium")) {
    riskLevel = "medium";
  }

  // Cap score at 100
  riskScore = Math.min(riskScore, 100);

  // ── Generate message and recommendation ──
  let message = "";
  let recommendation = "";

  if (riskLevel === "critical") {
    primaryBodyParts = primaryBodyParts.length > 0 ? primaryBodyParts : ["overall"];
    message = `CRITICAL RISK: Multiple severe risk factors detected. ${primaryBodyParts.join(", ")} are at high injury risk.`;
    recommendation = `IMMEDIATE ACTION: Take 1-2 days of complete rest or very easy cross-training. Ice any sore areas. Do NOT repeat this workout intensity. Reassess training plan with coach.`;
  } else if (riskLevel === "high") {
    primaryBodyParts = primaryBodyParts.length > 0 ? primaryBodyParts : ["overall"];
    message = `High injury risk detected in ${primaryBodyParts.join(", ")}. Significant overtraining indicators present.`;
    recommendation = `Follow with easy, low-impact activity tomorrow. Increase sleep/recovery. Reduce volume or intensity for the next 3-4 days.`;
  } else if (riskLevel === "medium") {
    primaryBodyParts = primaryBodyParts.length > 0 ? primaryBodyParts : ["lower body"];
    message = `Moderate risk factors detected. ${primaryBodyParts.join(", ")} require monitoring.`;
    recommendation = `Include an easy recovery day soon. Watch for developing aches or tightness. Increase stretching and mobility work.`;
  } else {
    message = `No significant injury risk detected. Continue training within normal guidelines.`;
    recommendation = `Maintain current training load. Stay hydrated and get adequate sleep. Regular mobility work helps prevent issues.`;
  }

  return {
    riskLevel,
    riskScore,
    primaryBodyParts: primaryBodyParts.length > 0 ? primaryBodyParts : ["general"],
    riskFactors,
    message,
    recommendation,
  };
}
