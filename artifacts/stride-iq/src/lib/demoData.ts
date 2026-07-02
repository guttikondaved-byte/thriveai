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
  currentPlanName: "Half Marathon Base Build — Week 6",
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
      text: "Mild tightness after a mileage increase is common — your weekly volume is up 24% this week, which is above the usual 20% guideline. I'd suggest an easy or rest day next, ice for 10–15 minutes after runs, and some quad/IT band mobility work. If the tightness turns into sharp pain or doesn't ease within 48 hours, it's worth seeing a physio.",
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
      "Your acute load is running about 18% above your recent average, driven mostly by Wednesday's long run. Keep the next couple of easy days genuinely easy — that's what will let this week's gains stick without a setback.",
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
