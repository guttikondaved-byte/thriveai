import { useState, useRef, useEffect } from "react";
import { Loader2, ArrowUp, Mic, Bot, Search } from "lucide-react";
import { DEMO_COACH_DATA, getDemoAthleteDetail } from "@/lib/demoData";
import { useDemoVoiceInput } from "@/hooks/useDemoVoiceInput";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

type Message = { role: "user" | "assistant"; text: string; actionChip?: string };

// Index-aligned with SUGGESTIONS, so clicking a suggestion gets the reply that
// actually answers it instead of whatever's next in an unrelated cycling order.
const SUGGESTIONS = [
  "Who on my team is at injury risk this week?",
  "Summarize my team's training load",
  "How should I handle an athlete with dropping HRV?",
];

const SUGGESTION_REPLIES = [
  (() => {
    const flagged = DEMO_COACH_DATA.roster.filter(m => m.riskLevel === "high" || m.riskLevel === "medium");
    if (flagged.length === 0) return "Nobody on your roster is flagged this week — everyone's tracking at low risk.";
    const names = flagged.map(m => `${m.name} (${m.riskLevel} risk)`).join(", ");
    return `${names}. Look at pairing weekly mileage with HRV trends for each — a mileage jump alongside a dropping HRV is the clearest early warning sign of overreaching.`;
  })(),
  (() => {
    const totalKm = DEMO_COACH_DATA.roster.reduce((sum, m) => sum + m.weeklyDistanceKm, 0);
    return `Your ${DEMO_COACH_DATA.roster.length} athletes logged ${Math.round(totalKm)}km combined this week. As a rule of thumb for a roster this size: no athlete should increase weekly volume more than 20% week over week, regardless of how good they're feeling.`;
  })(),
  (() => {
    const lowest = [...DEMO_COACH_DATA.roster].sort((a, b) => a.hrv - b.hrv)[0];
    return `${lowest.name} has the lowest HRV on your roster right now at ${lowest.hrv}ms. When an athlete's HRV drops from their own baseline for several days in a row, cut their next couple of sessions to easy pace, drop volume ~20-25% for the week, and check in on sleep before ramping back up. A single low reading isn't a signal on its own — it's the sustained drop that matters.`;
  })(),
];

const GREETING_RE = /^(hi|hey|hello|hiya|howdy|yo|sup|good\s?(morning|afternoon|evening))\b/i;
const GREETING_REPLY = "Hey! I'm AveraAI, your AI assistant for the whole roster. Ask me about any athlete's training load, injury risk, or recovery.";

const roster = DEMO_COACH_DATA.roster;
const highRisk = roster.filter(m => m.riskLevel === "high" || m.riskLevel === "medium");

// Keyword-driven fallback for anything free-typed that isn't a greeting or an
// exact suggestion match. Grounded in the actual roster fixture (names,
// mileage, HRV, risk levels) rather than one generic canned line, so typing
// off-script still gets a specific, data-aware answer.
const KEYWORD_REPLIES: Array<{ re: RegExp; reply: () => string }> = [
  {
    re: /\b(injur|risk|hurt|pain|overtrain\w*)\b/i,
    reply: () => {
      if (highRisk.length === 0) return "Nobody on your roster has an elevated risk level right now — everyone's tracking at low risk.";
      const names = highRisk.map(m => `${m.name} (${m.riskLevel} risk)`).join(", ");
      const worst = highRisk.find(m => m.riskLevel === "high") ?? highRisk[0];
      return `${names} are currently flagged. ${worst.name.split(" ")[0]} stands out most — ${worst.weeklyDistanceKm}km this week across ${worst.weeklyWorkouts} sessions, with HRV at ${worst.hrv}ms. I'd cut their next couple of sessions to easy pace and check in on sleep before ramping back up.`;
    },
  },
  {
    re: /\b(mileage|volume|load|distance|training load)\b/i,
    reply: () => {
      const totalKm = roster.reduce((sum, m) => sum + m.weeklyDistanceKm, 0);
      const sorted = [...roster].sort((a, b) => b.weeklyDistanceKm - a.weeklyDistanceKm);
      return `Your ${roster.length} athletes logged ${Math.round(totalKm)}km combined this week. ${sorted[0].name} leads at ${sorted[0].weeklyDistanceKm}km, while ${sorted[sorted.length - 1].name} is lowest at ${sorted[sorted.length - 1].weeklyDistanceKm}km. Worth checking whether that gap matches their actual training phases.`;
    },
  },
  {
    re: /\b(hrv|recover\w*|resting heart rate)\b/i,
    reply: () => {
      const sorted = [...roster].sort((a, b) => a.hrv - b.hrv);
      return `${sorted[0].name} has the lowest HRV on your roster at ${sorted[0].hrv}ms (resting HR ${sorted[0].restingHeartRate}bpm) — worth a check-in. ${sorted[sorted.length - 1].name} is highest at ${sorted[sorted.length - 1].hrv}ms. A sustained drop of 10%+ from an athlete's own baseline over several days matters more than comparing across people.`;
    },
  },
  {
    re: /\b(plan|schedule|program|assign)\b/i,
    reply: () => {
      const p = DEMO_COACH_DATA.averaPlanProposal;
      return `Based on ${p.athleteName}'s recent load, I'd propose "${p.name}": ${p.rationale} That's ${p.weeklyMileage} miles/week over a ${p.sessions.length}-session block.`;
    },
  },
  {
    re: /\b(roster|team|summar|overview)\b/i,
    reply: () => {
      const byRisk = { low: 0, medium: 0, high: 0 } as Record<string, number>;
      roster.forEach(m => { byRisk[m.riskLevel] = (byRisk[m.riskLevel] ?? 0) + 1; });
      return `${DEMO_COACH_DATA.team.name} has ${roster.length} athletes: ${byRisk.low ?? 0} at low risk, ${byRisk.medium ?? 0} at medium, ${byRisk.high ?? 0} at high. ${DEMO_COACH_DATA.plans.filter(p => p.status === "active").length} training plans are currently active.`;
    },
  },
];

function demoReplyFor(text: string): string {
  if (GREETING_RE.test(text)) return GREETING_REPLY;
  const suggestionIndex = SUGGESTIONS.indexOf(text);
  if (suggestionIndex !== -1) return SUGGESTION_REPLIES[suggestionIndex];
  const matched = KEYWORD_REPLIES.find(({ re }) => re.test(text));
  if (matched) return matched.reply();
  return `I can pull that from your roster data — mileage, HRV, and injury risk per athlete. Try asking who's at risk, about training load, recovery, or your roster summary and I'll go deeper on any of those.`;
}

// ── Agent mode: simulated tool calls + real (demo-scoped) write actions ──────
// Mirrors the real coach agent's shape (list/lookup tools, plus broadcast and
// alert-comment actions) against the static demo fixture, so the demo shows
// what agent mode actually does rather than just claiming it. Nothing here
// touches a server — the "actions" are local-only and reset on refresh.

const BROADCAST_RE = /\b(message|tell|notify|announce|broadcast)\b[\s\S]*\b(team|everyone|athletes|roster|squad)\b|\bbroadcast\b/i;
const NOTE_VERB_RE = /\b(leave (a |him |her |them )?note|comment on|reach out to|check in with)\b/i;

function findMentionedAthlete(text: string) {
  const lower = text.toLowerCase();
  return DEMO_COACH_DATA.roster.find(m => lower.includes(m.name.split(" ")[0].toLowerCase()));
}

type AgentPlan = { trace: string[]; reply: string; actionChip?: string; toast?: { title: string; description: string } };

function planAgentResponse(text: string): AgentPlan {
  if (GREETING_RE.test(text)) return { trace: [], reply: GREETING_REPLY };

  const suggestionIndex = SUGGESTIONS.indexOf(text);
  if (suggestionIndex !== -1) {
    const traceByIndex = [
      ["Checking injury alerts across your roster…"],
      ["Aggregating this week's training load…"],
      ["Scanning HRV trends for your roster…"],
    ];
    return { trace: traceByIndex[suggestionIndex], reply: SUGGESTION_REPLIES[suggestionIndex] };
  }

  // Write action: leave a note on an athlete's alert.
  if (NOTE_VERB_RE.test(text)) {
    const athlete = findMentionedAthlete(text);
    if (!athlete) {
      return { trace: ["Checking your roster…"], reply: "Who should I leave that note for? Name the athlete and I'll pull up their alerts." };
    }
    const detail = getDemoAthleteDetail(athlete.userId);
    const alert = detail?.alerts[0];
    if (!alert) {
      return {
        trace: [`Checking ${athlete.name}'s active alerts…`],
        reply: `${athlete.name} doesn't have any active alerts right now, so there's nothing to leave a note on.`,
      };
    }
    const quoted = text.match(/["“]([^"”]+)["”]/)?.[1];
    const content = quoted ?? alert.recommendation;
    return {
      trace: [`Checking ${athlete.name}'s active alerts…`, `Drafting a note on their ${alert.bodyPart} alert…`, "Sending note…"],
      reply: `Done — I left a note on ${athlete.name}'s ${alert.bodyPart} alert: "${content}" They'll see it on their alert and get notified.`,
      actionChip: `✅ Note sent to ${athlete.name}`,
      toast: { title: "Note added", description: `Left on ${athlete.name}'s ${alert.bodyPart} alert.` },
    };
  }

  // Write action: broadcast to the whole team.
  if (BROADCAST_RE.test(text)) {
    const quoted = text.match(/["“]([^"”]+)["”]/)?.[1];
    const stripped = text.replace(/^(please\s+)?(message|tell|notify|announce|broadcast)\b(\s+the)?(\s+team|\s+everyone|\s+athletes|\s+roster|\s+squad)?[:,]?\s*/i, "").trim();
    const message = quoted ?? (stripped || text);
    const count = DEMO_COACH_DATA.roster.length;
    return {
      trace: ["Loading your roster…", `Sending to ${count} athletes…`],
      reply: `Sent to all ${count} athletes on ${DEMO_COACH_DATA.team.name}: "${message}"`,
      actionChip: `✅ Broadcast sent to ${count} athletes`,
      toast: { title: "Broadcast sent", description: `Delivered to ${count} athletes.` },
    };
  }

  // Read-only: same grounded answers as plain mode, with a trace shown first
  // so it's visible that agent mode actually looked something up.
  const readTraces: Array<{ re: RegExp; trace: string[] }> = [
    { re: /\b(injur|risk|hurt|pain|overtrain\w*)\b/i, trace: ["Checking injury alerts across your roster…"] },
    { re: /\b(mileage|volume|load|distance|training load)\b/i, trace: ["Aggregating this week's training load…"] },
    { re: /\b(hrv|recover\w*|resting heart rate)\b/i, trace: ["Scanning HRV trends for your roster…"] },
    { re: /\b(plan|schedule|program|assign)\b/i, trace: ["Reviewing recent load for a plan proposal…"] },
    { re: /\b(roster|team|summar|overview)\b/i, trace: ["Loading your team roster…"] },
  ];
  const matchedTrace = readTraces.find(({ re }) => re.test(text));
  return { trace: matchedTrace?.trace ?? [], reply: demoReplyFor(text) };
}

const AGENT_OFF_ACTION_REPLY =
  "Agent mode is off, so I can only talk right now — I can't send messages or leave notes for you. Flip on Agent Mode above the chat to let me take actions.";

export default function DemoCoachChat() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [agentMode, setAgentMode] = useState(true);
  const [traceStep, setTraceStep] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const voice = useDemoVoiceInput((transcript) => {
    setInput(prev => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
  });

  useEffect(() => {
    if (voice.error) toast({ title: "Voice input failed", description: voice.error, variant: "destructive" });
  }, [voice.error, toast]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  function handleSend(override?: string) {
    const text = (override ?? input).trim();
    if (!text || sending) return;
    setMessages(prev => [...prev, { role: "user", text }]);
    setInput("");
    setSending(true);

    if (!agentMode) {
      // Plain-chat mode: no tool trace, and write-intent requests are declined
      // rather than silently acted on — mirrors the real backend gate.
      const isWriteIntent = NOTE_VERB_RE.test(text) || BROADCAST_RE.test(text);
      const reply = isWriteIntent ? AGENT_OFF_ACTION_REPLY : demoReplyFor(text);
      setTimeout(() => {
        setMessages(prev => [...prev, { role: "assistant", text: reply }]);
        setSending(false);
      }, 900);
      return;
    }

    const plan = planAgentResponse(text);
    if (plan.trace.length === 0) {
      setTimeout(() => finishAgentTurn(plan), 900);
      return;
    }
    let step = 0;
    setTraceStep(plan.trace[0]);
    const interval = setInterval(() => {
      step++;
      if (step < plan.trace.length) {
        setTraceStep(plan.trace[step]);
      } else {
        clearInterval(interval);
        setTraceStep(null);
        finishAgentTurn(plan);
      }
    }, 550);
  }

  function finishAgentTurn(plan: AgentPlan) {
    setMessages(prev => [...prev, { role: "assistant", text: plan.reply, actionChip: plan.actionChip }]);
    setSending(false);
    if (plan.toast) toast(plan.toast);
  }

  const composer = (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-[0_8px_30px_-14px_rgba(0,0,0,0.25)] focus-within:border-primary/40 transition-colors">
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleSend()}
        placeholder={voice.recording ? "Listening…" : "Ask AveraAI about your roster…"}
        disabled={sending}
        className="flex-1 bg-transparent text-[15px] leading-6 text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50"
      />
      {voice.supported && (
        <button
          type="button"
          onClick={voice.toggle}
          disabled={sending}
          aria-label={voice.recording ? "Stop recording" : "Start voice input"}
          className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-40 ${
            voice.recording
              ? "bg-destructive text-destructive-foreground animate-pulse"
              : "bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
          }`}
        >
          <Mic className="w-4 h-4" />
        </button>
      )}
      <button
        onClick={() => handleSend()}
        disabled={!input.trim() || sending}
        aria-label="Send"
        className="shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-40 transition-all"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-52px)]">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-display font-semibold text-[11px] uppercase tracking-[0.08em] text-muted-foreground">AveraAI</span>
        <div className="flex items-center gap-2">
          <Bot className={`w-3.5 h-3.5 ${agentMode ? "text-primary" : "text-muted-foreground"}`} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Agent Mode</span>
          <Switch checked={agentMode} onCheckedChange={setAgentMode} aria-label="Toggle agent mode" disabled={sending} />
        </div>
      </div>

      {messages.length === 0 && !sending ? (
        /* Greeting state */
        <div className="flex-1 flex flex-col items-center justify-center px-4 pb-20 overflow-auto">
          <div className="w-full max-w-2xl">
            <h1 className="font-display font-extrabold text-4xl tracking-[-0.01em] text-foreground text-center">
              Good morning, <span className="text-primary">Coach Taylor</span>
            </h1>
            <p className="text-muted-foreground text-center mt-2.5 mb-8">Your AI assistant for the whole roster.</p>
            {composer}
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  disabled={sending}
                  className="px-3.5 py-2 rounded-full border border-border bg-card text-[13px] text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto w-full px-4 py-4 space-y-6">
              {messages.map((msg, i) => (
                msg.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-secondary px-4 py-2.5 text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="text-[15px] leading-relaxed text-foreground">
                    {msg.text}
                    {msg.actionChip && (
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-[12px] font-medium text-primary">
                        {msg.actionChip}
                      </div>
                    )}
                  </div>
                )
              ))}
              {sending && traceStep && (
                <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Search className="w-3.5 h-3.5 animate-pulse shrink-0" />
                  <span>{traceStep}</span>
                </div>
              )}
              {sending && !traceStep && (
                <span className="inline-block w-2 h-4 bg-primary opacity-70 animate-pulse rounded-sm" />
              )}
            </div>
          </div>

          <div className="px-4 pb-4 pt-2">
            <div className="max-w-3xl mx-auto">
              {composer}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
