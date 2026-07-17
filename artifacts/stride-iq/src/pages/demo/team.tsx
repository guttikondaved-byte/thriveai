import { useState } from "react";
import { Users, MessageSquare } from "lucide-react";
import { DEMO_DATA } from "@/lib/demoData";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useDemoState, addDirectMessage } from "@/lib/demoStore";

// Matches DEMO_COACH_DATA.roster[0] (Jordan P.) — the coach and athlete demos
// share the same underlying persona, so a message sent to Jordan from the
// coach's demo shows up here too, and vice versa.
const DEMO_ATHLETE_USER_ID = "1";

const SEED_MESSAGE = {
  id: -1,
  authorRole: "coach" as const,
  content: "Nice work on this week's long run — keep the next couple of sessions easy before we build back up.",
  createdAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
};

function DemoCoachMessages() {
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const thread = [SEED_MESSAGE, ...(useDemoState().directMessages[DEMO_ATHLETE_USER_ID] ?? [])];

  function send() {
    const content = draft.trim();
    if (!content) return;
    addDirectMessage(DEMO_ATHLETE_USER_ID, "athlete", content);
    setDraft("");
    toast({ title: "Message sent" });
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5 mb-6 space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Messages from your coach</h2>
      </div>
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {thread.map(m => (
          <div key={m.id} className={`rounded-xl px-4 py-2.5 ${m.authorRole === "athlete" ? "bg-primary/10 border border-primary/20" : "bg-secondary/50"}`}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">{m.authorRole === "athlete" ? "You" : "Coach"}</p>
            <p className="text-sm text-foreground">{m.content}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(m.createdAt), "MMM d, HH:mm")}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => e.key === "Enter" && send()}
          placeholder="Message your coach…"
          maxLength={1000}
          className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          onClick={send}
          disabled={!draft.trim()}
          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default function DemoTeam() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="font-display font-extrabold text-3xl tracking-[-0.01em] text-foreground">My Team</h1>
        <p className="text-sm text-muted-foreground mt-1">Your coach and teammates</p>
      </div>

      <div className="bg-card border border-primary/30 rounded-lg p-5 mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">Team</span>
        </div>
        <p className="text-lg font-semibold text-foreground">{DEMO_DATA.team.teamName}</p>
        <p className="text-sm text-muted-foreground mt-1">Coached by {DEMO_DATA.team.coachName}</p>
      </div>

      <DemoCoachMessages />

      <div className="bg-card border border-border rounded-lg divide-y divide-border">
        {DEMO_DATA.team.teammates.map(t => (
          <div key={t.name} className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                {t.name.charAt(0)}
              </div>
              <p className="text-sm font-semibold text-foreground">{t.name}</p>
            </div>
            <p className="text-sm text-muted-foreground">{t.weeklyMiles} mi this week</p>
          </div>
        ))}
      </div>
    </div>
  );
}
