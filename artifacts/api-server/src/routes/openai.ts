import { Router, type Request, type IRouter } from "express";
import { eq, and, desc, inArray, gte, sql } from "drizzle-orm";
import { hasActiveAccess } from "../lib/access";
import { countAiPlans, FREE_AI_PLAN_LIMIT } from "./plans";
import {
  db,
  conversations,
  messages,
  athleteProfileTable,
  activitiesTable,
  trainingPlansTable,
  planSessionsTable,
  injuryAlertsTable,
  injuryAlertCommentsTable,
  directMessagesTable,
  notificationsTable,
  teamsTable,
  teamMembershipsTable,
  teamCoachesTable,
  usersTable,
} from "@workspace/db";
import { computeWhatIfScenarios } from "./injuryRisk";
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
import OpenAI, { toFile } from "openai";

const router: IRouter = Router();

// Free-tier cap: AveraAI messages per calendar month. Active-subscription (or
// team-covered) accounts are unlimited — see the check in the send-message
// route below.
const FREE_MONTHLY_AI_MESSAGES = 20;

async function countUserMessagesThisMonth(userId: string): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(eq(conversations.userId, userId), eq(messages.role, "user"), gte(messages.createdAt, startOfMonth)));
  return row?.count ?? 0;
}

const apiKey = process.env.GLM_API_KEY;
export const openaiClient = apiKey
  ? new OpenAI({ apiKey, baseURL: "https://open.bigmodel.cn/api/paas/v4/" })
  : null;

// Voice input for AveraAI uses real OpenAI (Whisper-family transcription) via
// OPENAI_API_KEY, separate from the GLM client above which only does chat
// completions against a GLM-compatible endpoint that doesn't support audio.
const transcriptionApiKey = process.env.OPENAI_API_KEY;
const transcriptionClient = transcriptionApiKey ? new OpenAI({ apiKey: transcriptionApiKey }) : null;

function audioExtensionFor(contentType: string): string {
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("mp4")) return "mp4";
  if (contentType.includes("aac")) return "aac";
  if (contentType.includes("mpeg") || contentType.includes("mp3")) return "mp3";
  if (contentType.includes("wav")) return "wav";
  return "webm";
}

// Model is overridable via env so you can point coaching/plan generation at a
// stronger model (e.g. GLM_COACH_MODEL=glm-4.6) WITHOUT a code change — but the
// default stays on glm-4-flash, the model already proven to work on this account.
// (glm-4.6 is only served on some GLM plans; opt in via env once you've confirmed
// your key has access.) Titles always use the cheap/fast model.
export const COACH_MODEL = process.env.GLM_COACH_MODEL ?? "glm-4-flash";
const TITLE_MODEL = process.env.GLM_TITLE_MODEL ?? "glm-4-flash";
// Slightly warm so coaching reads human, not templated — but low enough to keep
// the numbers/advice grounded in the data we feed it.
export const COACH_TEMPERATURE = 0.6;

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

export async function buildCoachContext(userId: string): Promise<string> {
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

// ── Coach agent: tool-calling loop ───────────────────────────────────────────
// Coaches get an *agentic* AveraAI: instead of stuffing the whole roster into
// the prompt and only being able to talk, the model can call tools to look up a
// specific athlete on demand, run the what-if injury simulator, and take real
// actions on the coach's behalf (message the team, message one athlete, leave
// a note on an alert, assign a training plan).
// All tools are scoped to the coach's own team — a tool can never touch an
// athlete the coach doesn't coach.

import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";

export const COACH_AGENT_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "list_team_athletes",
      description:
        "List every athlete on the coach's team with their computed training metrics (weekly miles, ACWR, flags) and active injury-alert count. Call this first when you need an overview or need to find who to act on.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "get_athlete_detail",
      description:
        "Get a detailed breakdown for one athlete: full training metrics, recent runs, active injury alerts (with their alert IDs and body parts, needed for comment_on_alert), and training plans. Use when the coach asks about a specific athlete or you need alert IDs.",
      parameters: {
        type: "object",
        properties: {
          athleteName: { type: "string", description: "The athlete's name, as shown in list_team_athletes." },
        },
        required: ["athleteName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_injury_what_if",
      description:
        "Run the injury-risk what-if simulator for one athlete — models how their injury risk changes if they run more/less this week or take rest days. Use when reasoning about load changes before advising the coach.",
      parameters: {
        type: "object",
        properties: {
          athleteName: { type: "string", description: "The athlete's name." },
        },
        required: ["athleteName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_team_broadcast",
      description:
        "Send a message to EVERY athlete on the team as an in-app notification. This is a real action visible to real athletes — only use it when the coach clearly asked to message the team. State what you sent afterward.",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string", description: "The message body (max 1000 chars)." },
        },
        required: ["message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "comment_on_alert",
      description:
        "Leave a coaching note on a specific athlete's injury alert. The athlete is notified. Get the alertId from get_athlete_detail first. Only use when the coach asked to leave a note or reach out about an alert.",
      parameters: {
        type: "object",
        properties: {
          alertId: { type: "number", description: "The injury alert's ID, from get_athlete_detail." },
          content: { type: "string", description: "The note to leave for the athlete." },
        },
        required: ["alertId", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_team_plan",
      description:
        "Create and immediately assign a training plan to ONE named athlete on the coach's team. This is a REAL action — it creates a live plan the athlete sees right away, same as building one on the Plans page. Only call this after the coach has explicitly confirmed a proposed plan (e.g. 'go ahead', 'apply it', 'assign that') — never on the first mention of a plan, since you should propose it in your text reply first and let the coach confirm.",
      parameters: {
        type: "object",
        properties: {
          athleteName: { type: "string", description: "The athlete's name, as shown in list_team_athletes." },
          name: { type: "string", description: "Short plan name, e.g. 'Marathon Recovery & Rebuild'." },
          goal: { type: "string", description: "The plan's goal." },
          startDate: { type: "string", description: "Start date, YYYY-MM-DD." },
          endDate: { type: "string", description: "End date, YYYY-MM-DD." },
          weeklyMileage: { type: "number", description: "Target weekly mileage." },
          sessions: {
            type: "array",
            description: "The plan's sessions. If you already described specific sessions in the conversation, use those; otherwise a reasonable weekly structure is generated for you if omitted.",
            items: {
              type: "object",
              properties: {
                weekNumber: { type: "number", description: "1-indexed week within the plan." },
                dayOfWeek: { type: "number", description: "1 (Monday) through 7 (Sunday)." },
                sessionType: { type: "string", description: "e.g. easy_run, tempo_run, long_run, interval, rest, cross_training." },
                description: { type: "string" },
                distanceMiles: { type: "number" },
                durationMinutes: { type: "number" },
              },
              required: ["weekNumber", "dayOfWeek", "sessionType", "description"],
            },
          },
        },
        required: ["athleteName", "name", "goal", "startDate", "endDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_team_plan",
      description:
        "Adjust an athlete's EXISTING training plan — weekly mileage, status (active/paused), or dates. This is a REAL action, applied immediately, no separate confirmation step needed beyond the coach's instruction. Get the planId from get_athlete_detail first. Prefer this over create_team_plan when the athlete already has an active plan that just needs adjusting (e.g. cutting volume after an injury flag) rather than creating a second, overlapping plan.",
      parameters: {
        type: "object",
        properties: {
          planId: { type: "number", description: "The plan's ID, from get_athlete_detail." },
          weeklyMileage: { type: "number", description: "New target weekly mileage." },
          status: { type: "string", enum: ["active", "paused"], description: "New plan status." },
          startDate: { type: "string", description: "New start date, YYYY-MM-DD." },
          endDate: { type: "string", description: "New end date, YYYY-MM-DD." },
        },
        required: ["planId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "message_athlete",
      description:
        "Send a direct 1:1 message to ONE specific named athlete (not the whole team, and not tied to an injury alert). The athlete is notified and sees it in their message thread with you. Only use when the coach clearly asked to tell/message/ask/remind one particular athlete something.",
      parameters: {
        type: "object",
        properties: {
          athleteName: { type: "string", description: "The athlete's name, as shown in list_team_athletes." },
          content: { type: "string", description: "The message body (max 1000 chars)." },
        },
        required: ["athleteName", "content"],
      },
    },
  },
];

// Resolve the coach's team + roster once, with a name→userId lookup that
// tolerates partial/case-insensitive matches from the model.
export async function loadCoachRoster(coachUserId: string) {
  const team = await getTeamForCoach(coachUserId);
  if (!team) return null;
  const memberships = await db
    .select({ athleteUserId: teamMembershipsTable.athleteUserId })
    .from(teamMembershipsTable)
    .where(eq(teamMembershipsTable.teamId, team.id));
  const memberIds = memberships.map((m) => m.athleteUserId);
  if (memberIds.length === 0) return { team, roster: [] as { userId: string; name: string }[] };
  const [profiles, users] = await Promise.all([
    db.select().from(athleteProfileTable).where(inArray(athleteProfileTable.userId, memberIds)),
    db.select().from(usersTable).where(inArray(usersTable.id, memberIds)),
  ]);
  const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
  const userByUser = new Map(users.map((u) => [u.id, u]));
  const roster = memberIds.map((id) => {
    const p = profileByUser.get(id);
    const u = userByUser.get(id);
    const name = (p?.name ?? `${u?.firstName ?? ""} ${u?.lastName ?? ""}`.trim()) || "Athlete";
    return { userId: id, name };
  });
  return { team, roster };
}

function resolveAthlete(roster: { userId: string; name: string }[], athleteName: string): { userId: string; name: string } | null {
  const q = athleteName.trim().toLowerCase();
  return (
    roster.find((r) => r.name.toLowerCase() === q) ??
    roster.find((r) => r.name.toLowerCase().includes(q) || q.includes(r.name.toLowerCase())) ??
    null
  );
}

async function athleteMetricsSummary(userId: string) {
  const activities = await db
    .select()
    .from(activitiesTable)
    .where(eq(activitiesTable.userId, userId))
    .orderBy(desc(activitiesTable.activityDate))
    .limit(40);
  return computeTrainingMetrics(activities as ActivityRow[]);
}

export type CoachToolResult = { ok: boolean; action?: string; [k: string]: unknown };

// Executes one tool call. Every path is scoped to `roster` (the coach's own
// team), so the model can't reach outside it even if it invents a name/ID.
export async function executeCoachTool(
  coachUserId: string,
  team: typeof teamsTable.$inferSelect,
  roster: { userId: string; name: string }[],
  name: string,
  args: Record<string, unknown>,
  actor: "coach" | "suro" = "coach",
): Promise<CoachToolResult> {
  switch (name) {
    case "list_team_athletes": {
      const athletes = await Promise.all(
        roster.map(async ({ userId, name: athName }) => {
          const [met, alerts] = await Promise.all([
            athleteMetricsSummary(userId),
            db
              .select({ id: injuryAlertsTable.id })
              .from(injuryAlertsTable)
              .where(and(eq(injuryAlertsTable.userId, userId), eq(injuryAlertsTable.acknowledged, false))),
          ]);
          return {
            name: athName,
            weeklyMiles: met.hasData ? met.weeklyMiles[met.weeklyMiles.length - 1] : 0,
            acwr: met.acwr,
            flags: met.flags,
            activeAlerts: alerts.length,
          };
        }),
      );
      return { ok: true, team: team.name, athletes };
    }
    case "get_athlete_detail": {
      const athlete = resolveAthlete(roster, String(args.athleteName ?? ""));
      if (!athlete) return { ok: false, error: `No athlete named "${args.athleteName}" on your team.` };
      const [met, alerts, plans] = await Promise.all([
        athleteMetricsSummary(athlete.userId),
        db
          .select()
          .from(injuryAlertsTable)
          .where(and(eq(injuryAlertsTable.userId, athlete.userId), eq(injuryAlertsTable.acknowledged, false)))
          .orderBy(desc(injuryAlertsTable.createdAt)),
        db
          .select()
          .from(trainingPlansTable)
          .where(eq(trainingPlansTable.userId, athlete.userId))
          .orderBy(desc(trainingPlansTable.createdAt)),
      ]);
      return {
        ok: true,
        name: athlete.name,
        metrics: formatMetricsBlock(met),
        alerts: alerts.map((a) => ({ id: a.id, bodyPart: a.bodyPart, riskLevel: a.riskLevel, message: a.message })),
        plans: plans.map((p) => ({ id: p.id, name: p.name, goal: p.goal, status: p.status, weeklyMileage: p.weeklyMileage ? Number(p.weeklyMileage) : null, startDate: p.startDate, endDate: p.endDate })),
      };
    }
    case "run_injury_what_if": {
      const athlete = resolveAthlete(roster, String(args.athleteName ?? ""));
      if (!athlete) return { ok: false, error: `No athlete named "${args.athleteName}" on your team.` };
      const scenarios = await computeWhatIfScenarios(athlete.userId);
      return { ok: true, name: athlete.name, scenarios };
    }
    case "send_team_broadcast": {
      const message = String(args.message ?? "").trim();
      if (!message) return { ok: false, error: "Message is empty." };
      if (message.length > 1000) return { ok: false, error: "Message must be 1000 characters or fewer." };
      if (roster.length === 0) return { ok: false, error: "Your team has no athletes to message yet." };
      await db.insert(notificationsTable).values(
        roster.map((r) => ({
          userId: r.userId,
          type: "team_broadcast",
          title: actor === "suro" ? `Message from Suro (${team.name})` : `Message from ${team.name}`,
          message,
        })),
      );
      return { ok: true, action: "broadcast", recipientCount: roster.length, message };
    }
    case "comment_on_alert": {
      const alertId = Number(args.alertId);
      const content = String(args.content ?? "").trim();
      if (!Number.isInteger(alertId)) return { ok: false, error: "alertId must be a number." };
      if (!content) return { ok: false, error: "Comment content is empty." };
      const [alert] = await db.select().from(injuryAlertsTable).where(eq(injuryAlertsTable.id, alertId)).limit(1);
      if (!alert || !alert.userId) return { ok: false, error: "Alert not found." };
      // Authorization: the alert must belong to an athlete on THIS coach's team.
      if (!roster.some((r) => r.userId === alert.userId)) {
        return { ok: false, error: "That alert doesn't belong to an athlete on your team." };
      }
      // injury_alert_comments has no source column — tag Suro's authorship in
      // the content itself rather than adding a migration for it.
      const commentContent = actor === "suro" ? `[Suro] ${content}` : content;
      const [comment] = await db
        .insert(injuryAlertCommentsTable)
        .values({ alertId, authorUserId: coachUserId, authorRole: "coach", content: commentContent })
        .returning();
      await db.insert(notificationsTable).values({
        userId: alert.userId,
        type: "alert_comment",
        title: actor === "suro" ? "Suro left a note" : "Your coach left a note",
        message: `${actor === "suro" ? "Suro" : "Your coach"} commented on your ${alert.bodyPart} alert: "${content}"`,
      });
      return { ok: true, action: "alert_comment", commentId: comment.id, bodyPart: alert.bodyPart };
    }
    case "message_athlete": {
      const athlete = resolveAthlete(roster, String(args.athleteName ?? ""));
      if (!athlete) return { ok: false, error: `No athlete named "${args.athleteName}" on your team.` };
      const content = String(args.content ?? "").trim();
      if (!content) return { ok: false, error: "Message is empty." };
      if (content.length > 1000) return { ok: false, error: "Message must be 1000 characters or fewer." };
      const [message] = await db
        .insert(directMessagesTable)
        .values({ athleteUserId: athlete.userId, authorUserId: coachUserId, authorRole: "coach", source: actor, content })
        .returning();
      await db.insert(notificationsTable).values({
        userId: athlete.userId,
        type: "direct_message",
        title: actor === "suro" ? "New message (from Suro)" : `Message from ${team.name}`,
        message: content,
      });
      return { ok: true, action: "direct_message", messageId: message.id, athleteName: athlete.name };
    }
    case "create_team_plan": {
      const athlete = resolveAthlete(roster, String(args.athleteName ?? ""));
      if (!athlete) return { ok: false, error: `No athlete named "${args.athleteName}" on your team.` };
      const planName = String(args.name ?? "").trim();
      const goal = String(args.goal ?? "").trim();
      const startDate = String(args.startDate ?? "");
      const endDate = String(args.endDate ?? "");
      if (!planName || !goal) return { ok: false, error: "Plan name and goal are required." };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        return { ok: false, error: "startDate and endDate must be YYYY-MM-DD." };
      }

      const insert: typeof trainingPlansTable.$inferInsert = {
        userId: athlete.userId,
        createdBy: coachUserId,
        name: planName,
        goal,
        startDate,
        endDate,
        status: "active",
        source: actor === "suro" ? "suro" : "ai",
      };
      if (typeof args.weeklyMileage === "number") insert.weeklyMileage = String(args.weeklyMileage);

      const [plan] = await db.insert(trainingPlansTable).values(insert).returning();

      const rawSessions = Array.isArray(args.sessions) ? (args.sessions as Record<string, unknown>[]) : [];
      let sessions: (typeof planSessionsTable.$inferInsert)[];
      if (rawSessions.length > 0) {
        sessions = rawSessions
          .filter((s) => Number.isFinite(Number(s.weekNumber)) && Number.isFinite(Number(s.dayOfWeek)) && typeof s.sessionType === "string" && typeof s.description === "string")
          .map((s) => ({
            planId: plan.id,
            weekNumber: Number(s.weekNumber),
            dayOfWeek: Number(s.dayOfWeek),
            sessionType: String(s.sessionType),
            description: String(s.description),
            distanceKm: typeof s.distanceMiles === "number" ? String(Math.round(s.distanceMiles * 1.60934 * 100) / 100) : undefined,
            durationMinutes: typeof s.durationMinutes === "number" ? s.durationMinutes : undefined,
          }));
      } else {
        // No explicit sessions from the model — generate a reasonable default
        // weekly structure, same template used by the manual Plans page.
        const start = new Date(startDate);
        const end = new Date(endDate);
        const weeks = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000)));
        const templates = [
          { dayOfWeek: 1, sessionType: "easy_run", description: "Easy recovery run", distanceKm: "5.00" },
          { dayOfWeek: 3, sessionType: "tempo_run", description: "Tempo run at comfortably hard pace", distanceKm: "8.00" },
          { dayOfWeek: 6, sessionType: "long_run", description: "Long slow distance run", distanceKm: "14.00" },
        ];
        sessions = [];
        for (let w = 1; w <= Math.min(weeks, 12); w++) {
          for (const t of templates) sessions.push({ planId: plan.id, weekNumber: w, ...t });
        }
      }
      if (sessions.length > 0) await db.insert(planSessionsTable).values(sessions);

      await db.insert(notificationsTable).values({
        userId: athlete.userId,
        type: "training_plan",
        title: "New training plan",
        message: `${actor === "suro" ? "Suro" : "Your coach"} assigned you a new plan: "${planName}".`,
      });

      return { ok: true, action: "create_plan", planId: plan.id, athleteName: athlete.name, planName, sessionCount: sessions.length };
    }
    case "update_team_plan": {
      const planId = Number(args.planId);
      if (!Number.isInteger(planId)) return { ok: false, error: "planId must be a number." };
      const [existing] = await db.select().from(trainingPlansTable).where(eq(trainingPlansTable.id, planId)).limit(1);
      if (!existing || !existing.userId) return { ok: false, error: "Plan not found." };
      // Authorization: the plan must belong to an athlete on THIS coach's team.
      if (!roster.some((r) => r.userId === existing.userId)) {
        return { ok: false, error: "That plan doesn't belong to an athlete on your team." };
      }

      const update: Partial<typeof trainingPlansTable.$inferInsert> = {};
      if (typeof args.weeklyMileage === "number") update.weeklyMileage = String(args.weeklyMileage);
      if (args.status === "active" || args.status === "paused") update.status = args.status;
      if (typeof args.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.startDate)) update.startDate = args.startDate;
      if (typeof args.endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.endDate)) update.endDate = args.endDate;
      if (Object.keys(update).length === 0) return { ok: false, error: "Nothing to update — provide weeklyMileage, status, startDate, or endDate." };

      const [updated] = await db.update(trainingPlansTable).set(update).where(eq(trainingPlansTable.id, planId)).returning();

      const athleteName = roster.find((r) => r.userId === existing.userId)?.name ?? "the athlete";
      const changeSummary = Object.entries(update)
        .map(([key, val]) => `${key}: ${val}`)
        .join(", ");
      await db.insert(notificationsTable).values({
        userId: existing.userId,
        type: "training_plan",
        title: "Your plan was updated",
        message: `${actor === "suro" ? "Suro" : "Your coach"} updated "${existing.name}" — ${changeSummary}.`,
      });

      return { ok: true, action: "update_plan", planId: updated.id, athleteName, changeSummary };
    }
    default:
      return { ok: false, error: `Unknown tool: ${name}` };
  }
}

const COACH_AGENT_PROMPT = `${COACH_ADVISOR_PROMPT}

TOOLS & ACTIONS
- You have tools to look up athletes on demand and to take real actions. Prefer calling a tool over guessing.
- Use list_team_athletes for an overview, get_athlete_detail for one athlete's specifics (and to get alert IDs), and run_injury_what_if to reason about load changes.
- send_team_broadcast, comment_on_alert, message_athlete, create_team_plan, and update_team_plan take REAL actions visible to real athletes. Only call them when the coach clearly asked you to. Use message_athlete for something directed at ONE named athlete outside the context of a specific alert; use comment_on_alert when it's about a specific alert; use send_team_broadcast only for the whole team. After taking an action, tell the coach plainly what you did.
- For training plans: propose the change in your text reply first (what you'd create or adjust, and why) and wait for the coach to confirm ("go ahead", "apply it", "assign that") before calling create_team_plan or update_team_plan. Never call either on the first mention of a plan. If the athlete already has an active plan, prefer update_team_plan (adjust mileage/status/dates) over creating a second, overlapping plan — call get_athlete_detail first to get the existing planId.
- When you don't need to act — the coach just wants analysis or advice — answer directly without calling write tools.`;

const COACH_AGENT_MAX_STEPS = 6;

// Runs the coach agent loop. Returns the final assistant text plus any real
// actions taken, so the route can report them in the SSE done event.
async function runCoachAgent(
  client: OpenAI,
  coachUserId: string,
  chatMessages: { role: "user" | "assistant"; content: string }[],
): Promise<{ text: string; actions: string[] }> {
  const loaded = await loadCoachRoster(coachUserId);
  const messagesForModel: ChatCompletionMessageParam[] = [
    { role: "system", content: `${RESPONSE_STRATEGY}\n\n${COACH_AGENT_PROMPT}` },
    ...chatMessages,
  ];
  const actions: string[] = [];

  for (let step = 0; step < COACH_AGENT_MAX_STEPS; step++) {
    const completion = await client.chat.completions.create({
      model: COACH_MODEL,
      temperature: COACH_TEMPERATURE,
      max_tokens: 2048,
      messages: messagesForModel,
      tools: COACH_AGENT_TOOLS,
    });
    const choice = completion.choices[0]?.message;
    if (!choice) break;
    const toolCalls = choice.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return { text: choice.content ?? "", actions };
    }
    // Append the assistant's tool-call turn, then each tool result.
    messagesForModel.push({ role: "assistant", content: choice.content ?? "", tool_calls: toolCalls });
    for (const call of toolCalls) {
      if (call.type !== "function") continue;
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        parsedArgs = {};
      }
      let result: CoachToolResult;
      if (!loaded) {
        result = { ok: false, error: "You don't have a team yet, so there are no athletes to act on." };
      } else {
        try {
          result = await executeCoachTool(coachUserId, loaded.team, loaded.roster, call.function.name, parsedArgs);
        } catch (err) {
          logger.error({ err, tool: call.function.name }, "coach agent tool failed");
          result = { ok: false, error: "That action failed unexpectedly." };
        }
      }
      if (result.ok && result.action) actions.push(result.action);
      messagesForModel.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }
  // Ran out of steps — ask the model for a final answer with no more tools.
  const finalCompletion = await client.chat.completions.create({
    model: COACH_MODEL,
    temperature: COACH_TEMPERATURE,
    max_tokens: 2048,
    messages: messagesForModel,
  });
  return { text: finalCompletion.choices[0]?.message?.content ?? "", actions };
}

// ── Voice input ──────────────────────────────────────────────────────────────
// Transcribes a recorded voice message into text for the AveraAI composer.
// Expects the raw audio bytes as the request body (see app.ts for the
// route-specific raw body parser — this can't go through express.json()).

router.post("/openai/transcribe", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  // Real per-use cost (a paid transcription API call), so this is an Athlete
  // Pro perk rather than something free accounts get unlimited use of.
  if (!(await hasActiveAccess(req.user.id))) {
    res.status(402).json({
      error: "Voice input is an Athlete Pro perk. Upgrade to talk to AveraAI instead of typing.",
      code: "subscription_required",
    });
    return;
  }
  if (!transcriptionClient) {
    res.status(503).json({
      error: "Voice input is not available. Please contact support.",
      code: "transcription_not_configured",
    });
    return;
  }

  const buffer = req.body;
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    res.status(400).json({ error: "No audio was received." });
    return;
  }

  try {
    const contentType = req.headers["content-type"] ?? "";
    const file = await toFile(buffer, `voice-input.${audioExtensionFor(contentType)}`);
    const transcription = await transcriptionClient.audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe",
    });
    res.json({ text: transcription.text });
  } catch (err) {
    logger.error(
      { userId: req.user.id, err: err instanceof Error ? err.message : String(err) },
      "Voice transcription failed",
    );
    res.status(500).json({ error: "Couldn't transcribe that. Please try again or type your message." });
  }
});

// ── Free-tier AveraAI usage ──────────────────────────────────────────────────
// Lets the frontend show "X of 20 messages left this month" and warn before
// the user actually hits the 402, rather than only reacting to a failed send.

router.get("/openai/usage", async (req: Request, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = req.user.id;
  const isActive = await hasActiveAccess(userId);
  const used = isActive ? 0 : await countUserMessagesThisMonth(userId);
  res.json({
    isActive,
    used,
    limit: isActive ? null : FREE_MONTHLY_AI_MESSAGES,
    remaining: isActive ? null : Math.max(0, FREE_MONTHLY_AI_MESSAGES - used),
  });
});

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

  if (!(await hasActiveAccess(userId))) {
    const usedThisMonth = await countUserMessagesThisMonth(userId);
    if (usedThisMonth >= FREE_MONTHLY_AI_MESSAGES) {
      res.status(402).json({
        error: `You've used all ${FREE_MONTHLY_AI_MESSAGES} free AveraAI messages this month. Upgrade for unlimited access.`,
        code: "ai_message_limit_reached",
      });
      return;
    }
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
    db.select({
      selectedCoach: athleteProfileTable.selectedCoach,
      userRole: athleteProfileTable.userRole,
      agenticModeEnabled: athleteProfileTable.agenticModeEnabled,
    })
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

  // Coaches get the agentic path: a tool-calling loop that can look up athletes
  // and take real actions. It runs non-streaming (tool calls interleave with
  // model turns), then we emit the final answer as a single SSE chunk so the
  // existing client — which just accumulates `content` events — needs no change.
  let coachAgentHandled = false;
  const agentActions: string[] = [];
  if (profile?.userRole === "coach" && profile?.agenticModeEnabled !== false) {
    coachAgentHandled = true;
    try {
      const { text, actions } = await runCoachAgent(client, userId, chatMessages);
      fullResponse = text || "I wasn't able to put together a response — try rephrasing?";
      agentActions.push(...actions);
    } catch (err) {
      logger.error({ err, userId }, "coach agent failed; falling back to plain reply");
      fullResponse = "Sorry, I hit an error working through that. Please try again.";
    }
    res.write(`data: ${JSON.stringify({ content: fullResponse })}\n\n`);
  }

  if (!planCreatedId && !coachAgentHandled) {
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
  if (agentActions.length > 0) doneEvent.actionsTaken = agentActions;
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

    // Capped on the athlete's own free/Pro status, since the plan belongs to
    // (and counts against) their account — not the coach's.
    if (!(await hasActiveAccess(athleteUserId))) {
      const aiPlanCount = await countAiPlans(athleteUserId);
      if (aiPlanCount >= FREE_AI_PLAN_LIMIT) {
        res.status(402).json({
          error: `This athlete has used all ${FREE_AI_PLAN_LIMIT} free AveraAI-designed plans. They'd need to upgrade for unlimited.`,
          code: "ai_plan_limit_reached",
        });
        return;
      }
    }

    const [plan] = await db.insert(trainingPlansTable).values({
      userId: athleteUserId,
      // The coach authored this plan's content — the athlete can only
      // suggest changes to it, not edit it directly.
      createdBy: userId,
      source: "ai",
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

    if (!(await hasActiveAccess(userId))) {
      const aiPlanCount = await countAiPlans(userId);
      if (aiPlanCount >= FREE_AI_PLAN_LIMIT) {
        res.status(402).json({
          error: `You've used all ${FREE_AI_PLAN_LIMIT} free AveraAI-designed plans. Upgrade for unlimited.`,
          code: "ai_plan_limit_reached",
        });
        return;
      }
    }

    const [plan] = await db.insert(trainingPlansTable).values({
      userId,
      createdBy: userId,
      source: "ai",
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
