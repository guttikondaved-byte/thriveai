// Converts an external dataset (JSON array, JSONL, or CSV) into the
// fine-tuning chat format described in ./README.md, validating structure
// along the way. See README.md for the target schema and pipeline.
//
// Usage:
//   pnpm --filter @workspace/scripts prepare-finetune -- <input> <output.jsonl> [--system-prompt-file <path>]

import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";

type Role = "system" | "user" | "assistant";
type ChatMessage = { role: Role; content: string };
type ChatExample = { messages: ChatMessage[] };

const DEFAULT_SYSTEM_PROMPT =
  "You are AveraAI, an expert running coach. Give specific, data-grounded training advice.";

function parseArgs(argv: string[]) {
  const positional = argv.filter(a => !a.startsWith("--"));
  const [input, output] = positional;
  const systemPromptFlagIdx = argv.indexOf("--system-prompt-file");
  const systemPromptFile = systemPromptFlagIdx !== -1 ? argv[systemPromptFlagIdx + 1] : undefined;
  if (!input || !output) {
    console.error("Usage: prepare-finetune <input> <output.jsonl> [--system-prompt-file <path>]");
    process.exit(1);
  }
  return { input, output, systemPromptFile };
}

// Minimal RFC-4180-ish CSV parser: handles quoted fields, embedded commas,
// escaped quotes ("") and newlines inside quotes. Good enough for a data
// export; not a full spec implementation.
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  if (rows.length === 0) return [];
  const header = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => Object.fromEntries(header.map((h, idx) => [h, (r[idx] ?? "").trim()])));
}

// Accepts several common shapes and normalizes to ChatExample[]:
// - already-correct { messages: [...] }
// - { conversation: [...] } (alt key)
// - { system?, prompt|question|user, completion|answer|assistant } single-turn pairs
function normalizeRecord(raw: unknown): ChatExample | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const rawMessages = r.messages ?? r.conversation;
  if (Array.isArray(rawMessages)) {
    const messages = rawMessages
      .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
      .map(m => ({ role: String(m.role) as Role, content: String(m.content ?? "").trim() }));
    return { messages };
  }

  const userText = r.prompt ?? r.question ?? r.user;
  const assistantText = r.completion ?? r.answer ?? r.assistant ?? r.response;
  if (typeof userText === "string" && typeof assistantText === "string") {
    const messages: ChatMessage[] = [];
    if (typeof r.system === "string" && r.system.trim()) {
      messages.push({ role: "system", content: r.system.trim() });
    }
    messages.push({ role: "user", content: userText.trim() });
    messages.push({ role: "assistant", content: assistantText.trim() });
    return { messages };
  }

  return null;
}

function loadRawRecords(input: string): unknown[] {
  const ext = extname(input).toLowerCase();
  const text = readFileSync(input, "utf-8");

  if (ext === ".csv") return parseCsv(text);

  if (ext === ".jsonl") {
    return text
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => JSON.parse(l));
  }

  // .json — either an array, or an object with a top-level array under a
  // common key (data/examples/records).
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed;
  for (const key of ["data", "examples", "records", "conversations"]) {
    if (Array.isArray(parsed[key])) return parsed[key];
  }
  throw new Error(`Don't know how to read ${input} — expected a JSON array or a .jsonl/.csv file.`);
}

function injectSystemPrompt(example: ChatExample, systemPrompt: string): ChatExample {
  if (example.messages[0]?.role === "system") return example;
  return { messages: [{ role: "system", content: systemPrompt }, ...example.messages] };
}

type ValidationResult = { ok: true } | { ok: false; reason: string };

function validate(example: ChatExample): ValidationResult {
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

function estimateTokens(examples: ChatExample[]): number {
  // Rough heuristic (~4 chars/token in English) — good enough for a
  // ballpark before training, not for billing.
  const chars = examples.reduce(
    (sum, ex) => sum + ex.messages.reduce((s, m) => s + m.content.length, 0),
    0,
  );
  return Math.round(chars / 4);
}

function main() {
  const { input, output, systemPromptFile } = parseArgs(process.argv.slice(2));
  const systemPrompt = systemPromptFile ? readFileSync(systemPromptFile, "utf-8").trim() : DEFAULT_SYSTEM_PROMPT;

  const raw = loadRawRecords(input);
  console.log(`Read ${raw.length} raw record(s) from ${input}`);

  const dropped: Record<string, number> = {};
  const valid: ChatExample[] = [];

  for (const r of raw) {
    const normalized = normalizeRecord(r);
    if (!normalized) {
      dropped["unrecognized shape"] = (dropped["unrecognized shape"] ?? 0) + 1;
      continue;
    }
    const withSystem = injectSystemPrompt(normalized, systemPrompt);
    const result = validate(withSystem);
    if (!result.ok) {
      dropped[result.reason] = (dropped[result.reason] ?? 0) + 1;
      continue;
    }
    valid.push(withSystem);
  }

  const roleCounts: Record<string, number> = {};
  for (const ex of valid) for (const m of ex.messages) roleCounts[m.role] = (roleCounts[m.role] ?? 0) + 1;

  writeFileSync(output, valid.map(ex => JSON.stringify(ex)).join("\n") + (valid.length ? "\n" : ""));

  console.log(`\nWrote ${valid.length} valid example(s) to ${output}`);
  const droppedTotal = Object.values(dropped).reduce((a, b) => a + b, 0);
  if (droppedTotal > 0) {
    console.log(`Dropped ${droppedTotal} record(s):`);
    for (const [reason, count] of Object.entries(dropped).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${count}\t${reason}`);
    }
  }
  console.log(`Role distribution: ${JSON.stringify(roleCounts)}`);
  console.log(`Estimated tokens: ~${estimateTokens(valid).toLocaleString()}`);
}

main();
