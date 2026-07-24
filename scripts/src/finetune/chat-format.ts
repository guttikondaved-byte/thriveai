// Shared types + helpers for the fine-tuning chat format described in
// ./README.md. Used by both prepare-dataset.ts (external datasets) and
// export-conversations.ts (real AveraAI conversations from Postgres).

import { writeFileSync } from "node:fs";

export type Role = "system" | "user" | "assistant";
export type ChatMessage = { role: Role; content: string };
export type ChatExample = { messages: ChatMessage[] };

export const DEFAULT_SYSTEM_PROMPT =
  "You are AveraAI, an expert running coach. Give specific, data-grounded training advice.";

export function injectSystemPrompt(example: ChatExample, systemPrompt: string): ChatExample {
  if (example.messages[0]?.role === "system") return example;
  return { messages: [{ role: "system", content: systemPrompt }, ...example.messages] };
}

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export function validate(example: ChatExample): ValidationResult {
  const { messages } = example;
  if (messages.length < 2) return { ok: false, reason: "fewer than 2 messages" };
  if (messages.some(m => !m.content || !m.content.trim())) {
    return { ok: false, reason: "empty message content" };
  }
  if (messages.some(m => !["system", "user", "assistant"].includes(m.role))) {
    return { ok: false, reason: "invalid role" };
  }

  const rest = messages[0].role === "system" ? messages.slice(1) : messages;
  if (rest.length === 0 || rest[rest.length - 1].role !== "assistant") {
    return { ok: false, reason: "last message isn't from the assistant" };
  }
  if (rest[0]?.role !== "user") {
    return { ok: false, reason: "first non-system message isn't from the user" };
  }
  for (let i = 1; i < rest.length; i++) {
    if (rest[i].role === rest[i - 1].role) {
      return { ok: false, reason: `consecutive ${rest[i].role} turns` };
    }
  }
  const extraSystem = messages.slice(1).some(m => m.role === "system");
  if (extraSystem) return { ok: false, reason: "system message not at the start" };

  return { ok: true };
}

export function estimateTokens(examples: ChatExample[]): number {
  // Rough heuristic (~4 chars/token in English) — good enough for a
  // ballpark before training, not for billing.
  const chars = examples.reduce(
    (sum, ex) => sum + ex.messages.reduce((s, m) => s + m.content.length, 0),
    0,
  );
  return Math.round(chars / 4);
}

export function roleCounts(examples: ChatExample[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const ex of examples) for (const m of ex.messages) counts[m.role] = (counts[m.role] ?? 0) + 1;
  return counts;
}

export function writeJsonl(path: string, examples: ChatExample[]): void {
  writeFileSync(path, examples.map(ex => JSON.stringify(ex)).join("\n") + (examples.length ? "\n" : ""));
}
