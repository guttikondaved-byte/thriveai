import { Router, type Request, type IRouter } from "express";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  db,
  conversations,
  messages,
  athleteProfileTable,
  activitiesTable,
  trainingPlansTable,
  planSessionsTable,
  injuryAlertsTable,
  notificationsTable,
  teamsTable,
  teamMembershipsTable,
  teamCoachesTable,
  usersTable,
} from "@workspace/db";
import {
  CreateOpenaiConversationBody,
  GetOpenaiConversationParams,
  DeleteOpenaiConversationParams,
  ListOpenaiMessagesParams,
  SendOpenaiMessageParams,
  SendOpenaiMessageBody,
  ListOpenaiConversationsResponse,
  GetOpenaiConversationResponse,
  ListOpenaiMessagesResponse,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";
import OpenAI from "openai";

const router: IRouter = Router();

const apiKey = process.env.GLM_API_KEY;
const openaiClient = apiKey
  ? new OpenAI({ apiKey, baseURL: "https://open.bigmodel.cn/api/paas/v4/" })
  : null;

// Model is overridable via env so you can point coaching/plan generation at a
// stronger model (e.g. GLM_COACH_MODEL=glm-4.6) WITHOUT a code change — but the
// default stays on glm-4-flash, the model already proven to work on this account.
// (glm-4.6 is only served on some GLM plans; opt in via env once you've confirmed
// your key has access.) Titles always use the cheap/fast model.
const COACH_MODEL = process.env.GLM_COACH_MODEL ?? "glm-4-flash";
const TITLE_MODEL = process.env.GLM_TITLE_MODEL ?? "glm-4-flash";
// Slightly warm so coaching reads human, not templated — but low enough to keep
// the numbers/advice grounded in the data we feed it.
const COACH_TEMPERATURE = 0.6;

// ── Training metrics ─────────────────────────────────────────────────────────
// Turns raw activities into the numbers a coach actually reasons about, so the
// model isn't left to eyeball a list of rows. NOTE: distanceKm is stored but the
// app treats the value as MILES throughout (see .toFixed(1)+"mi" usages), so we
// follow that same convention here.

type ActivityRow = typeof activitiesTable.$inferSelect;

type TrainingMetrics = {
  hasData: boolean;
  runCount: number;
  weeklyMiles: number[]; // last 4 weeks, oldest → newest ([wk-3, wk-2, wk-1, current])
  wowChangePct: number | null; // week-over-week % change, current vs previous
  acwr: number | null; // acute (7d) : chronic (28d avg) workload ratio
  avgPaceMinPerMile: number | null;
  longestRunMiles: number;
  daysSinceLastRun: number | null;
  flags: string[];
};

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatPace(minPerMile: number): string {
  const m = Math.floor(minPerMile);
  const s = Math.round((minPerMile - m) * 60);
  const ss = s === 60 ? "00" : String(s).padStart(2, "0");
  return `${s === 60 ? m + 1 : m}:${ss}/mi`;
}

function computeTrainingMetrics(activities: ActivityRow[]): TrainingMetrics {
  const empty: TrainingMetrics = {
    hasData: false, runCount: 0, weeklyMiles: [0, 0, 0, 0], wowChangePct: null,
    acwr: null, avgPaceMinPerMile: null, longestRunMiles: 0, daysSinceLastRun: null, flags: [],
  };

  const runs = activities.filter((a) => a.activityDate && Number(a.distanceKm ?? 0) > 0);
  if (runs.length === 0) return empty;

  const today = startOfDay(new Date());
  const dayMs = 86_400_000;

  const weekMiles = [0, 0, 0, 0]; // week 0 = last 7 days, week 1 = 8–14 days ago, …
  let longestRunMiles = 0;
  let paceNum = 0; // distance-weighted pace accumulator
  let paceDenomMiles = 0;
  let mostRecent: Date | null = null;

  for (const a of runs) {
    const d = startOfDay(new Date(a.activityDate as unknown as string));
    const miles = Number(a.distanceKm ?? 0);
    const mins = a.durationMinutes != null ? Number(a.durationMinutes) : null;
    const daysAgo = Math.floor((today.getTime() - d.getTime()) / dayMs);

    if (daysAgo >= 0 && daysAgo < 28) {
      const wk = Math.floor(daysAgo / 7);
      if (wk >= 0 && wk < 4) weekMiles[wk] += miles;
    }
    if (miles > longestRunMiles) longestRunMiles = miles;
    if (mins && mins > 0 && miles > 0) {
      paceNum += (mins / miles) * miles; // = mins; weighted by miles below
      paceDenomMiles += miles;
    }
    if (!mostRecent || d.getTime() > mostRecent.getTime()) mostRecent = d;
  }

  const weeklyMiles = [weekMiles[3], weekMiles[2], weekMiles[1], weekMiles[0]].map((n) => Number(n.toFixed(1)));
  const current = weekMiles[0];
  const previous = weekMiles[1];
  const wowChangePct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;

  const acute = weekMiles[0];
  const chronic = (weekMiles[0] + weekMiles[1] + weekMiles[2] + weekMiles[3]) / 4;
  const acwr = chronic > 0 ? Number((acute / chronic).toFixed(2)) : null;

  const avgPaceMinPerMile = paceDenomMiles > 0 ? Number((paceNum / paceDenomMiles).toFixed(2)) : null;
  const daysSinceLastRun = mostRecent ? Math.floor((today.getTime() - mostRecent.getTime()) / dayMs) : null;

  const flags: string[] = [];
  if (wowChangePct != null && wowChangePct > 10) {
    flags.push(`Weekly mileage jumped ${wowChangePct}% (safe progression is ~10%/week) — elevated injury risk.`);
  }
  if (acwr != null && acwr > 1.5) {
    flags.push(`ACWR is ${acwr} (>1.5) — high acute load vs recent baseline, back off this week.`);
  } else if (acwr != null && acwr < 0.8 && chronic > 0) {
    flags.push(`ACWR is ${acwr} (<0.8) — training load has dropped, room to build back gradually.`);
  }
  if (daysSinceLastRun != null && daysSinceLastRun >= 10) {
    flags.push(`No logged run in ${daysSinceLastRun} days — ease back in rather than resuming at previous volume.`);
  }

  return {
    hasData: true,
    runCount: runs.length,
    weeklyMiles,
    wowChangePct,
    acwr,
    avgPaceMinPerMile,
    longestRunMiles: Number(longestRunMiles.toFixed(1)),
    daysSinceLastRun,
    flags,
  };
}

// Render metrics as a compact block for the system prompt.
function formatMetricsBlock(m: TrainingMetrics): string {
  if (!m.hasData) {
    return "=== TRAINING METRICS ===\nInsufficient activity data to compute trends. Ask the athlete to log recent runs (distance + duration) so analysis can improve.\n========================";
  }
  const lines: string[] = ["=== TRAINING METRICS (computed) ==="];
  lines.push(`Runs analyzed: ${m.runCount}`);
  lines.push(`Weekly miles [wk-3 → current]: ${m.weeklyMiles.join(" → ")}`);
  if (m.wowChangePct != null) lines.push(`Week-over-week change: ${m.wowChangePct > 0 ? "+" : ""}${m.wowChangePct}%`);
  if (m.acwr != null) {
    const zone = m.acwr > 1.5 ? "HIGH RISK" : m.acwr < 0.8 ? "detraining" : "sweet spot";
    lines.push(`Acute:Chronic workload ratio: ${m.acwr} (${zone})`);
  }
  if (m.avgPaceMinPerMile != null) lines.push(`Avg pace (distance-weighted): ${formatPace(m.avgPaceMinPerMile)}`);
  lines.push(`Longest recent run: ${m.longestRunMiles}mi`);
  if (m.daysSinceLastRun != null) lines.push(`Days since last run: ${m.daysSinceLastRun}`);
  if (m.flags.length > 0) {
    lines.push("FLAGS:");
    for (const f of m.flags) lines.push(`  ⚠ ${f}`);
  }
  lines.push("========================");
  return lines.join("\n");
}

const RESPONSE_STRATEGY = `You are an AI chatbot response strategist supporting coaches and athletes on the Thrive platform.

RESPONSE GUIDELINES
- Give fast, trustworthy answers that help users understand the platform, make good decisions, and take clear next steps.
- Be helpful, concise, and accurate. Adapt your tone to the user's level — technical with experienced athletes and coaches, plain and simple with beginners.
- If guidance is needed, provide practical next steps the user can act on immediately.
- Sound knowledgeable, supportive, and easy to follow — never robotic or overly formal.

ASK CLARIFYING QUESTIONS (IMPORTANT — this takes precedence over any persona instinct to deliver a plan)
- If the user's request is vague or broad — e.g. "I want to get faster", "help me train", "build me a plan", "how do I improve" — and you do NOT yet know the key details that would change your advice (their goal/target race, timeline, current weekly mileage, recent training, and injury history), then your ENTIRE reply must be a short friendly intro plus 1 to 2 clarifying questions. Do NOT provide a training plan, workout list, or detailed advice in that first reply. Stop after the questions and wait for their answer.
- Example — user: "I want to get faster" → good reply: "Happy to help you get faster! To point you in the right direction, what distance or race are you training for, and what does your current weekly mileage look like?" (no plan yet).
- Only skip the questions when the user has already given enough specifics to give genuinely tailored advice. When details are present, answer directly — don't ask for the sake of asking.
- Keep it light: one or two short questions, never an interrogation.

FORMAT (Markdown)
- Always respond in clean, well-structured Markdown so it renders nicely.
- Use **bold** for key terms and numbers, \`-\` bullet lists for options or steps, and numbered lists for ordered sequences.
- For longer answers, group content under short \`###\` headings. Keep paragraphs to 1–3 sentences and leave a blank line between sections.
- Default to 1–3 short paragraphs or a brief list unless the user asks for more detail.
- Tone: professional, friendly, and confident. Plain English, no unnecessary jargon.
- Lead with the most useful information.

HEALTH & TRAINING SAFETY
- Keep health, training, and injury-risk responses informational.
- Encourage consulting a qualified professional when appropriate — never give medical diagnoses or treatment plans.
- Do not promise injury prevention or make unsupported health claims.

CONSTRAINTS
- Do not be verbose or overly technical.
- Do not make unsupported claims.
- If uncertain, say so briefly and suggest the best next step.

FOUNDATION & EASY RUN PACING
- When creating a foundation training plan, avoid assigning a single pace for all runs.
- Use pacing variation by distance: short runs (2-3mi) should be around 8:30-9:00/mi, medium runs (4-5mi) should be around 9:00-9:30/mi, and long runs (6+mi) should be around 9:30-10:00/mi.
- Adjust within those ranges based on the athlete's fitness level, current weekly volume, and recent training history.
- Make easy/base runs feel comfortable and sustainable, while still reflecting that longer runs are naturally slower.

HEALTH & TRAINING SAFETY
- Keep health, training, and injury-risk responses informational.
- Encourage consulting a qualified professional when appropriate — never give medical diagnoses or treatment plans.
- Do not promise injury prevention or make unsupported health claims.
`;

const COACH_ADVISOR_PROMPT = `You are AveraAI, an expert AI assistant for running coaches in the Thrive app. You help coaches manage their teams, design training programs, interpret athlete data, and prevent overuse injuries across a squad.

Your focus areas:
- Team periodization: building mesocycles, tapering strategies, and season planning for groups
- Interpreting team metrics: HRV trends, training load distribution, acute:chronic workload ratios
- Flagging athletes at risk before problems become injuries — explain why and what to adjust
- Differentiating training by fitness level, event specialty (sprints, middle distance, XC, marathon)
- Practical recommendations coaches can act on before the next practice
- Athlete communication strategies: how to talk to athletes about rest, load modification, injury risk
- Race preparation, meet scheduling, and peaking strategies

When a coach describes a team situation or individual athlete concern, ask clarifying questions about their event, weekly mileage, and recent training history if relevant. Be direct, specific, and coach-to-coach in tone. Coaches are experienced — don't over-explain basics.

USING THE DATA
- The COACHING CONTEXT block gives you per-athlete COMPUTED metrics: weekly mileage trend, acute:chronic workload ratio (ACWR), average pace, and auto-generated FLAGS. Reason from these — don't ask the coach for numbers you've already been given.
- ACWR is the headline injury signal: 0.8–1.3 is the safe zone, >1.5 is a red flag, <0.8 suggests detraining. Prioritise athletes whose ratio is outside that range.
- Cite the specific athlete's numbers ("Sarah's ACWR is 1.7 and her mileage jumped 40% — pull her back to an easy week"). Never give advice that would read the same for any team.
- If an athlete's metrics say "insufficient data", tell the coach exactly what's missing rather than guessing.`;

const COACH_PROMPTS: Record<string, string> = {
  avera: `You are Avera, a balanced AI running coach in the Thrive app. You specialize in injury prevention, smart training progression, and long-term athlete development. Your tone is warm, analytical, and encouraging.

- Provide evidence-based, practical training advice
- Identify injury risks early by analyzing training load patterns
- Tailor every recommendation to the athlete's fitness level, goals, and recovery status
- Be concise but thorough — athletes are busy people
- Use running metrics (pace, HR zones, mileage, RPE) naturally
- Explain the biomechanical or physiological reason behind any injury risk
- Suggest concrete, actionable steps

USING THE DATA (this is what separates you from a generic chatbot)
- You are given a COMPUTED TRAINING METRICS block (weekly mileage trend, week-over-week change, ACWR, average pace, longest recent run, days since last run) plus recent activities. Ground every recommendation in those specific numbers and quote them back.
- Reason from the data, don't restate it. Don't say "your mileage went up" — say "your mileage jumped from 18 to 26mi (+44%) in one week, past the ~10% safe-progression guideline, so let's hold at ~28mi this week and add a rest day."
- ACWR is your headline injury signal: <0.8 detraining, 0.8–1.3 sweet spot, >1.5 red flag. Call it out explicitly when it's outside the safe zone.
- If a metric says "insufficient data", say so plainly and tell the athlete what to log. Never invent numbers.

Lead with the single most important observation from their data, then give concrete next steps.`,

  kai: `You are Kai, a high-performance speed coach in the Thrive app. You specialize in race-specific training, VO2 max development, lactate threshold work, and breaking personal records. Your tone is energetic, data-driven, and competitive.

- Push athletes toward peak performance with structured speed work
- Reference specific workout types: intervals, tempo runs, strides, hill repeats
- Use pace zones and HR data aggressively to optimize training stimulus
- Be direct and confident — athletes come to you to get faster
- Frame everything around race goals and time improvements
- Call out when athletes are undertrained or playing it too safe

Lead with performance. Every session is an opportunity to get faster.`,

  nova: `You are Nova, a recovery and wellness coach in the Thrive app. You specialize in holistic athlete health — sleep, stress management, easy aerobic base building, and sustainable long-term training. Your tone is calm, thoughtful, and grounding.

- Prioritize recovery, sleep quality, and HRV trends above all else
- Advocate for easy effort runs and aerobic base development
- Help athletes recognize overtraining signals before they become injuries
- Balance training load with life stress — running is one part of health
- Use a mindful, measured approach: more is not always better
- Educate athletes on the science of recovery and adaptation

Lead with balance. Sustainable progress over short-term gains.`,

  rex: `You are Rex, an ultra-endurance coach in the Thrive app. You specialize in marathon, ultra marathon, and long-distance event preparation. Your tone is no-nonsense, experienced, and tough-but-fair.

- Build massive aerobic base through high mileage and back-to-back long runs
- Focus on time-on-feet over pace — endurance is built in hours, not miles
- Prepare athletes mentally and physically for suffering and pushing through fatigue
- Be blunt: if the training isn't there, the race won't go well
- Nutrition, fueling, and race strategy are as important as the miles
- Respect the distance — it will humble anyone who doesn't prepare

Lead with grit. The long game is the only game.`,
};

function getSystemPrompt(coach: string | null | undefined): string {
  const persona = (coach && COACH_PROMPTS[coach]) ? COACH_PROMPTS[coach] : COACH_PROMPTS.avera!;
  return `${RESPONSE_STRATEGY}\n\n${persona}`;
}

function serializeConversation(c: typeof conversations.$inferSelect) {
  return { ...c, createdAt: c.createdAt.toISOString() };
}

// Generate a short, descriptive conversation title from the user's first message.
async function generateConversationTitle(client: OpenAI, userMessage: string): Promise<string | null> {
  try {
    const completion = await client.chat.completions.create({
      model: TITLE_MODEL,
      max_tokens: 24,
      messages: [
        {
          role: "system",
          content:
            "Generate a concise 3-6 word title summarizing the user's message for a chat sidebar. Output ONLY the title text — no surrounding quotes, no trailing punctuation, no 'Title:' prefix.",
        },
        { role: "user", content: userMessage },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) return null;
    const cleaned = raw.replace(/^["'#\s]+|["'.\s]+$/g, "").slice(0, 80);
    return cleaned || null;
  } catch (err) {
    logger.error({ err }, "Conversation title generation failed");
    return null;
  }
}

function serializeMessage(m: typeof messages.$inferSelect) {
  return { ...m, createdAt: m.createdAt.toISOString() };
}

// A coach's team is either the one they own, or one they joined as a co-coach.
async function getTeamForCoach(userId: string) {
  const [ownTeam] = await db.select().from(teamsTable).where(eq(teamsTable.coachUserId, userId)).orderBy(desc(teamsTable.createdAt)).limit(1);
  if (ownTeam) return ownTeam;
  const [coCoach] = await db.select({ teamId: teamCoachesTable.teamId }).from(teamCoachesTable).where(eq(teamCoachesTable.coachUserId, userId)).limit(1);
  if (!coCoach) return undefined;
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, coCoach.teamId)).limit(1);
  return team;
}

async function buildCoachContext(userId: string): Promise<string> {
  const team = await getTeamForCoach(userId);
  if (!team) return "=== COACHING CONTEXT ===\nYou have no team yet.\n========================\n";

  const memberships = await db
    .select({ athleteUserId: teamMembershipsTable.athleteUserId })
    .from(teamMembershipsTable)
    .where(eq(teamMembershipsTable.teamId, team.id));

  const memberIds = memberships.map(m => m.athleteUserId);
  const lines: string[] = [];
  lines.push("=== COACHING CONTEXT ===");
  lines.push(`Team: "${team.name}" | ${memberIds.length} athlete${memberIds.length !== 1 ? "s" : ""}`);

  if (memberIds.length === 0) {
    lines.push("No athletes on team yet.");
    lines.push("========================\n");
    return lines.join("\n");
  }

  const [athleteProfiles, userRows, recentActivities, teamAlerts, teamPlans] = await Promise.all([
    db.select().from(athleteProfileTable).where(inArray(athleteProfileTable.userId, memberIds)),
    db.select().from(usersTable).where(inArray(usersTable.id, memberIds)),
    db.select().from(activitiesTable)
      .where(inArray(activitiesTable.userId, memberIds))
      .orderBy(desc(activitiesTable.activityDate))
      .limit(memberIds.length * 40),
    db.select().from(injuryAlertsTable)
      .where(and(inArray(injuryAlertsTable.userId, memberIds), eq(injuryAlertsTable.acknowledged, false)))
      .orderBy(desc(injuryAlertsTable.createdAt))
      .limit(20),
    db.select().from(trainingPlansTable)
      .where(inArray(trainingPlansTable.userId, memberIds))
      .orderBy(desc(trainingPlansTable.createdAt)),
  ]);

  const profileByUser = new Map(athleteProfiles.map(p => [p.userId, p]));
  const userByUser = new Map(userRows.map(u => [u.id, u]));

  // Per-athlete computed metrics (weekly trend, ACWR, pace, flags) so the coach
  // model reasons over the same signals the athlete side gets.
  const activitiesByUser = new Map<string, ActivityRow[]>();
  for (const a of recentActivities) {
    if (!a.userId) continue;
    const arr = activitiesByUser.get(a.userId) ?? [];
    arr.push(a);
    activitiesByUser.set(a.userId, arr);
  }
  const metricsByUser = new Map<string, TrainingMetrics>();
  for (const mid of memberIds) {
    metricsByUser.set(mid, computeTrainingMetrics(activitiesByUser.get(mid) ?? []));
  }
  const alertsByUser = new Map<string, typeof teamAlerts>();
  for (const al of teamAlerts) {
    if (!al.userId) continue;
    const existing = alertsByUser.get(al.userId) ?? [];
    existing.push(al);
    alertsByUser.set(al.userId, existing);
  }

  const plansByUser = new Map<string, typeof teamPlans>();
  for (const plan of teamPlans) {
    if (!plan.userId) continue;
    const existing = plansByUser.get(plan.userId) ?? [];
    existing.push(plan);
    plansByUser.set(plan.userId, existing);
  }

  lines.push("\n--- Athlete Roster ---");
  for (const mid of memberIds) {
    const p = profileByUser.get(mid);
    const u = userByUser.get(mid);
    const name = (p?.name ?? `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim()) || "Athlete";
    const met = metricsByUser.get(mid);
    const weeklyMi = met?.hasData ? met.weeklyMiles[met.weeklyMiles.length - 1].toFixed(1) : "0.0";
    const parts = [
      `Name: ${name}`,
      (p?.state || p?.country) ? `Location: ${[p?.state, p?.country].filter(Boolean).join(", ")}` : null,
      p?.fitnessLevel ? `Level: ${p.fitnessLevel}` : null,
      p?.primaryGoal ? `Goal: ${p.primaryGoal}` : null,
      `Weekly: ${weeklyMi}mi (last 7 days)`,
      met?.acwr != null ? `ACWR: ${met.acwr}` : null,
      met?.avgPaceMinPerMile != null ? `Pace: ${formatPace(met.avgPaceMinPerMile)}` : null,
      p?.restingHeartRate ? `RHR: ${p.restingHeartRate}bpm` : null,
      p?.hrv ? `HRV: ${Number(p.hrv).toFixed(0)}ms` : null,
    ].filter(Boolean).join(" | ");
    lines.push(`• ${parts}`);
    for (const f of (met?.flags ?? [])) {
      lines.push(`  ⚠ ${f}`);
    }
    const alerts = alertsByUser.get(mid) ?? [];
    for (const al of alerts) {
      lines.push(`  ⚠ ${al.riskLevel.toUpperCase()} RISK — ${al.bodyPart}: ${al.message}`);
    }
    const plans = plansByUser.get(mid) ?? [];
    for (const plan of plans) {
      lines.push(`  📋 Plan: "${plan.name}" | ${plan.goal} | ${plan.startDate}–${plan.endDate} | Status: ${plan.status}${plan.weeklyMileage ? ` | ${Number(plan.weeklyMileage)}mi/wk` : ""}`);
    }
  }

  const totalAlertsCount = teamAlerts.length;
  if (totalAlertsCount > 0) {
    lines.push(`\nActive injury alerts across team: ${totalAlertsCount}`);
  }

  lines.push("========================");
  lines.push("Use the athlete data above to give specific, personalised coaching advice. Reference actual numbers when relevant.\n");
  return lines.join("\n");
}

async function buildAthleteContext(userId: string): Promise<string> {
  const [profileRows, recentActivities, activePlan, openAlerts] = await Promise.all([
    db.select().from(athleteProfileTable).where(eq(athleteProfileTable.userId, userId)).limit(1),
    db.select().from(activitiesTable).where(eq(activitiesTable.userId, userId)).orderBy(desc(activitiesTable.activityDate)).limit(40),
    db.select().from(trainingPlansTable).where(and(eq(trainingPlansTable.userId, userId), eq(trainingPlansTable.status, "active"))).limit(1),
    db.select().from(injuryAlertsTable).where(and(eq(injuryAlertsTable.userId, userId), eq(injuryAlertsTable.acknowledged, false))).limit(5),
  ]);

  const profile = profileRows[0];
  if (!profile) return "";

  const metrics = computeTrainingMetrics(recentActivities);

  const lines: string[] = [];
  lines.push("=== ATHLETE PROFILE ===");
  lines.push(
    [
      profile.name ? `Name: ${profile.name}` : null,
      profile.age ? `Age: ${profile.age}` : null,
      (profile.state || profile.country) ? `Location: ${[profile.state, profile.country].filter(Boolean).join(", ")}` : null,
      `Fitness: ${profile.fitnessLevel}`,
      profile.primaryGoal ? `Goal: ${profile.primaryGoal}` : null,
      profile.weeklyMileageGoal ? `Weekly target: ${Number(profile.weeklyMileageGoal)}mi` : null,
      profile.hrv ? `HRV: ${Number(profile.hrv)}ms` : null,
      profile.restingHeartRate ? `Resting HR: ${profile.restingHeartRate}bpm` : null,
    ].filter(Boolean).join(" | "),
  );

  lines.push("\n" + formatMetricsBlock(metrics));

  if (recentActivities.length > 0) {
    lines.push("\nRecent Activities (newest first, up to 10 shown):");
    for (const a of recentActivities.slice(0, 10)) {
      const parts = [
        a.activityDate,
        a.type.replace(/_/g, " "),
        a.distanceKm ? `${Number(a.distanceKm).toFixed(1)}mi` : null,
        a.durationMinutes ? `${a.durationMinutes}min` : null,
        a.avgHeartRate ? `HR ${a.avgHeartRate}` : null,
        a.perceivedEffort ? `RPE ${a.perceivedEffort}/10` : null,
        a.notes ? `"${a.notes}"` : null,
      ].filter(Boolean).join(" | ");
      lines.push(`- ${parts}`);
    }
  }

  const plan = activePlan[0];
  if (plan) {
    lines.push(
      `\nActive Training Plan: "${plan.name}" | Goal: ${plan.goal} | ${plan.startDate} – ${plan.endDate}${plan.weeklyMileage ? ` | ${Number(plan.weeklyMileage)}mi/wk` : ""}`,
    );
  }

  if (openAlerts.length > 0) {
    lines.push(`\nOpen Injury Alerts (${openAlerts.length}):`);
    for (const alert of openAlerts) {
      lines.push(`- ${alert.riskLevel.toUpperCase()}: ${alert.bodyPart} — ${alert.message}`);
    }
  }

  lines.push("======================");
  lines.push("Use the above data to give specific, personalised advice. Reference actual numbers when relevant.\n");
  return lines.join("\n");
}

async function buildUserContext(userId: string, userRole?: string | null): Promise<string> {
  if (userRole === "coach") return buildCoachContext(userId);
  return buildAthleteContext(userId);
}

// ── List conversations ──────────────────────────────────────────────────────

router.get("/openai/conversations", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const convs = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(conversations.createdAt);
  res.json(ListOpenaiConversationsResponse.parse(convs.map(serializeConversation)));
});

// ── Create conversation ─────────────────────────────────────────────────────

router.post("/openai/conversations", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const parsed = CreateOpenaiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = req.user.id;
  const [conv] = await db
    .insert(conversations)
    .values({ title: parsed.data.title, userId })
    .returning();
  res.status(201).json(serializeConversation(conv));
});

// ── Get conversation + messages ─────────────────────────────────────────────

router.get("/openai/conversations/:id", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetOpenaiConversationParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = req.user.id;
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(messages.createdAt);
  res.json(
    GetOpenaiConversationResponse.parse({
      ...serializeConversation(conv),
      messages: msgs.map(serializeMessage),
    }),
  );
});

// ── Delete conversation ─────────────────────────────────────────────────────

router.delete("/openai/conversations/:id", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteOpenaiConversationParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = req.user.id;
  const [conv] = await db
    .delete(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)))
    .returning();
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.sendStatus(204);
});

// ── List messages in a conversation ────────────────────────────────────────

router.get("/openai/conversations/:id/messages", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = ListOpenaiMessagesParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const userId = req.user.id;
  const [conv] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(messages.createdAt);
  res.json(ListOpenaiMessagesResponse.parse(msgs.map(serializeMessage)));
});

// ── Send a message + stream AI reply ───────────────────────────────────────

// ── Athlete plan-from-chat ───────────────────────────────────────────────────

// Heuristic: does this message ask us to BUILD a training plan (as opposed to
// asking about an existing one)? Kept deliberately specific so it doesn't hijack
// normal chat like "what's on my plan today".
function isPlanRequest(text: string): boolean {
  const t = text.toLowerCase();
  if (/\b(build|make|create|generate|design|put together|draw up|give me|write me|set up|plan out|prepare)\b[^.?!]*\bplan\b/.test(t)) return true;
  if (/\b(training|marathon|half[- ]?marathon|10k|5k|race|running|week|weekly)\b[^.?!]{0,24}\bplan\b/.test(t)) return true;
  if (/\bplan\b[^.?!]{0,24}\b(for|to)\b[^.?!]{0,30}\b(race|marathon|5k|10k|half|faster|weeks?)\b/.test(t)) return true;
  return false;
}

type PlanSessionOut = { weekNumber: number; dayOfWeek: number; sessionType: string; description: string; distanceMiles: number; durationMinutes: number };
type AthletePlan = { name: string; goal: string; startDate: string; endDate: string; weeklyMileage: number; rationale: string; sessions: PlanSessionOut[] };

// Ask the model for a structured 4-week plan for THIS athlete, grounded in their
// computed metrics, and validate/clamp it into a shape safe to persist.
async function generateAthletePlan(client: OpenAI, userMessage: string, contextStr: string): Promise<AthletePlan | null> {
  const startDate = nextMondayISO();
  const endDate = addDaysISO(startDate, 27); // 4-week plan
  const systemPrompt = `You are AveraAI, an expert running coach. Based on the athlete's request and their training data, design a 4-week training plan for THIS athlete. All distances are in MILES.

Ground the plan in the athlete's recent metrics (weekly mileage, ACWR, pace) from the context. Respect safe progression (~10%/week) and keep it realistic for their current volume. If they have an injury flag, keep volume conservative and bias toward easy_run, cross_training, and rest.

Respond with ONLY a valid JSON object (no markdown, no prose) of this exact shape:
{
  "name": "<short plan name>",
  "goal": "<one-line goal>",
  "weeklyMileage": <number, target miles per week>,
  "rationale": "<1-2 sentence why this plan fits them>",
  "sessions": [
    { "weekNumber": 1, "dayOfWeek": 1, "sessionType": "<one of: ${VALID_SESSION_TYPES.join(", ")}>", "description": "<short>", "distanceMiles": <number, 0 for rest>, "durationMinutes": <integer> }
  ]
}
Provide exactly 28 sessions: weeks 1–4, dayOfWeek 1 (Mon) through 7 (Sun) for each. dayOfWeek: 1=Mon … 7=Sun.`;

  const completion = await client.chat.completions.create({
    model: COACH_MODEL,
    max_tokens: 2600,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `${contextStr}\n\nAthlete request: "${userMessage}"\nPlan dates: ${startDate} to ${endDate}. Design the plan now.` },
    ],
  });
  const rawOut = completion.choices[0]?.message?.content ?? "";
  const jsonStr = rawOut.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    logger.error({ rawOut }, "athlete plan: failed to parse model JSON");
    return null;
  }

  const rawSessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
  const sessions: PlanSessionOut[] = rawSessions.map((s) => {
    const o = s as Record<string, unknown>;
    const type = String(o.sessionType ?? "easy_run");
    return {
      weekNumber: Math.min(4, Math.max(1, Number(o.weekNumber) || 1)),
      dayOfWeek: Math.min(7, Math.max(1, Number(o.dayOfWeek) || 1)),
      sessionType: VALID_SESSION_TYPES.includes(type) ? type : "easy_run",
      description: String(o.description ?? "").slice(0, 280) || "Run",
      distanceMiles: Math.max(0, Number(o.distanceMiles) || 0),
      durationMinutes: Math.max(0, Math.round(Number(o.durationMinutes) || 0)),
    };
  }).filter((s) => s.sessionType === "rest" || s.distanceMiles > 0 || s.durationMinutes > 0);

  if (sessions.length === 0) return null;

  return {
    name: String(parsed.name ?? "Training Plan").slice(0, 120),
    goal: String(parsed.goal ?? "General fitness").slice(0, 200),
    startDate,
    endDate,
    weeklyMileage: Math.max(0, Number(parsed.weeklyMileage) || 0),
    rationale: String(parsed.rationale ?? "").slice(0, 400),
    sessions,
  };
}

const PLAN_DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Human-readable confirmation streamed back into the chat after saving a plan.
function buildPlanSummaryMarkdown(p: AthletePlan): string {
  const lines: string[] = [];
  lines.push("✅ **Added to your Training Plans tab.**");
  lines.push("");
  lines.push(`### ${p.name}`);
  if (p.rationale) lines.push(p.rationale);
  lines.push("");
  lines.push(`**Goal:** ${p.goal}  \n**Dates:** ${p.startDate} → ${p.endDate}  \n**Target volume:** ~${p.weeklyMileage} mi/week`);

  const byWeek = new Map<number, PlanSessionOut[]>();
  for (const s of p.sessions) {
    const arr = byWeek.get(s.weekNumber) ?? [];
    arr.push(s);
    byWeek.set(s.weekNumber, arr);
  }
  for (const wk of [...byWeek.keys()].sort((a, b) => a - b)) {
    lines.push("");
    lines.push(`**Week ${wk}**`);
    for (const s of byWeek.get(wk)!.sort((a, b) => a.dayOfWeek - b.dayOfWeek)) {
      const dist = s.distanceMiles > 0 ? ` — ${s.distanceMiles}mi` : "";
      lines.push(`- ${PLAN_DAY_NAMES[s.dayOfWeek]}: ${s.sessionType.replace(/_/g, " ")}${dist} — ${s.description}`);
    }
  }
  lines.push("");
  lines.push("_Open the **Training Plans** tab to see it, tweak sessions, or mark them complete._");
  return lines.join("\n");
}

router.post("/openai/conversations/:id/messages", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = SendOpenaiMessageParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = SendOpenaiMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userId = req.user.id;

  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, params.data.id), eq(conversations.userId, userId)));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  await db.insert(messages).values({ conversationId: conv.id, role: "user", content: parsed.data.content });

  const client = openaiClient;
  if (!client) {
    const fallbackContent = "AveraAI isn't configured yet — the GLM_API_KEY environment variable is missing on the server.";
    await db.insert(messages).values({ conversationId: conv.id, role: "assistant", content: fallbackContent });
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.write(`data: ${JSON.stringify({ content: fallbackContent })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    return;
  }

  const [historyRows, profileRows] = await Promise.all([
    db.select().from(messages).where(eq(messages.conversationId, conv.id)).orderBy(messages.createdAt),
    db.select({ selectedCoach: athleteProfileTable.selectedCoach, userRole: athleteProfileTable.userRole })
      .from(athleteProfileTable)
      .where(eq(athleteProfileTable.userId, userId))
      .limit(1),
  ]);

  const profile = profileRows[0];
  const userContext = await buildUserContext(userId, profile?.userRole);
  const chatMessages = historyRows.map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

  // On the first user message of a conversation, auto-generate a descriptive
  // title from what they asked. Run concurrently with the reply stream and await
  // before ending so the client's post-stream refresh picks it up.
  const isFirstMessage = chatMessages.length === 1;
  let generatedTitle: string | null = null;
  const titlePromise: Promise<void> = isFirstMessage
    ? generateConversationTitle(client, parsed.data.content)
        .then(async (title) => {
          if (title) {
            await db.update(conversations).set({ title }).where(eq(conversations.id, conv.id));
            generatedTitle = title;
          }
        })
        .catch((err) => {
          // Never let title persistence break stream completion.
          generatedTitle = null;
          logger.error({ err }, "Conversation title persistence failed");
        })
    : Promise.resolve();

  const basePrompt = profile?.userRole === "coach"
    ? `${RESPONSE_STRATEGY}\n\n${COACH_ADVISOR_PROMPT}`
    : getSystemPrompt(profile?.selectedCoach);
  const systemPrompt = userContext ? `${userContext}\n${basePrompt}` : basePrompt;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";
  let planCreatedId: number | null = null;

  // If an ATHLETE asks us to build a training plan, generate a full structured
  // plan, save it (plan + all sessions) to their account, and stream a
  // confirmation instead of the normal chat reply. Coaches keep their existing
  // suggest/apply flow. Any failure falls through to a normal chat answer.
  if (profile?.userRole !== "coach" && isPlanRequest(parsed.data.content)) {
    try {
      const proposal = await generateAthletePlan(client, parsed.data.content, userContext);
      if (proposal) {
        const [plan] = await db
          .insert(trainingPlansTable)
          .values({
            userId,
            name: proposal.name,
            goal: proposal.goal,
            startDate: proposal.startDate,
            endDate: proposal.endDate,
            status: "active",
            weeklyMileage: proposal.weeklyMileage > 0 ? String(proposal.weeklyMileage) : null,
          })
          .returning();
        await db.insert(planSessionsTable).values(
          proposal.sessions.map((s) => ({
            planId: plan.id,
            weekNumber: s.weekNumber,
            dayOfWeek: s.dayOfWeek,
            sessionType: s.sessionType,
            description: s.description,
            distanceKm: s.distanceMiles > 0 ? String(s.distanceMiles) : null,
            durationMinutes: s.durationMinutes > 0 ? s.durationMinutes : null,
            completed: false,
          })),
        );
        planCreatedId = plan.id;
        fullResponse = buildPlanSummaryMarkdown(proposal);
        res.write(`data: ${JSON.stringify({ content: fullResponse })}\n\n`);
      }
    } catch (err) {
      logger.error({ err, userId }, "athlete plan auto-create failed; falling back to chat");
    }
  }

  if (!planCreatedId) {
    try {
      const finalMessages = [{ role: "system" as const, content: systemPrompt }, ...chatMessages];
      // Full prompt sent to the model, verbatim — for debugging/observability.
      logger.info(
        { model: COACH_MODEL, temperature: COACH_TEMPERATURE, userRole: profile?.userRole ?? null, messages: finalMessages },
        "AveraAI final prompt",
      );
      const stream = await client.chat.completions.create({
        model: COACH_MODEL,
        temperature: COACH_TEMPERATURE,
        max_tokens: 2048,
        messages: finalMessages,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
    } catch (err) {
      logger.error({ err }, "AveraAI stream error");
      // GLM frequently ends the stream with a "Premature close" *after* delivering
      // the full reply. If we already have content, treat it as a normal completion
      // and keep what we streamed — only surface an error when nothing came through.
      if (!fullResponse) {
        const errMsg = "Sorry, I encountered an error. Please try again.";
        fullResponse = errMsg;
        res.write(`data: ${JSON.stringify({ content: errMsg })}\n\n`);
      }
    }
  }

  await db.insert(messages).values({ conversationId: conv.id, role: "assistant", content: fullResponse });
  await titlePromise;
  const doneEvent: Record<string, unknown> = { done: true };
  if (generatedTitle) doneEvent.title = generatedTitle;
  if (planCreatedId) {
    doneEvent.planCreated = true;
    doneEvent.planId = planCreatedId;
  }
  res.write(`data: ${JSON.stringify(doneEvent)}\n\n`);
  res.end();
});

// ── Coach proactive tip (non-streaming) ──────────────────────────────────────

router.get("/openai/coach-tip", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const profileRows = await db.select({ userRole: athleteProfileTable.userRole }).from(athleteProfileTable).where(eq(athleteProfileTable.userId, userId)).limit(1);
  const profile = profileRows[0];
  if (profile?.userRole !== "coach") {
    res.status(403).json({ error: "Coach only" });
    return;
  }
  if (!openaiClient) {
    res.json({ tip: null });
    return;
  }
  try {
    const context = await buildCoachContext(userId);
    const completion = await openaiClient.chat.completions.create({
      model: COACH_MODEL,
      temperature: COACH_TEMPERATURE,
      max_tokens: 100,
      messages: [
        {
          role: "system",
          content: "You are AveraAI, a coaching assistant. Based on the team data provided, give ONE specific, actionable coaching insight in 1-2 sentences. No greeting or intro — just the direct insight. Focus on the most pressing concern or opportunity you see.",
        },
        { role: "user", content: context + "\nWhat is your most important insight right now?" },
      ],
    });
    const tip = completion.choices[0]?.message?.content ?? null;
    res.json({ tip });
  } catch (err) {
    logger.error({ err }, "coach-tip error");
    res.json({ tip: null });
  }
});

// ── Avera: suggest a training plan for an athlete (coach only) ───────────────
const VALID_SESSION_TYPES = ["easy_run", "tempo_run", "interval", "long_run", "cross_training", "rest", "race"];

function nextMondayISO(): string {
  const d = new Date();
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const daysUntilMonday = ((8 - (day === 0 ? 7 : day)) % 7) || 7;
  d.setUTCDate(d.getUTCDate() + daysUntilMonday);
  return d.toISOString().slice(0, 10);
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function getCoachTeamRoster(userId: string) {
  const team = await getTeamForCoach(userId);
  if (!team) return null;
  const memberships = await db
    .select({ athleteUserId: teamMembershipsTable.athleteUserId })
    .from(teamMembershipsTable)
    .where(eq(teamMembershipsTable.teamId, team.id));
  const memberIds = memberships.map(m => m.athleteUserId);
  if (memberIds.length === 0) return { team, roster: [] as RosterEntry[] };

  const [profiles, users, activities, alerts, plans] = await Promise.all([
    db.select().from(athleteProfileTable).where(inArray(athleteProfileTable.userId, memberIds)),
    db.select().from(usersTable).where(inArray(usersTable.id, memberIds)),
    db.select().from(activitiesTable).where(inArray(activitiesTable.userId, memberIds)).orderBy(desc(activitiesTable.activityDate)).limit(memberIds.length * 8),
    db.select().from(injuryAlertsTable).where(and(inArray(injuryAlertsTable.userId, memberIds), eq(injuryAlertsTable.acknowledged, false))),
    db.select().from(trainingPlansTable).where(and(inArray(trainingPlansTable.userId, memberIds), eq(trainingPlansTable.status, "active"))),
  ]);

  const profileByUser = new Map(profiles.map(p => [p.userId, p]));
  const userByUser = new Map(users.map(u => [u.id, u]));
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const weeklyByUser = new Map<string, number>();
  for (const a of activities) {
    if (!a.userId || !a.activityDate || new Date(a.activityDate) < sevenDaysAgo) continue;
    weeklyByUser.set(a.userId, (weeklyByUser.get(a.userId) ?? 0) + Number(a.distanceKm ?? 0));
  }
  const alertByUser = new Map<string, typeof alerts>();
  for (const al of alerts) {
    if (!al.userId) continue;
    const arr = alertByUser.get(al.userId) ?? [];
    arr.push(al);
    alertByUser.set(al.userId, arr);
  }
  const hasPlan = new Set(plans.map(p => p.userId));

  const roster: RosterEntry[] = memberIds.map(mid => {
    const p = profileByUser.get(mid);
    const u = userByUser.get(mid);
    const name = (p?.name ?? `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim()) || "Athlete";
    return {
      userId: mid,
      name,
      fitnessLevel: p?.fitnessLevel ?? null,
      primaryGoal: p?.primaryGoal ?? null,
      weeklyMiles: Number((weeklyByUser.get(mid) ?? 0).toFixed(1)),
      hasActivePlan: hasPlan.has(mid),
      alerts: (alertByUser.get(mid) ?? []).map(a => `${a.riskLevel} risk ${a.bodyPart}`),
    };
  });
  return { team, roster };
}

type RosterEntry = {
  userId: string;
  name: string;
  fitnessLevel: string | null;
  primaryGoal: string | null;
  weeklyMiles: number;
  hasActivePlan: boolean;
  alerts: string[];
};

router.get("/openai/suggest-plan", async (req: Request, res): Promise<void> => {
  try {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = req.user.id;
    const profileRows = await db.select({ userRole: athleteProfileTable.userRole }).from(athleteProfileTable).where(eq(athleteProfileTable.userId, userId)).limit(1);
    if (profileRows[0]?.userRole !== "coach") {
      res.status(403).json({ error: "Coach only" });
      return;
    }
    if (!openaiClient) {
      res.status(503).json({ error: "AI is not configured" });
      return;
    }

    const data = await getCoachTeamRoster(userId);
    if (!data) {
      res.status(404).json({ error: "No team found" });
      return;
    }
    if (data.roster.length === 0) {
      res.status(400).json({ error: "No athletes on your team yet" });
      return;
    }

    // Prefer athletes without an active plan; fall back to whole roster.
    const candidates = data.roster.filter(r => !r.hasActivePlan);
    const pool = candidates.length > 0 ? candidates : data.roster;

    const rosterLines = pool.map((r, i) =>
      `${i + 1}. ${r.name} | level: ${r.fitnessLevel ?? "unknown"} | goal: ${r.primaryGoal ?? "general fitness"} | recent weekly: ${r.weeklyMiles}mi${r.alerts.length ? ` | ALERTS: ${r.alerts.join(", ")}` : ""}${r.hasActivePlan ? " | (already has an active plan)" : ""}`
    ).join("\n");

    const startDate = nextMondayISO();
    const endDate = addDaysISO(startDate, 13); // 2-week plan

    const systemPrompt = `You are AveraAI, an expert running coach. Design a focused 2-week training plan for ONE athlete from the roster below. All distances are in MILES.

Pick the athlete who would benefit most from a new plan. If an athlete has an injury alert, keep volume conservative and bias toward easy_run, cross_training, and rest.

Respond with ONLY a valid JSON object (no markdown, no prose) of this exact shape:
{
  "athleteNumber": <integer matching the roster number>,
  "name": "<short plan name>",
  "goal": "<one-line goal>",
  "weeklyMileage": <number, target miles per week>,
  "rationale": "<1-2 sentence why this athlete and this plan>",
  "sessions": [
    { "weekNumber": 1, "dayOfWeek": 1, "sessionType": "<one of: ${VALID_SESSION_TYPES.join(", ")}>", "description": "<short>", "distanceMiles": <number, 0 for rest>, "durationMinutes": <integer> }
  ]
}
Provide exactly 14 sessions: weeks 1 and 2, dayOfWeek 1 (Mon) through 7 (Sun) for each. Use realistic mileage based on the athlete's recent weekly volume. dayOfWeek: 1=Mon ... 7=Sun.`;

    const completion = await openaiClient.chat.completions.create({
      model: COACH_MODEL,
      max_tokens: 1800,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Roster:\n${rosterLines}\n\nPlan dates: ${startDate} to ${endDate}. Design the plan now.` },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? "";
    const jsonStr = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      logger.error({ raw }, "suggest-plan: failed to parse model JSON");
      res.status(502).json({ error: "Could not generate a plan, please try again" });
      return;
    }

    const idx = Number(parsed.athleteNumber);
    const chosen = pool[idx - 1];
    if (!chosen) {
      res.status(502).json({ error: "Could not match a valid athlete, please try again" });
      return;
    }

    const rawSessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
    const sessions = rawSessions.map((s) => {
      const o = s as Record<string, unknown>;
      const type = String(o.sessionType ?? "easy_run");
      return {
        weekNumber: Math.min(2, Math.max(1, Number(o.weekNumber) || 1)),
        dayOfWeek: Math.min(7, Math.max(1, Number(o.dayOfWeek) || 1)),
        sessionType: VALID_SESSION_TYPES.includes(type) ? type : "easy_run",
        description: String(o.description ?? "").slice(0, 280) || "Run",
        distanceMiles: Math.max(0, Number(o.distanceMiles) || 0),
        durationMinutes: Math.max(0, Math.round(Number(o.durationMinutes) || 0)),
      };
    }).filter(s => s.sessionType === "rest" || s.distanceMiles > 0 || s.durationMinutes > 0);

    if (sessions.length === 0) {
      res.status(502).json({ error: "Generated plan was empty, please try again" });
      return;
    }

    res.json({
      proposal: {
        athleteUserId: chosen.userId,
        athleteName: chosen.name,
        name: String(parsed.name ?? "Training Plan").slice(0, 120),
        goal: String(parsed.goal ?? "General fitness").slice(0, 200),
        startDate,
        endDate,
        weeklyMileage: Math.max(0, Number(parsed.weeklyMileage) || 0),
        rationale: String(parsed.rationale ?? "").slice(0, 400),
        sessions,
      },
    });
  } catch (err) {
    logger.error({ err }, "suggest-plan error");
    res.status(500).json({ error: "Failed to generate a plan" });
  }
});

// ── Avera: apply a suggested plan to an athlete (coach only) ─────────────────
router.post("/openai/apply-plan", async (req: Request, res): Promise<void> => {
  try {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = req.user.id;
    const profileRows = await db.select({ userRole: athleteProfileTable.userRole, name: athleteProfileTable.name }).from(athleteProfileTable).where(eq(athleteProfileTable.userId, userId)).limit(1);
    if (profileRows[0]?.userRole !== "coach") {
      res.status(403).json({ error: "Coach only" });
      return;
    }
    const coachName = profileRows[0]?.name || "Your coach";

    const body = req.body as Record<string, unknown>;
    const athleteUserId = typeof body.athleteUserId === "string" ? body.athleteUserId : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const goal = typeof body.goal === "string" ? body.goal.trim() : "";
    const startDate = typeof body.startDate === "string" ? body.startDate : "";
    const endDate = typeof body.endDate === "string" ? body.endDate : "";
    const weeklyMileage = body.weeklyMileage != null ? Number(body.weeklyMileage) : null;
    const sessionsIn = Array.isArray(body.sessions) ? body.sessions : [];

    if (!athleteUserId || !name || !goal || !startDate || !endDate || sessionsIn.length === 0) {
      res.status(400).json({ error: "Missing required plan fields" });
      return;
    }

    // Validate the athlete is on this coach's team.
    const data = await getCoachTeamRoster(userId);
    if (!data || !data.roster.some(r => r.userId === athleteUserId)) {
      res.status(403).json({ error: "Athlete is not on your team" });
      return;
    }

    const [plan] = await db.insert(trainingPlansTable).values({
      userId: athleteUserId,
      // The coach authored this plan's content — the athlete can only
      // suggest changes to it, not edit it directly.
      createdBy: userId,
      name,
      goal,
      startDate,
      endDate,
      status: "active",
      weeklyMileage: weeklyMileage != null && !Number.isNaN(weeklyMileage) ? String(weeklyMileage) : null,
    }).returning();

    const sessionValues = sessionsIn.map((s) => {
      const o = s as Record<string, unknown>;
      const type = String(o.sessionType ?? "easy_run");
      const miles = Math.max(0, Number(o.distanceMiles) || 0);
      return {
        planId: plan.id,
        weekNumber: Math.max(1, Number(o.weekNumber) || 1),
        dayOfWeek: Math.min(7, Math.max(1, Number(o.dayOfWeek) || 1)),
        sessionType: VALID_SESSION_TYPES.includes(type) ? type : "easy_run",
        description: String(o.description ?? "Run").slice(0, 280),
        distanceKm: miles > 0 ? String(miles) : null,
        durationMinutes: o.durationMinutes != null ? Math.max(0, Math.round(Number(o.durationMinutes) || 0)) : null,
        completed: false,
      };
    });
    if (sessionValues.length > 0) {
      await db.insert(planSessionsTable).values(sessionValues);
    }

    await db.insert(notificationsTable).values({
      userId: athleteUserId,
      type: "training_plan",
      title: "New training plan added",
      message: `${coachName} added a new training plan: "${name}".`,
    });

    res.status(201).json({ planId: plan.id });
  } catch (err) {
    logger.error({ err }, "apply-plan error");
    res.status(500).json({ error: "Failed to save the plan" });
  }
});

// ── Suggest an Avera-drafted plan to the athlete's coach ──────────────────────
// Persists the full plan + sessions as status "pending" (not visible to the
// athlete as an active plan yet) and notifies the coach. The coach approves
// or rejects it from their Training Plans page.
router.post("/openai/suggest-to-coach", async (req: Request, res): Promise<void> => {
  try {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = req.user.id;

    // Verify the athlete is a member of a team and find the coach user id
    const membership = await db.select({ teamId: teamMembershipsTable.teamId })
      .from(teamMembershipsTable)
      .where(eq(teamMembershipsTable.athleteUserId, userId)).limit(1);
    if (!membership || membership.length === 0) {
      res.status(404).json({ error: "No coach found for this athlete" });
      return;
    }
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, membership[0].teamId)).limit(1);
    if (!team) {
      res.status(404).json({ error: "No coach found for this athlete" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const goal = typeof body.goal === "string" ? body.goal.trim() : "";
    const startDate = typeof body.startDate === "string" ? body.startDate : "";
    const endDate = typeof body.endDate === "string" ? body.endDate : "";
    const weeklyMileage = body.weeklyMileage != null ? Number(body.weeklyMileage) : null;
    const sessionsIn = Array.isArray(body.sessions) ? body.sessions : [];

    if (!name || !goal || !startDate || !endDate || sessionsIn.length === 0) {
      res.status(400).json({ error: "Missing required plan fields" });
      return;
    }

    const [plan] = await db.insert(trainingPlansTable).values({
      userId,
      createdBy: userId,
      name,
      goal,
      startDate,
      endDate,
      status: "pending",
      weeklyMileage: weeklyMileage != null && !Number.isNaN(weeklyMileage) ? String(weeklyMileage) : null,
    }).returning();

    const sessionValues = sessionsIn.map((s) => {
      const o = s as Record<string, unknown>;
      const type = String(o.sessionType ?? "easy_run");
      const miles = Math.max(0, Number(o.distanceMiles) || 0);
      return {
        planId: plan.id,
        weekNumber: Math.max(1, Number(o.weekNumber) || 1),
        dayOfWeek: Math.min(7, Math.max(1, Number(o.dayOfWeek) || 1)),
        sessionType: VALID_SESSION_TYPES.includes(type) ? type : "easy_run",
        description: String(o.description ?? "Run").slice(0, 280),
        distanceKm: miles > 0 ? String(miles) : null,
        durationMinutes: o.durationMinutes != null ? Math.max(0, Math.round(Number(o.durationMinutes) || 0)) : null,
        completed: false,
      };
    });
    if (sessionValues.length > 0) {
      await db.insert(planSessionsTable).values(sessionValues);
    }

    await db.insert(notificationsTable).values({
      userId: team.coachUserId,
      type: "plan_suggestion",
      title: "Plan suggestion",
      message: `${req.user.firstName ?? "An athlete"} suggested a training plan: "${name}".`,
    });

    res.status(201).json({ planId: plan.id });
  } catch (err) {
    logger.error({ err }, "suggest-to-coach error");
    res.status(500).json({ error: "Failed to suggest plan to coach" });
  }
});

export default router;
