import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Send, Loader2, ArrowUp, Mic } from "lucide-react";
import { DEMO_COACH_DATA } from "@/lib/demoData";
import { useDemoVoiceInput } from "@/hooks/useDemoVoiceInput";
import { useToast } from "@/hooks/use-toast";

type Message = { role: "user" | "assistant"; text: string };

const MAX_DEMO_MESSAGES = 4;

// Index-aligned with SUGGESTIONS, so clicking a suggestion gets the reply that
// actually answers it instead of whatever's next in an unrelated cycling order.
const SUGGESTIONS = [
  "Who on my team is at injury risk this week?",
  "Summarize my team's training load",
  "How should I handle an athlete with dropping HRV?",
];

const SUGGESTION_REPLIES = [
  "Look at pairing weekly mileage with HRV trends per athlete. A mileage jump alongside a dropping HRV is the clearest early warning sign of overreaching.",
  "For a roster this size, a simple rule of thumb: no athlete should increase weekly volume more than 20% week over week, regardless of how good they're feeling.",
  "Consistency of training days matters as much as total volume. Athletes who spread miles across more days per week tend to have lower injury rates than those who cram the same volume into fewer, harder days.",
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
  return `Once you sign up, AveraAI answers questions like this by actually looking at your roster's data — mileage, HRV, and injury risk per athlete — instead of general advice. Try asking who's at risk, about training load, recovery, or your roster summary to see what that looks like.`;
}

export default function DemoCoachChat() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [demoMessagesSent, setDemoMessagesSent] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const limitReached = demoMessagesSent >= MAX_DEMO_MESSAGES;

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
    if (!text || limitReached || sending) return;
    setMessages(prev => [...prev, { role: "user", text }]);
    setInput("");
    setSending(true);
    const reply = demoReplyFor(text);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: "assistant", text: reply }]);
      setSending(false);
      setDemoMessagesSent(n => n + 1);
    }, 900);
  }

  const composer = limitReached ? (
    <button
      onClick={() => navigate("/sign-up?role=coach")}
      className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left text-sm text-muted-foreground hover:border-primary/40 transition-colors shadow-[0_8px_30px_-14px_rgba(0,0,0,0.25)]"
    >
      <span className="flex-1">Sign up to keep chatting with AveraAI…</span>
      <Send className="w-4 h-4 text-primary shrink-0" />
    </button>
  ) : (
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
      <div className="flex items-center px-4 py-3">
        <span className="font-display font-semibold text-[11px] uppercase tracking-[0.08em] text-muted-foreground">AveraAI</span>
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
                  </div>
                )
              ))}
              {sending && (
                <span className="inline-block w-2 h-4 bg-primary opacity-70 animate-pulse rounded-sm" />
              )}
            </div>
          </div>

          <div className="px-4 pb-2 pt-2">
            <div className="max-w-3xl mx-auto">
              {composer}
            </div>
          </div>
          {!limitReached && (
            <p className="text-xs text-muted-foreground pb-4 text-center">
              {MAX_DEMO_MESSAGES - demoMessagesSent} message{MAX_DEMO_MESSAGES - demoMessagesSent === 1 ? "" : "s"} left in this demo. Sign up for the full conversation.
            </p>
          )}
        </>
      )}
    </div>
  );
}
