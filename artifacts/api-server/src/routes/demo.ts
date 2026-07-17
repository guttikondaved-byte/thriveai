import { Router, type IRouter } from "express";
import { openaiClient, COACH_MODEL, COACH_TEMPERATURE } from "./openai";
import { logger } from "../lib/logger";

// Unauthenticated chat endpoint backing the marketing-site demo (no login,
// no real user/team) — the frontend builds the system prompt from the static
// demo fixture (see stride-iq/src/lib/demoData.ts) and sends it here so the
// demo chat is answered by the real model instead of a canned keyword match.
// Real actions (messaging an athlete, assigning a plan) stay handled locally
// in the frontend against demoStore — this route is read-only conversation.

const router: IRouter = Router();

// Simple in-memory per-IP rate limit — good enough for a single Render
// instance and an anonymous, cost-bearing endpoint. Not distributed-safe,
// but a demo doesn't need that; it just needs to not be free to hammer.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 20;
const hits = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Periodic cleanup so `hits` doesn't grow unbounded over a long-running process.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of hits) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) hits.delete(ip);
  }
}, RATE_LIMIT_WINDOW_MS).unref();

const MAX_SYSTEM_PROMPT_LEN = 6000;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_LEN = 2000;

router.post("/demo/chat", async (req, res): Promise<void> => {
  if (!openaiClient) {
    res.status(503).json({ error: "Demo chat isn't configured." });
    return;
  }

  const ip = req.ip ?? "unknown";
  if (isRateLimited(ip)) {
    res.status(429).json({ error: "Too many demo messages — try again in a few minutes." });
    return;
  }

  const { systemPrompt, messages } = req.body ?? {};
  if (typeof systemPrompt !== "string" || systemPrompt.length === 0 || systemPrompt.length > MAX_SYSTEM_PROMPT_LEN) {
    res.status(400).json({ error: "Invalid systemPrompt." });
    return;
  }
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    res.status(400).json({ error: "Invalid messages." });
    return;
  }
  const cleanMessages: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of messages) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string" || m.content.length > MAX_MESSAGE_LEN) {
      res.status(400).json({ error: "Invalid message in messages." });
      return;
    }
    cleanMessages.push({ role: m.role, content: m.content });
  }

  try {
    const completion = await openaiClient.chat.completions.create({
      model: COACH_MODEL,
      temperature: COACH_TEMPERATURE,
      max_tokens: 600,
      messages: [{ role: "system", content: systemPrompt }, ...cleanMessages],
    });
    const reply = completion.choices[0]?.message?.content ?? "";
    res.json({ reply });
  } catch (err) {
    logger.error({ err }, "Demo chat completion failed");
    res.status(502).json({ error: "Demo chat is temporarily unavailable." });
  }
});

export default router;
