import { Router, type Request, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  conversations,
  messages,
  athleteProfileTable,
  activitiesTable,
  trainingPlansTable,
  injuryAlertsTable,
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

const COACH_ADVISOR_PROMPT = `You are AveraAI, an expert AI assistant for running coaches in the Thrive app. You help coaches manage their teams, design training programs, interpret athlete data, and prevent overuse injuries across a squad.

Your focus areas:
- Team periodization: building mesocycles, tapering strategies, and season planning for groups
- Interpreting team metrics: HRV trends, training load distribution, acute:chronic workload ratios
- Flagging athletes at risk before problems become injuries — explain why and what to adjust
- Differentiating training by fitness level, event specialty (sprints, middle distance, XC, marathon)
- Practical recommendations coaches can act on before the next practice
- Athlete communication strategies: how to talk to athletes about rest, load modification, injury risk
- Race preparation, meet scheduling, and peaking strategies

When a coach describes a team situation or individual athlete concern, ask clarifying questions about their event, weekly mileage, and recent training history if relevant. Be direct, specific, and coach-to-coach in tone. Coaches are experienced — don't over-explain basics.`;

const COACH_PROMPTS: Record<string, string> = {
  avera: `You are Avera, a balanced AI running coach in the Thrive app. You specialize in injury prevention, smart training progression, and long-term athlete development. Your tone is warm, analytical, and encouraging.

- Provide evidence-based, practical training advice
- Identify injury risks early by analyzing training load patterns
- Tailor every recommendation to the athlete's fitness level, goals, and recovery status
- Be concise but thorough — athletes are busy people
- Use running metrics (pace, HR zones, mileage, RPE) naturally
- Explain the biomechanical or physiological reason behind any injury risk
- Suggest concrete, actionable steps

Lead with the most important information. Keep responses focused.`,

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
  if (coach && COACH_PROMPTS[coach]) return COACH_PROMPTS[coach];
  return COACH_PROMPTS.avera!;
}

function serializeConversation(c: typeof conversations.$inferSelect) {
  return { ...c, createdAt: c.createdAt.toISOString() };
}

function serializeMessage(m: typeof messages.$inferSelect) {
  return { ...m, createdAt: m.createdAt.toISOString() };
}

async function buildUserContext(userId: string): Promise<string> {
  const [profileRows, recentActivities, activePlan, openAlerts] = await Promise.all([
    db
      .select()
      .from(athleteProfileTable)
      .where(eq(athleteProfileTable.userId, userId))
      .limit(1),
    db
      .select()
      .from(activitiesTable)
      .where(eq(activitiesTable.userId, userId))
      .orderBy(desc(activitiesTable.activityDate))
      .limit(10),
    db
      .select()
      .from(trainingPlansTable)
      .where(and(eq(trainingPlansTable.userId, userId), eq(trainingPlansTable.status, "active")))
      .limit(1),
    db
      .select()
      .from(injuryAlertsTable)
      .where(and(eq(injuryAlertsTable.userId, userId), eq(injuryAlertsTable.acknowledged, false)))
      .limit(5),
  ]);

  const profile = profileRows[0];
  if (!profile) return "";

  const lines: string[] = [];
  lines.push("=== ATHLETE PROFILE ===");
  lines.push(
    [
      profile.name ? `Name: ${profile.name}` : null,
      profile.age ? `Age: ${profile.age}` : null,
      `Fitness: ${profile.fitnessLevel}`,
      profile.primaryGoal ? `Goal: ${profile.primaryGoal}` : null,
      profile.weeklyMileageGoal ? `Weekly target: ${Number(profile.weeklyMileageGoal)}mi` : null,
      profile.hrv ? `HRV: ${Number(profile.hrv)}ms` : null,
      profile.restingHeartRate ? `Resting HR: ${profile.restingHeartRate}bpm` : null,
    ]
      .filter(Boolean)
      .join(" | "),
  );

  if (recentActivities.length > 0) {
    lines.push("\nRecent Activities (newest first):");
    for (const a of recentActivities) {
      const parts = [
        a.activityDate,
        a.type.replace(/_/g, " "),
        a.distanceKm ? `${Number(a.distanceKm).toFixed(1)}mi` : null,
        a.durationMinutes ? `${a.durationMinutes}min` : null,
        a.avgHeartRate ? `HR ${a.avgHeartRate}` : null,
        a.perceivedEffort ? `RPE ${a.perceivedEffort}/10` : null,
        a.notes ? `"${a.notes}"` : null,
      ]
        .filter(Boolean)
        .join(" | ");
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
    const fallbackContent = "AveraAI is not yet configured. Please add your GLM_API_KEY to Replit Secrets.";
    await db.insert(messages).values({ conversationId: conv.id, role: "assistant", content: fallbackContent });
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.write(`data: ${JSON.stringify({ content: fallbackContent })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    return;
  }

  const [historyRows, profileRows, userContext] = await Promise.all([
    db.select().from(messages).where(eq(messages.conversationId, conv.id)).orderBy(messages.createdAt),
    db.select({ selectedCoach: athleteProfileTable.selectedCoach, userRole: athleteProfileTable.userRole })
      .from(athleteProfileTable)
      .where(eq(athleteProfileTable.userId, userId))
      .limit(1),
    buildUserContext(userId),
  ]);

  const chatMessages = historyRows.map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
  const profile = profileRows[0];
  const basePrompt = profile?.userRole === "coach"
    ? COACH_ADVISOR_PROMPT
    : getSystemPrompt(profile?.selectedCoach);
  const systemPrompt = userContext ? `${userContext}\n${basePrompt}` : basePrompt;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";
  try {
    const stream = await client.chat.completions.create({
      model: "glm-4-flash",
      max_tokens: 2048,
      messages: [{ role: "system", content: systemPrompt }, ...chatMessages],
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
    const errMsg = "Sorry, I encountered an error. Please try again.";
    fullResponse = errMsg;
    res.write(`data: ${JSON.stringify({ content: errMsg })}\n\n`);
  }

  await db.insert(messages).values({ conversationId: conv.id, role: "assistant", content: fullResponse });
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
