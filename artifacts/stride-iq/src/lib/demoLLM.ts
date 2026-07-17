// Calls the real model behind the demo (POST /api/demo/chat, unauthenticated
// — see artifacts/api-server/src/routes/demo.ts) for anything that doesn't
// match one of the demo's deterministic fast paths (greetings, suggestions,
// known keyword topics, action phrasing). Returns null on any failure so
// callers can fall back to a canned line instead of the chat breaking.
export async function fetchDemoChatReply(
  systemPrompt: string,
  messages: Array<{ role: "user" | "assistant"; text: string }>,
): Promise<string | null> {
  try {
    const res = await fetch("/api/demo/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemPrompt,
        messages: messages.slice(-12).map((m) => ({ role: m.role, content: m.text })),
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.reply === "string" && data.reply.trim() ? data.reply.trim() : null;
  } catch {
    return null;
  }
}
