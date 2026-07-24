# AveraAI fine-tuning dataset

Target format for any dataset we fine-tune on — external sources, DB exports,
or synthetic data all get converted into this shape before training.

## Format: JSONL, one chat example per line

```jsonl
{"messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}
{"messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}, {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}
```

This is the OpenAI fine-tuning chat format, and it's a one-to-one mapping
onto the message list every chat-completion fine-tuning framework expects
(OpenAI's `fine_tuning.jobs`, Hugging Face `trl` SFTTrainer, Axolotl, etc.),
so picking it doesn't lock us into OpenAI vs. a self-hosted open-weight model.

Rules for a valid example:
- `messages` has at least one `system`, exactly one leading `system` message
  (if present), and alternates `user`/`assistant` after that — no two
  consecutive turns from the same role.
- The **last** message must be `role: "assistant"` — that's the completion
  being trained on. A dataset row that ends on a user turn isn't trainable.
- No empty/whitespace-only `content` fields.
- `content` is plain text (markdown is fine, since that's what AveraAI
  actually renders) — no tool-call blobs or JSON-only payloads unless we
  decide to fine-tune tool use explicitly later.

## System prompt

Real conversations should carry AveraAI's actual persona/system prompt
(see `artifacts/api-server/src/routes/openai.ts`, e.g. `"You are AveraAI, an
expert running coach."` plus role-specific instructions) so the fine-tuned
model sees the same framing at train and serve time. `prepare-dataset.ts`
will inject a default system message onto rows that don't already start
with one — pass `--system-prompt-file <path>` to control what gets injected.

## Pipeline

### External datasets

1. Drop the raw external dataset file (CSV, JSON array, or JSONL) somewhere
   under `scripts/data/` (gitignored — never commit raw user data).
2. Run `pnpm --filter @workspace/scripts prepare-finetune -- <input-file> <output-file.jsonl>`
   to convert + validate. It prints a summary (row count, dropped rows and
   why, role distribution, rough token estimate) and writes the cleaned
   JSONL.
3. Spot-check the output before training — the converter validates
   structure, not content quality.

### Real AveraAI conversations

`export-conversations.ts` pulls every conversation out of Postgres
(`conversations`/`messages` tables), trims any trailing unanswered user
turn, injects the system prompt, validates, and writes the same JSONL
format — so it can be run again and again as real usage accumulates,
rather than treated as a one-time export.

```bash
DATABASE_URL=... pnpm --filter @workspace/scripts export-conversations -- \
  scripts/data/conversations-$(date +%Y-%m-%d).jsonl \
  --exclude-emails you@example.com,other-internal@example.com
```

`--exclude-emails` filters out conversations belonging to internal/test
accounts (there's no `isDemo`/`isTest` flag in the schema, so this is the
only lever — keep the exclude list up to date as team accounts change).
Requires `DATABASE_URL` for the real (external, `?sslmode=require`) Postgres
instance — see `artifacts/api-server/.env.local`.

To build a combined training set, run both scripts and concatenate their
JSONL output (or just `cat` the files together — JSONL is line-delimited,
so this is safe).
