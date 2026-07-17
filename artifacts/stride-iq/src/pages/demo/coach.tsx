import { useState, useRef, useEffect } from "react";
import { Loader2, ArrowUp, Mic } from "lucide-react";
import { DEMO_DATA } from "@/lib/demoData";
import { useDemoVoiceInput } from "@/hooks/useDemoVoiceInput";
import { useToast } from "@/hooks/use-toast";
import { useDemoState, appendAthleteChat } from "@/lib/demoStore";

// Index-aligned with SUGGESTIONS, so clicking a suggestion gets the reply that
// actually answers it instead of whatever's next in an unrelated cycling order.
const SUGGESTIONS = [
  "How should I structure my runs this week?",
  "Am I at risk of overtraining?",
  "How do I improve my 5K time?",
];

const SUGGESTION_REPLIES = [
  `You're at ${DEMO_DATA.weeklyDistanceKm}km this week against a ${DEMO_DATA.weeklyMileageGoal}km goal, with your ${DEMO_DATA.currentPlanName} plan due for a long run and an easy day or two. Keep easy runs at a conversational pace, cap weekly mileage increases around 20%, and prioritize sleep and protein for recovery.`,
  `Your workload ratio is ${DEMO_DATA.riskDashboard.workload.ratio} right now (1.3+ means you're ramping faster than your body's conditioned for), and you have one active alert — ${DEMO_DATA.activeAlerts[0].bodyPart.toLowerCase()}, ${DEMO_DATA.activeAlerts[0].riskLevel} risk. That's not overtraining yet, but it's worth watching: soreness that eases within 24-48 hours is normal, sharp or one-sided pain is a sign to back off and rest.`,
  `Your current 5K PR is ${DEMO_DATA.pr5k}, averaging ${DEMO_DATA.avgPaceMinPerKm} min/km across recent runs. Strength work 2x a week (focused on hips, glutes, and core) is one of the best things a runner can do to reduce injury risk and improve running economy — which is usually what closes the gap between your training pace and race pace.`,
];

const GREETING_RE = /^(hi|hey|hello|hiya|howdy|yo|sup|good\s?(morning|afternoon|evening))\b/i;
const GREETING_REPLY = "Hey! I'm AveraAI, your AI running coach. Ask me about pacing, recovery, injury risk, or anything else about your training.";

// Keyword-driven fallback for anything free-typed that isn't a greeting or an
// exact suggestion match. Grounded in Jordan's actual demo data (mileage, HRV,
// alerts, PRs) rather than a single generic canned line, so typing off-script
// still gets a specific, data-aware answer instead of an empty-feeling reply.
const KEYWORD_REPLIES: Array<{ re: RegExp; reply: () => string }> = [
  {
    re: /\b(injur|hurt|pain|sore|ache|knee|calf|hip|shin)\w*/i,
    reply: () => {
      const alert = DEMO_DATA.activeAlerts[0];
      return `${alert.bodyPart} is your one active alert right now (${alert.riskLevel} risk) — ${alert.message.toLowerCase()} ${alert.recommendation} Your overall risk score is ${DEMO_DATA.riskDashboard.riskScore}/100 (${DEMO_DATA.riskDashboard.riskLabel.toLowerCase()}).`;
    },
  },
  {
    re: /\b(mileage|volume|distance|how (far|much)|weekly (miles|km))\b/i,
    reply: () =>
      `You're at ${DEMO_DATA.weeklyDistanceKm}km across ${DEMO_DATA.weeklyRuns} runs this week, against a ${DEMO_DATA.weeklyMileageGoal}km goal. Your workload ratio is ${DEMO_DATA.riskDashboard.workload.ratio} right now — anything above 1.3 means you're ramping faster than your body is conditioned for, so there's a little room before that's a concern.`,
  },
  {
    re: /\b(hrv|recover\w*|sleep|rest day|resting heart rate)\b/i,
    reply: () =>
      `Your HRV this week has ranged from ${Math.min(...DEMO_DATA.weeklyHrv.map(d => d.value))} to ${Math.max(...DEMO_DATA.weeklyHrv.map(d => d.value))}ms, and today's reading is ${DEMO_DATA.hrv}ms against a resting heart rate of ${DEMO_DATA.restingHeartRate}bpm. That's a fairly normal range — a sustained drop of 10%+ from your baseline for several days in a row is the bigger signal to back off, not a single low day.`,
  },
  {
    re: /\b(pace|speed|5k|10k|half|marathon|race|pr|time)\b/i,
    reply: () =>
      `Your current PRs are ${DEMO_DATA.pr5k} for 5K, ${DEMO_DATA.pr10k} for 10K, and ${DEMO_DATA.prHalf} for the half. You're averaging ${DEMO_DATA.avgPaceMinPerKm} min/km across your recent runs — dropping meaningful time usually comes from adding one quality session a week (tempo or intervals) without sacrificing your easy-day volume.`,
  },
  {
    re: /\b(plan|schedule|this week|program)\b/i,
    reply: () => {
      const p = DEMO_DATA.averaWeeklyPlanProposal;
      return `Given your active knee alert, I'd suggest something like "${p.name}": ${p.rationale} That plan tops out at ${p.weeklyMileage}km for the week, down from your usual ${DEMO_DATA.weeklyMileageGoal}km goal.`;
    },
  },
];

function demoReplyFor(text: string): string {
  if (GREETING_RE.test(text)) return GREETING_REPLY;
  const suggestionIndex = SUGGESTIONS.indexOf(text);
  if (suggestionIndex !== -1) return SUGGESTION_REPLIES[suggestionIndex];
  const matched = KEYWORD_REPLIES.find(({ re }) => re.test(text));
  if (matched) return matched.reply();
  return `I don't understand that one — but for reference, your risk score is ${DEMO_DATA.riskDashboard.riskScore}/100 (${DEMO_DATA.riskDashboard.riskLabel.toLowerCase()}) right now, based on your recent mileage, HRV, and open alerts. Ask me about your injury risk, mileage, recovery, or race times and I can go deeper on any of those.`;
}

export default function DemoCoach() {
  const { toast } = useToast();
  const messages = useDemoState().athleteChat;
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
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
    appendAthleteChat({ role: "user", text });
    setInput("");
    setSending(true);
    const reply = demoReplyFor(text);
    setTimeout(() => {
      appendAthleteChat({ role: "assistant", text: reply });
      setSending(false);
    }, 900);
  }

  const composer = (
    <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-2 shadow-[0_8px_30px_-14px_rgba(0,0,0,0.25)] focus-within:border-primary/40 transition-colors">
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleSend()}
        placeholder={voice.recording ? "Listening…" : "Ask AveraAI a training question…"}
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
              Good morning, <span className="text-primary">{DEMO_DATA.name}</span>
            </h1>
            <p className="text-muted-foreground text-center mt-2.5 mb-8">Your AI running coach, available 24/7.</p>
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
