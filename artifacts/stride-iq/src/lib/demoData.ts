export const ACTIVITY_LABELS: Record<string, string> = {
  easy_run: "Easy Run",
  tempo_run: "Tempo",
  interval: "Interval",
  long_run: "Long Run",
  race: "Race",
};

export const DEMO_DATA = {
  name: "Jordan",
  weeklyDistanceKm: 24.5,
  weeklyRuns: 4,
  avgPaceMinPerKm: 8.2,
  trainingLoad: "moderate" as const,
  currentPlanName: "Half Marathon Base Build · Week 6",
  fitnessLevel: "Intermediate",
  primaryGoal: "Complete a half marathon",
  weeklyMileageGoal: 30,
  restingHeartRate: 52,
  hrv: 68,
  pr5k: "22:14",
  pr10k: "46:50",
  prHalf: "1:47:32",
  recentActivities: [
    { id: 1, type: "tempo_run", activityDate: "2026-06-29", distanceKm: 6.2, durationMinutes: 42, avgHeartRate: 168 },
    { id: 2, type: "easy_run", activityDate: "2026-06-27", distanceKm: 4.1, durationMinutes: 34, avgHeartRate: 148 },
    { id: 3, type: "long_run", activityDate: "2026-06-25", distanceKm: 12.8, durationMinutes: 96, avgHeartRate: 159 },
    { id: 4, type: "easy_run", activityDate: "2026-06-23", distanceKm: 3.4, durationMinutes: 29, avgHeartRate: 144 },
    { id: 5, type: "interval", activityDate: "2026-06-20", distanceKm: 5.5, durationMinutes: 38, avgHeartRate: 174 },
    { id: 6, type: "easy_run", activityDate: "2026-06-18", distanceKm: 4.8, durationMinutes: 39, avgHeartRate: 146 },
    { id: 7, type: "long_run", activityDate: "2026-06-16", distanceKm: 11.3, durationMinutes: 88, avgHeartRate: 156 },
    { id: 8, type: "easy_run", activityDate: "2026-06-13", distanceKm: 4.0, durationMinutes: 33, avgHeartRate: 149 },
  ],
  activeAlerts: [
    {
      id: 1,
      riskLevel: "medium" as const,
      bodyPart: "Right knee",
      createdAt: "2026-06-29",
      message: "Your weekly mileage increased 24% this week, above the recommended 20% threshold.",
      recommendation: "Consider an easy or rest day before your next long run, and keep an eye on any knee discomfort.",
    },
  ],
  dismissedAlerts: [
    { id: 2, bodyPart: "Left calf", riskLevel: "low" as const, createdAt: "2026-06-15" },
    { id: 3, bodyPart: "Right hip", riskLevel: "low" as const, createdAt: "2026-06-02" },
  ],
  weeklyPlan: [
    { day: "Monday", label: "Rest", detail: "Full recovery day" },
    { day: "Tuesday", label: "Easy Run", detail: "5 mi @ conversational pace" },
    { day: "Wednesday", label: "Tempo Run", detail: "4 mi @ threshold pace" },
    { day: "Thursday", label: "Easy Run", detail: "4 mi @ conversational pace" },
    { day: "Friday", label: "Rest", detail: "Full recovery day" },
    { day: "Saturday", label: "Long Run", detail: "9 mi @ easy pace" },
    { day: "Sunday", label: "Cross Training", detail: "30 min cycling or swim" },
  ],
  averaWeeklyPlanProposal: {
    name: "Half Marathon Base Build · Week 7 (Knee-Protective)",
    rationale:
      "Your weekly mileage is up 24% this week and your right knee alert is still active, so this week backs off the tempo work and keeps everything else at easy pace. The long run stays in to protect your aerobic base, but it's shorter and slower than a normal build week.",
    weeklyMileage: 22,
    sessions: [
      { day: "Monday", label: "Rest", detail: "Full recovery day" },
      { day: "Tuesday", label: "Easy Run", detail: "4 mi @ conversational pace" },
      { day: "Wednesday", label: "Cross Training", detail: "30 min low-impact cycling instead of this week's tempo" },
      { day: "Thursday", label: "Easy Run", detail: "3 mi @ conversational pace" },
      { day: "Friday", label: "Rest", detail: "Full recovery day" },
      { day: "Saturday", label: "Long Run", detail: "7 mi @ easy pace, walk breaks if the knee flares" },
      { day: "Sunday", label: "Easy Run", detail: "3 mi shakeout, stop if any sharp pain" },
    ],
  },
  weeklyHrv: [
    { day: "Mon", value: 71 },
    { day: "Tue", value: 68 },
    { day: "Wed", value: 65 },
    { day: "Thu", value: 69 },
    { day: "Fri", value: 70 },
    { day: "Sat", value: 62 },
    { day: "Sun", value: 68 },
  ],
  coachConversation: [
    { role: "user" as const, text: "My right knee has felt a little tight after my last two runs. Should I be worried?" },
    {
      role: "assistant" as const,
      text: "Mild tightness after a mileage increase is common. Your weekly volume is up 24% this week, which is above the usual 20% guideline. I'd suggest an easy or rest day next, ice for 10–15 minutes after runs, and some quad/IT band mobility work. If the tightness turns into sharp pain or doesn't ease within 48 hours, it's worth seeing a physio.",
    },
    { role: "user" as const, text: "Got it. Should I still do my long run this Saturday?" },
    {
      role: "assistant" as const,
      text: "I'd keep it, but drop the pace to fully conversational and cut the distance by about 20% if the knee still feels off on Thursday. Listening to how it feels day-to-day matters more than sticking rigidly to the plan.",
    },
  ],
  team: {
    coachName: "Coach Alicia Chen",
    teamName: "Riverside Running Club",
    teammates: [
      { name: "Sam R.", weeklyMiles: 28 },
      { name: "Priya N.", weeklyMiles: 19 },
      { name: "Marcus T.", weeklyMiles: 33 },
    ],
  },
  riskDashboard: {
    riskScore: 34,
    riskBand: "moderate" as "low" | "moderate" | "high" | "critical",
    riskLabel: "Moderate Risk",
    lastUpdated: "2026-06-29T18:20:00Z",
    workload: {
      ratio: 1.18,
      daily: [
        { date: "2026-06-23", day: "Mon", load: 0, baseline: 210 },
        { date: "2026-06-24", day: "Tue", load: 260, baseline: 230 },
        { date: "2026-06-25", day: "Wed", load: 610, baseline: 260 },
        { date: "2026-06-26", day: "Thu", load: 0, baseline: 200 },
        { date: "2026-06-27", day: "Fri", load: 300, baseline: 220 },
        { date: "2026-06-28", day: "Sat", load: 0, baseline: 240 },
        { date: "2026-06-29", day: "Sun", load: 420, baseline: 250 },
      ],
    },
    fitnessTrend: {
      series: [58, 61, 60, 64, 66, 65, 68, 70, 69, 72, 74, 73, 76, 78, 77, 79, 81, 80, 82, 84, 83, 85, 87, 86, 88, 90, 89, 91, 93, 95],
      changePct: 12,
    },
    weeklyRelativeEffort: { total: 268, band: "moderate" as const },
    activityConsistency: { daysActive: 4, totalDays: 7, pct: 57 },
    insight:
      "Your acute load is running about 18% above your recent average, driven mostly by Wednesday's long run. Keep the next couple of easy days genuinely easy. That's what will let this week's gains stick without a setback.",
    heartRateZones: [
      { zone: 1, label: "Recovery", seconds: 1380 },
      { zone: 2, label: "Aerobic", seconds: 5220 },
      { zone: 3, label: "Tempo", seconds: 2640 },
      { zone: 4, label: "Threshold", seconds: 1080 },
      { zone: 5, label: "Anaerobic", seconds: 240 },
    ],
    segments: [
      { name: "1K", currentTimeSeconds: 224, prTimeSeconds: 218, isPr: false },
      { name: "1 Mile", currentTimeSeconds: 372, prTimeSeconds: 360, isPr: false },
      { name: "5K", currentTimeSeconds: 1334, prTimeSeconds: 1334, isPr: true },
    ],
    soreness: [
      { bodyPart: "Right knee", painScore: 4 },
      { bodyPart: "Left calf", painScore: 1 },
    ],
  },
};

// Generates a fake but stable month of intensity-map data — deterministic per
// day-of-month so the calendar doesn't jump around between renders.
export function generateDemoIntensityMonth(year: number, month: number, isCurrentMonth: boolean) {
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const isFuture = isCurrentMonth && dateStr > todayStr;

    // Deterministic pseudo-random pattern: long runs every ~6 days, rest every ~3rd day.
    const cycle = day % 7;
    let score = 0;
    if (!isFuture) {
      if (cycle === 0) score = 78 + (day % 15);
      else if (cycle === 3 || cycle === 5) score = 0;
      else score = 20 + ((day * 13) % 45);
      score = Math.min(100, score);
    }
    const intensity = score === 0 ? 0 : score < 25 ? 1 : score < 50 ? 2 : score < 75 ? 3 : 4;
    const activityIds = score > 0 ? [day] : [];

    return { date: dateStr, score, intensity, activityIds };
  });
}

// ── Coach-side demo fixture ─────────────────────────────────────────────
export const DEMO_COACH_DATA = {
  coachName: "Taylor",
  focus: "Cross Country",
  team: {
    id: 1,
    name: "Riverside Running Club",
    inviteCode: "RUN-4C82",
    createdAt: "2026-03-01",
  },
  roster: [
    {
      userId: "1",
      name: "Jordan P.",
      email: "jordan@example.com",
      primaryGoal: "Complete a half marathon",
      fitnessLevel: "intermediate",
      restingHeartRate: 52,
      hrv: 68,
      weeklyDistanceKm: 24.5,
      weeklyWorkouts: 4,
      riskLevel: "medium" as const,
    },
    {
      userId: "2",
      name: "Sam R.",
      email: "sam@example.com",
      primaryGoal: "Break 20 min in 5K",
      fitnessLevel: "advanced",
      restingHeartRate: 48,
      hrv: 74,
      weeklyDistanceKm: 45.1,
      weeklyWorkouts: 6,
      riskLevel: "low" as const,
    },
    {
      userId: "3",
      name: "Priya N.",
      email: "priya@example.com",
      primaryGoal: "Build base mileage",
      fitnessLevel: "beginner",
      restingHeartRate: 61,
      hrv: 58,
      weeklyDistanceKm: 12.2,
      weeklyWorkouts: 3,
      riskLevel: "low" as const,
    },
    {
      userId: "4",
      name: "Marcus T.",
      email: "marcus@example.com",
      primaryGoal: "Run a full marathon",
      fitnessLevel: "advanced",
      restingHeartRate: 50,
      hrv: 51,
      weeklyDistanceKm: 53.2,
      weeklyWorkouts: 7,
      riskLevel: "high" as const,
    },
    {
      userId: "5",
      name: "Ava L.",
      email: "ava@example.com",
      primaryGoal: "Stay injury-free",
      fitnessLevel: "intermediate",
      restingHeartRate: 55,
      hrv: 65,
      weeklyDistanceKm: 20.8,
      weeklyWorkouts: 4,
      riskLevel: "low" as const,
    },
  ],
  plans: [
    { id: 1, athleteName: "Jordan P.", name: "Half Marathon Base Build", goal: "Complete a half marathon", status: "active" as const, weeklyMileage: 30 },
    { id: 2, athleteName: "Sam R.", name: "5K Speed Cycle", goal: "Break 20 min in 5K", status: "active" as const, weeklyMileage: 42 },
    { id: 3, athleteName: "Marcus T.", name: "Marathon Peak Phase", goal: "Run a full marathon", status: "active" as const, weeklyMileage: 55 },
    { id: 4, athleteName: "Priya N.", name: "Beginner Base Miles", goal: "Build base mileage", status: "paused" as const, weeklyMileage: 15 },
  ],
  coachConversation: [
    { role: "user" as const, text: "Marcus is showing high injury risk this week. What should I have him do?" },
    {
      role: "assistant" as const,
      text: "Marcus's weekly mileage jumped to 53 mi, well above his recent average, and his HRV has dropped to 51ms (down from a baseline near 65). I'd recommend cutting his next two sessions to easy pace only, dropping volume by about 25% this week, and checking in on sleep and soreness before ramping back up.",
    },
  ],
  averaPlanProposal: {
    athleteUserId: "4",
    athleteName: "Marcus T.",
    name: "Marathon Recovery & Rebuild",
    goal: "Run a full marathon",
    startDate: "2026-07-06",
    endDate: "2026-07-27",
    weeklyMileage: 40,
    rationale:
      "Marcus's mileage spiked 24% above his baseline this week and his HRV has dropped, both early signs of overreaching. This 3-week block deliberately backs off volume by about 25% and shifts most sessions to easy pace, so he arrives at the next build phase recovered instead of digging a deeper hole.",
    sessions: [
      { weekNumber: 1, dayOfWeek: 1, sessionType: "rest", description: "Full recovery day", distanceMiles: 0, durationMinutes: 0 },
      { weekNumber: 1, dayOfWeek: 2, sessionType: "easy_run", description: "Easy, conversational pace", distanceMiles: 5, durationMinutes: 42 },
      { weekNumber: 1, dayOfWeek: 3, sessionType: "cross_training", description: "Low-impact cycling or swim", distanceMiles: 0, durationMinutes: 30 },
      { weekNumber: 1, dayOfWeek: 4, sessionType: "easy_run", description: "Easy, conversational pace", distanceMiles: 5, durationMinutes: 42 },
      { weekNumber: 1, dayOfWeek: 5, sessionType: "rest", description: "Full recovery day", distanceMiles: 0, durationMinutes: 0 },
      { weekNumber: 1, dayOfWeek: 6, sessionType: "long_run", description: "Long run at easy pace only, no tempo", distanceMiles: 10, durationMinutes: 85 },
      { weekNumber: 1, dayOfWeek: 7, sessionType: "easy_run", description: "Very easy shakeout", distanceMiles: 4, durationMinutes: 34 },
    ],
  },
};

// ── Coach-side per-athlete detail fixture ───────────────────────────────
import type { AthleteDetail, AthleteActivity } from "@/pages/coach-athlete";

const DEMO_ATHLETE_EXTRAS: Record<string, {
  joinedAt: string;
  age: number;
  weeklyMileageGoal: number;
  paceMinPerMi: number;
  pr5k: string | null;
  pr10k: string | null;
  prHalf: string | null;
  prMarathon: string | null;
  healthNotes: string | null;
  trendFactors: number[]; // 8 weeks, oldest → current, multiplier on this week's mileage
  alerts: AthleteDetail["alerts"];
}> = {
  "1": {
    joinedAt: "2026-03-04", age: 24, weeklyMileageGoal: 28, paceMinPerMi: 9.2,
    pr5k: "22:41", pr10k: "47:30", prHalf: "1:52:10", prMarathon: null, healthNotes: null,
    trendFactors: [0.65, 0.72, 0.8, 0.78, 0.85, 0.9, 0.95, 1],
    alerts: [{
      id: 1, riskLevel: "medium", bodyPart: "shin",
      message: "Reported mild shin soreness after two consecutive hard sessions.",
      recommendation: "Swap tomorrow's tempo for an easy run and monitor soreness for 48 hours.",
      createdAt: "2026-07-01T14:00:00Z",
    }],
  },
  "2": {
    joinedAt: "2026-03-02", age: 29, weeklyMileageGoal: 45, paceMinPerMi: 7.4,
    pr5k: "20:11", pr10k: "42:05", prHalf: "1:35:20", prMarathon: null, healthNotes: null,
    trendFactors: [0.82, 0.85, 0.88, 0.9, 0.92, 0.95, 0.93, 1],
    alerts: [],
  },
  "3": {
    joinedAt: "2026-03-15", age: 21, weeklyMileageGoal: 15, paceMinPerMi: 11.3,
    pr5k: "31:12", pr10k: null, prHalf: null, prMarathon: null, healthNotes: null,
    trendFactors: [0.4, 0.5, 0.6, 0.65, 0.75, 0.8, 0.9, 1],
    alerts: [],
  },
  "4": {
    joinedAt: "2026-03-02", age: 34, weeklyMileageGoal: 48, paceMinPerMi: 8.1,
    pr5k: "20:45", pr10k: "43:20", prHalf: "1:38:05", prMarathon: "3:29:44",
    healthNotes: "History of Achilles tightness. Watch sharp mileage increases.",
    trendFactors: [0.75, 0.8, 0.78, 0.82, 0.85, 0.8, 0.82, 1],
    alerts: [
      {
        id: 2, riskLevel: "high", bodyPart: "general",
        message: "Weekly mileage jumped 24% above baseline while HRV dropped from 65 to 51 ms.",
        recommendation: "Cut volume ~25% this week and keep all sessions at easy pace; reassess in 5 days.",
        createdAt: "2026-07-02T09:00:00Z",
      },
      {
        id: 3, riskLevel: "medium", bodyPart: "achilles",
        message: "Elevated load on a previously flagged Achilles issue.",
        recommendation: "Add eccentric calf raises and avoid hill repeats until symptoms clear.",
        createdAt: "2026-06-30T16:30:00Z",
      },
    ],
  },
  "5": {
    joinedAt: "2026-03-20", age: 27, weeklyMileageGoal: 22, paceMinPerMi: 9.8,
    pr5k: "24:30", pr10k: "51:40", prHalf: "2:05:00", prMarathon: null, healthNotes: null,
    trendFactors: [0.7, 0.75, 0.85, 0.8, 0.9, 0.85, 0.95, 1],
    alerts: [],
  },
};

const DEMO_ACTIVITY_CYCLE = ["easy_run", "tempo_run", "easy_run", "long_run", "interval", "easy_run", "easy_run"];

export function getDemoAthleteDetail(userId: string): AthleteDetail | null {
  const member = DEMO_COACH_DATA.roster.find(m => m.userId === userId);
  const extras = DEMO_ATHLETE_EXTRAS[userId];
  if (!member || !extras) return null;

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const weeklyTrend = extras.trendFactors.map((f, i) => {
    const start = new Date(weekStart);
    start.setDate(start.getDate() - (extras.trendFactors.length - 1 - i) * 7);
    return {
      weekStart: start.toISOString().slice(0, 10),
      distanceKm: Math.round(member.weeklyDistanceKm * f * 10) / 10,
      workouts: Math.max(1, Math.round(member.weeklyWorkouts * f)),
    };
  });

  // Generate ~4 weeks of individual activities from the trend
  const recentActivities: AthleteActivity[] = [];
  let id = 1;
  for (let w = weeklyTrend.length - 1; w >= weeklyTrend.length - 4 && w >= 0; w--) {
    const week = weeklyTrend[w];
    const gap = 7 / (week.workouts + 1);
    for (let i = 0; i < week.workouts; i++) {
      const date = new Date(week.weekStart + "T00:00:00");
      date.setDate(date.getDate() + Math.round((i + 1) * gap));
      if (date > today) continue;
      const type = DEMO_ACTIVITY_CYCLE[(w + i) % DEMO_ACTIVITY_CYCLE.length];
      const share = type === "long_run" ? 1.8 : type === "easy_run" ? 0.9 : 1;
      const distance = Math.round((week.distanceKm / week.workouts) * share * 10) / 10;
      const paceAdj = type === "long_run" ? 1.08 : type === "easy_run" ? 1.12 : 0.92;
      const minutes = Math.round(distance * extras.paceMinPerMi * paceAdj);
      const hardness = type === "interval" ? 24 : type === "tempo_run" ? 18 : type === "long_run" ? 10 : 0;
      recentActivities.push({
        id: id++,
        type,
        distanceKm: distance,
        durationMinutes: minutes,
        avgHeartRate: 142 + hardness + ((w + i) % 4),
        maxHeartRate: 160 + hardness + ((w + i) % 6),
        perceivedEffort: type === "interval" ? 8 : type === "tempo_run" ? 7 : type === "long_run" ? 6 : 4,
        activityDate: date.toISOString().slice(0, 10),
        elevationGainM: 20 + ((w * 7 + i * 13) % 70),
        avgSpeed: null,
        movingTimeSeconds: minutes * 60,
        calories: Math.round(distance * 95),
        sufferScore: 15 + hardness + ((w + i) % 10) * 2,
        notes: null,
        description: null,
      });
    }
  }
  recentActivities.sort((a, b) => b.activityDate.localeCompare(a.activityDate));

  const intensityMonthLabel = today.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const intensityMap = generateDemoIntensityMonth(today.getFullYear(), today.getMonth() + 1, true);

  return {
    userId: member.userId,
    name: member.name,
    email: member.email,
    joinedAt: extras.joinedAt,
    profile: {
      age: extras.age,
      fitnessLevel: member.fitnessLevel,
      primaryGoal: member.primaryGoal,
      weeklyMileageGoal: extras.weeklyMileageGoal,
      restingHeartRate: member.restingHeartRate,
      hrv: member.hrv,
      pr5k: extras.pr5k,
      pr10k: extras.pr10k,
      prHalf: extras.prHalf,
      prMarathon: extras.prMarathon,
      healthNotes: extras.healthNotes,
    },
    weeklyDistanceKm: member.weeklyDistanceKm,
    weeklyWorkouts: member.weeklyWorkouts,
    totalActivities: recentActivities.length + 38,
    totalDistanceKm: Math.round(member.weeklyDistanceKm * 14),
    weeklyTrend,
    intensityMap,
    intensityMonthLabel,
    recentActivities,
    alerts: member.riskLevel === "low" ? [] : extras.alerts,
  };
}

// ── Fake coach comments seeded onto a couple of demo alerts, so the demo
// showcases the coach-comment thread without hitting any real endpoint.
export const DEMO_ALERT_COMMENTS: Record<number, Array<{ id: number; content: string; createdAt: string }>> = {
  2: [
    { id: 1, content: "Saw this come through — let's dial back tomorrow's long run and keep it conversational pace.", createdAt: "2026-07-02T12:15:00Z" },
  ],
  3: [
    { id: 2, content: "Keep up with the eccentric calf raises daily until this clears.", createdAt: "2026-06-30T18:00:00Z" },
  ],
};

// ── Coach-side per-athlete injury-risk dashboard fixture ───────────────────
// Mirrors the shape of GET /teams/:teamId/members/:userId/injury-risk with
// plausible values derived from the roster entry's riskLevel, so the demo
// visually matches what a coach sees for a real athlete without needing a
// full second copy of the real training-load math.
export function getDemoInjuryRiskDashboard(userId: string) {
  const member = DEMO_COACH_DATA.roster.find(m => m.userId === userId);
  const extras = DEMO_ATHLETE_EXTRAS[userId];
  if (!member || !extras) return null;

  const RISK_BAND_FOR: Record<string, { score: number; band: string; label: string }> = {
    low: { score: 18, band: "low", label: "Low Risk" },
    medium: { score: 42, band: "moderate", label: "Moderate Risk" },
    high: { score: 68, band: "high", label: "High Risk" },
  };
  const riskInfo = RISK_BAND_FOR[member.riskLevel] ?? RISK_BAND_FOR.low;

  const insight = member.riskLevel === "high"
    ? `${member.name.split(" ")[0]}'s workload ratio is elevated and HRV has dropped from baseline. Recommend cutting volume ~25% this week and keeping sessions at easy pace.`
    : member.riskLevel === "medium"
    ? `${member.name.split(" ")[0]} is showing a few early risk signals. Worth a check-in before their next hard session.`
    : `${member.name.split(" ")[0]}'s training load and recovery markers look balanced.`;

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  const dailyBase = member.weeklyDistanceKm * 10; // rough session-load scale
  const daily = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    const cycle = i % 3;
    const load = cycle === 1 ? 0 : Math.round(dailyBase * (0.5 + ((i * 13) % 40) / 100));
    return { date: d.toISOString().slice(0, 10), day: dayLabels[d.getDay()], load, baseline: Math.round(dailyBase * 0.65) };
  });
  const ratio = member.riskLevel === "high" ? 1.42 : member.riskLevel === "medium" ? 1.15 : 0.92;

  const effortTotal = member.riskLevel === "high" ? 420 : member.riskLevel === "medium" ? 260 : 140;
  const effortBand = effortTotal >= 350 ? "high" : effortTotal >= 150 ? "moderate" : "low";

  const trendSeries = Array.from({ length: 30 }, (_, i) => Math.round(dailyBase * (0.6 + (Math.sin(i / 4) + 1) * 0.2)));
  const trendPct = member.riskLevel === "high" ? -8 : member.riskLevel === "medium" ? 3 : 6;

  const hrMax = 220 - extras.age;
  const heartRateZones = [1, 2, 3, 4, 5].map(zone => {
    const share = member.riskLevel === "high" ? [0.15, 0.2, 0.25, 0.25, 0.15] : [0.3, 0.3, 0.2, 0.15, 0.05];
    return { zone, label: ["Recovery", "Aerobic", "Tempo", "Threshold", "Anaerobic"][zone - 1], seconds: Math.round(share[zone - 1] * 3600 * (member.weeklyWorkouts / 4)) };
  });

  const soreness = extras.alerts.map((a, i) => ({
    bodyPart: a.bodyPart,
    painScore: a.riskLevel === "high" ? 7 : a.riskLevel === "medium" ? 4 : 2,
    createdAt: a.createdAt,
  }));

  return {
    riskScore: riskInfo.score,
    riskBand: riskInfo.band,
    riskLabel: riskInfo.label,
    insight,
    lastUpdated: new Date().toISOString(),
    workload: { daily, ratio },
    intensityMap: [],
    weeklyRelativeEffort: { total: effortTotal, band: effortBand },
    activityConsistency: { daysActive: member.weeklyWorkouts, totalDays: 7, pct: Math.round((member.weeklyWorkouts / 7) * 100) },
    fitnessTrend: { series: trendSeries, changePct: trendPct },
    heartRateZones,
    segments: [],
    alerts: member.riskLevel === "low" ? [] : extras.alerts,
    soreness,
  };
}

// ── System prompts for the demo's real-LLM chat ─────────────────────────────
// The demo has no backend/DB, so instead of the server building context from
// real rows (like buildCoachContext in the api-server), these build the same
// kind of context client-side from the static fixture and send it as the
// system prompt to POST /api/demo/chat — that endpoint just relays it to the
// real model, so the demo answers with genuine understanding instead of a
// keyword match, without needing a login or real team/athlete data.

export function buildDemoCoachSystemPrompt(): string {
  const { team, roster, plans } = DEMO_COACH_DATA;
  const lines: string[] = [
    "You are AveraAI, an AI assistant for a running coach, answering inside a no-login product demo. Be specific and grounded in the roster data below — never invent athletes, numbers, or plans that aren't listed. Keep replies concise (2-4 sentences unless asked for detail).",
    "",
    `Team: "${team.name}" — ${roster.length} athletes.`,
    "",
    "Roster:",
  ];
  for (const m of roster) {
    const detail = getDemoAthleteDetail(m.userId);
    const alertStr = detail?.alerts.length
      ? detail.alerts.map(a => `${a.riskLevel} risk ${a.bodyPart} (${a.recommendation})`).join("; ")
      : "no active alerts";
    lines.push(
      `- ${m.name} | ${m.fitnessLevel} | goal: ${m.primaryGoal} | ${m.weeklyDistanceKm}km/${m.weeklyWorkouts} sessions this week | HRV ${m.hrv}ms, resting HR ${m.restingHeartRate}bpm | risk: ${m.riskLevel} | alerts: ${alertStr}`,
    );
  }
  lines.push("", "Active plans:");
  for (const p of plans) {
    lines.push(`- ${p.athleteName}: "${p.name}" (${p.goal}), ${p.weeklyMileage}mi/wk, status: ${p.status}`);
  }
  lines.push(
    "",
    "This is a read-only conversation — do not claim to have sent a message, left a note, or changed a plan; those actions are handled separately in this demo, not by you answering here.",
  );
  return lines.join("\n");
}

export function buildDemoAthleteSystemPrompt(): string {
  const d = DEMO_DATA;
  const alert = d.activeAlerts[0];
  return [
    `You are AveraAI, ${d.name}'s AI running coach, answering inside a no-login product demo. Be specific and grounded in the data below — never invent numbers, alerts, or plans that aren't listed. Keep replies concise (2-4 sentences unless asked for detail).`,
    "",
    `Athlete: ${d.name} | ${d.fitnessLevel} | goal: ${d.primaryGoal}`,
    `This week: ${d.weeklyDistanceKm}km across ${d.weeklyRuns} runs, goal ${d.weeklyMileageGoal}km. Workload ratio: ${d.riskDashboard.workload.ratio}.`,
    `HRV: ${d.hrv}ms | resting HR: ${d.restingHeartRate}bpm`,
    `PRs: 5K ${d.pr5k}, 10K ${d.pr10k}, half ${d.prHalf}`,
    `Current plan: ${d.currentPlanName}`,
    alert ? `Active alert: ${alert.bodyPart}, ${alert.riskLevel} risk — ${alert.message} ${alert.recommendation}` : "No active alerts.",
    "",
    "This is a read-only conversation — do not claim to have changed a plan or taken any action; that isn't something you do in this demo.",
  ].join("\n");
}
