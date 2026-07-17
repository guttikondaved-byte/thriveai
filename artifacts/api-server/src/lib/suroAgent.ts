import { eq } from "drizzle-orm";
import { db, teamsTable } from "@workspace/db";
import {
  openaiClient,
  COACH_MODEL,
  COACH_TEMPERATURE,
  COACH_AGENT_TOOLS,
  loadCoachRoster,
  executeCoachTool,
  buildCoachContext,
  type CoachToolResult,
} from "../routes/openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { logger } from "./logger";

// Suro is an autonomous version of the coach agent: instead of a coach typing
// a question and waiting for AveraAI to answer, Suro reviews a team's roster
// on its own (see index.ts for the interval that triggers this) and decides
// for itself whether anything warrants a real action — no chat, no per-action
// approval. That's a meaningfully higher-trust surface than AveraAI's normal
// chat-triggered actions, so this stays deliberately conservative: a tight
// write-action cap per run, and a system prompt that pushes it toward
// "usually nothing" rather than acting on every athlete every time.

const SURO_MAX_STEPS = 6;
const SURO_MAX_WRITE_ACTIONS = 2;

const WRITE_TOOL_NAMES = new Set(["send_team_broadcast", "comment_on_alert", "message_athlete", "create_team_plan"]);

const SURO_SYSTEM_PROMPT = `You are Suro, an autonomous agent reviewing a running team's roster on a schedule — nobody is chatting with you right now, so there is no one to ask for clarification and no one to confirm a plan proposal before you act.

Be conservative. Most runs, the right outcome is to take NO action at all — only act when the data clearly warrants it (a new or worsening injury alert, a concerning HRV drop paired with a mileage jump, an athlete who has gone silent on a plan that needs adjusting). Do not message or comment on every athlete just because you can. Never assign a plan unless an athlete's data shows a real, specific need for one right now — don't invent plans for athletes who are training normally.

You may take at most ${SURO_MAX_WRITE_ACTIONS} real write actions this run (message_athlete, comment_on_alert, create_team_plan, send_team_broadcast). Use list_team_athletes and get_athlete_detail first to decide if anything is actually warranted. If nothing is, say so briefly and take no action — that is the expected, common outcome, not a failure.

When you do act, keep the message short, specific, and grounded in the athlete's actual numbers — never generic encouragement.`;

export interface SuroRunResult {
  ranAt: string;
  summary: string;
  actions: Array<{ tool: string; result: CoachToolResult }>;
}

export async function runSuroForTeam(team: typeof teamsTable.$inferSelect): Promise<SuroRunResult> {
  if (!openaiClient) {
    throw new Error("Suro requires GLM_API_KEY to be configured.");
  }

  const loaded = await loadCoachRoster(team.coachUserId);
  const ranAt = new Date().toISOString();
  if (!loaded || loaded.roster.length === 0) {
    await db.update(teamsTable).set({ suroLastRunAt: new Date() }).where(eq(teamsTable.id, team.id));
    return { ranAt, summary: "No athletes on the roster yet — nothing for Suro to review.", actions: [] };
  }

  const context = await buildCoachContext(team.coachUserId);
  const messagesForModel: ChatCompletionMessageParam[] = [
    { role: "system", content: `${context}\n${SURO_SYSTEM_PROMPT}` },
    { role: "user", content: "Review the roster now and take any action that's clearly warranted. If nothing is, say so." },
  ];

  const actions: Array<{ tool: string; result: CoachToolResult }> = [];
  let writeActionsTaken = 0;
  let summary = "";

  for (let step = 0; step < SURO_MAX_STEPS; step++) {
    const completion = await openaiClient.chat.completions.create({
      model: COACH_MODEL,
      temperature: COACH_TEMPERATURE,
      max_tokens: 1024,
      messages: messagesForModel,
      tools: COACH_AGENT_TOOLS,
    });
    const choice = completion.choices[0]?.message;
    if (!choice) break;
    const toolCalls = choice.tool_calls ?? [];
    if (toolCalls.length === 0) {
      summary = choice.content ?? "";
      break;
    }

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
      const isWrite = WRITE_TOOL_NAMES.has(call.function.name);
      if (isWrite && writeActionsTaken >= SURO_MAX_WRITE_ACTIONS) {
        result = { ok: false, error: `Write-action limit (${SURO_MAX_WRITE_ACTIONS} per run) reached — stop here and summarize instead.` };
      } else {
        try {
          result = await executeCoachTool(team.coachUserId, loaded.team, loaded.roster, call.function.name, parsedArgs, "suro");
          if (isWrite && result.ok) {
            writeActionsTaken++;
            actions.push({ tool: call.function.name, result });
          }
        } catch (err) {
          logger.error({ err, tool: call.function.name, teamId: team.id }, "Suro tool call failed");
          result = { ok: false, error: "Tool call failed unexpectedly." };
        }
      }

      messagesForModel.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  await db.update(teamsTable).set({ suroLastRunAt: new Date() }).where(eq(teamsTable.id, team.id));

  logger.info({ teamId: team.id, actionsTaken: actions.length, summary }, "Suro run complete");
  return { ranAt, summary: summary || (actions.length > 0 ? "Took action — see summary above." : "Reviewed the roster, nothing warranted action."), actions };
}

// Runs Suro for every opted-in team whose last run is stale enough — called
// on an interval from index.ts. Each team is isolated so one failure doesn't
// block the rest.
const SURO_RUN_INTERVAL_MS = 20 * 60 * 60 * 1000; // ~daily

export async function runSuroForEnabledTeams(): Promise<void> {
  const teams = await db.select().from(teamsTable).where(eq(teamsTable.suroEnabled, true));
  const cutoff = Date.now() - SURO_RUN_INTERVAL_MS;
  for (const team of teams) {
    if (team.suroLastRunAt && team.suroLastRunAt.getTime() > cutoff) continue;
    try {
      await runSuroForTeam(team);
    } catch (err) {
      logger.error({ err, teamId: team.id }, "Suro scheduled run failed");
    }
  }
}
