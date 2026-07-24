// Exports real AveraAI conversations from Postgres into the fine-tuning
// chat format described in ./README.md. Run this periodically as real usage
// accumulates, rather than waiting until there's "enough" data to bother —
// each run is a fresh snapshot of everything eligible so far.
//
// Usage:
//   DATABASE_URL=... pnpm --filter @workspace/scripts export-conversations -- <output.jsonl> [--exclude-emails a@x.com,b@y.com] [--system-prompt-file <path>]
//
// Requires DATABASE_URL — see artifacts/api-server/.env.local for the
// external Render Postgres URL (needs ?sslmode=require).

import { readFileSync } from "node:fs";
import { asc, eq, inArray } from "drizzle-orm";
import { db, conversations, messages, usersTable } from "@workspace/db";
import {
  type ChatExample,
  type ChatMessage,
  DEFAULT_SYSTEM_PROMPT,
  injectSystemPrompt,
  validate,
  estimateTokens,
  roleCounts,
  writeJsonl,
} from "./chat-format";

function parseArgs(argv: string[]) {
  const positional = argv.filter(a => !a.startsWith("--"));
  const [output] = positional;
  const excludeIdx = argv.indexOf("--exclude-emails");
  const excludeEmails = excludeIdx !== -1
    ? argv[excludeIdx + 1].split(",").map(e => e.trim().toLowerCase()).filter(Boolean)
    : [];
  const systemPromptFlagIdx = argv.indexOf("--system-prompt-file");
  const systemPromptFile = systemPromptFlagIdx !== -1 ? argv[systemPromptFlagIdx + 1] : undefined;
  if (!output) {
    console.error(
      "Usage: export-conversations <output.jsonl> [--exclude-emails a@x.com,b@y.com] [--system-prompt-file <path>]",
    );
    process.exit(1);
  }
  return { output, excludeEmails, systemPromptFile };
}

async function main() {
  const { output, excludeEmails, systemPromptFile } = parseArgs(process.argv.slice(2));
  const systemPrompt = systemPromptFile ? readFileSync(systemPromptFile, "utf-8").trim() : DEFAULT_SYSTEM_PROMPT;

  let excludedUserIds: string[] = [];
  if (excludeEmails.length > 0) {
    const excludedUsers = await db
      .select({ id: usersTable.id, email: usersTable.email })
      .from(usersTable)
      .where(inArray(usersTable.email, excludeEmails));
    excludedUserIds = excludedUsers.map(u => u.id);
    console.log(`Excluding ${excludedUserIds.length} user(s) matching ${excludeEmails.length} email(s)`);
  }

  const allConversations = await db.select().from(conversations).orderBy(asc(conversations.id));
  const eligibleConversations = allConversations.filter(
    c => !c.userId || !excludedUserIds.includes(c.userId),
  );
  console.log(
    `Found ${allConversations.length} conversation(s), ${eligibleConversations.length} eligible after exclusions`,
  );

  const dropped: Record<string, number> = {};
  const valid: ChatExample[] = [];

  for (const conv of eligibleConversations) {
    const rows = await db
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(eq(messages.conversationId, conv.id))
      .orderBy(asc(messages.createdAt));

    if (rows.length === 0) {
      dropped["no messages"] = (dropped["no messages"] ?? 0) + 1;
      continue;
    }

    const chatMessages: ChatMessage[] = rows
      .filter(r => r.role === "user" || r.role === "assistant")
      .map(r => ({ role: r.role as "user" | "assistant", content: r.content.trim() }));

    // A conversation can end mid-turn (user asked something, no reply
    // stored yet, or a reply failed and was never persisted) — trim any
    // trailing user message so every example still ends on an assistant
    // turn, per the fine-tuning format's rules.
    while (chatMessages.length > 0 && chatMessages[chatMessages.length - 1].role === "user") {
      chatMessages.pop();
    }

    if (chatMessages.length === 0) {
      dropped["no usable turns"] = (dropped["no usable turns"] ?? 0) + 1;
      continue;
    }

    const withSystem = injectSystemPrompt({ messages: chatMessages }, systemPrompt);
    const result = validate(withSystem);
    if (!result.ok) {
      dropped[result.reason] = (dropped[result.reason] ?? 0) + 1;
      continue;
    }
    valid.push(withSystem);
  }

  writeJsonl(output, valid);

  console.log(`\nWrote ${valid.length} valid example(s) to ${output}`);
  const droppedTotal = Object.values(dropped).reduce((a, b) => a + b, 0);
  if (droppedTotal > 0) {
    console.log(`Dropped ${droppedTotal} conversation(s):`);
    for (const [reason, count] of Object.entries(dropped).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${count}\t${reason}`);
    }
  }
  console.log(`Role distribution: ${JSON.stringify(roleCounts(valid))}`);
  console.log(`Estimated tokens: ~${estimateTokens(valid).toLocaleString()}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
