import { useRef, useState, useEffect } from "react";
import { Loader2, ArrowUp, Mic, AudioLines, Bot, Search } from "lucide-react";
import { DEMO_COACH_DATA, getDemoAthleteDetail, buildDemoCoachSystemPrompt } from "@/lib/demoData";
import { useDemoVoiceInput } from "@/hooks/useDemoVoiceInput";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { useDemoState, getDemoState, appendCoachChat, addDirectMessage, addExtraPlan, setPlanOverride, type DemoChatMessage } from "@/lib/demoStore";
import { fetchDemoChatReply } from "@/lib/demoLLM";
import { VoiceModeOverlay, type VoicePhase } from "@/components/VoiceModeOverlay";

type Message = DemoChatMessage;

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
    re: /\b(plans?|planning|schedule|program|assign\w*)\b/i,
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
  return `I don't understand that one — I can pull mileage, HRV, and injury risk per athlete from your roster data. Try asking who's at risk, about training load, recovery, or your roster summary and I'll go deeper on any of those.`;
}

// True if demoReplyFor has a deterministic, on-topic answer for this text —
// used to decide whether to skip the real-model call and answer instantly.
function hasKnownTopic(text: string): boolean {
  return GREETING_RE.test(text) || SUGGESTIONS.includes(text) || KEYWORD_REPLIES.some(({ re }) => re.test(text));
}

// ── Agent mode: simulated tool calls + real (demo-scoped) write actions ──────
// Mirrors the real coach agent's shape (list/lookup tools, plus broadcast and
// alert-comment actions) against the static demo fixture, so the demo shows
// what agent mode actually does rather than just claiming it. Nothing here
// touches a server — the "actions" are local-only and reset on refresh.

// Team-wide target words disambiguate a broadcast ("tell the team...") from a
// message directed at one athlete ("tell Marcus...") even though both start
// with the same verbs.
const TEAM_TARGET_RE = /\b(team|everyone|athletes|roster|squad)\b/i;
const ATHLETE_ACTION_VERB_RE = /\b(tell|message|send|ask|remind|leave (a |him |her |them )?note|comment on|reach out to|check in with)\b/i;
const ALERT_NOTE_RE = /\b(note|comment|alert)\b/i;
const BROADCAST_VERB_RE = /\b(message|tell|notify|announce|broadcast)\b/i;

function findMentionedAthlete(text: string) {
  const lower = text.toLowerCase();
  return DEMO_COACH_DATA.roster.find(m => lower.includes(m.name.split(" ")[0].toLowerCase()));
}

type AgentPlan = {
  trace: string[];
  reply: string;
  actionChip?: string;
  toast?: { title: string; description: string };
  proposesPlan?: boolean;
  // Runs once, right when the action resolves — this is what makes the
  // action actually happen elsewhere in the demo (a message that shows up
  // in the athlete's thread, a plan that shows up on the Plans page) instead
  // of the chat just claiming it did something.
  effect?: () => void;
  // Set instead of a static `reply` when nothing deterministic matched —
  // asks the real model instead of falling back to a canned line. Resolves
  // to null on failure, in which case the caller uses `reply` as a fallback.
  resolveReply?: () => Promise<string | null>;
};

const PLAN_CONFIRM_RE = /^(go ahead|do it|apply( it)?|assign( it| that)?|yes\b|confirm|sounds good|make it so)\b/i;
const AGENT_MODE_QUESTION_RE = /\b(agent(ic)? mode|are you (an )?agent\w*)\b/i;

function planAgentResponse(text: string, pendingPlan: boolean): AgentPlan {
  if (GREETING_RE.test(text)) return { trace: [], reply: GREETING_REPLY };
  if (AGENT_MODE_QUESTION_RE.test(text)) {
    return { trace: [], reply: "Yes — Agent Mode is on. I can look up any athlete, run the injury what-if simulator, message someone, leave a note on an alert, or assign/adjust a plan, all without you leaving the chat. Flip the toggle above off if you'd rather I just talk." };
  }

  // Confirming a plan proposed in the previous turn is a real (simulated)
  // action — mirrors the real agent's create_team_plan tool, only called
  // after the coach confirms a plan proposed in text.
  if (pendingPlan && PLAN_CONFIRM_RE.test(text)) {
    const p = DEMO_COACH_DATA.averaPlanProposal;
    // Mirrors the real agent preferring update_team_plan over create_team_plan
    // when the athlete already has an active plan — Marcus does ("Marathon
    // Peak Phase"), so this adjusts it in place instead of stacking a second,
    // overlapping plan.
    const existingPlan = DEMO_COACH_DATA.plans.find(existing => existing.athleteName === p.athleteName);

    if (existingPlan) {
      return {
        trace: [`Checking ${p.athleteName}'s existing plan…`, `Updating "${existingPlan.name}"…`],
        reply: `Done — updated ${p.athleteName}'s existing plan "${existingPlan.name}": mileage cut from ${existingPlan.weeklyMileage} to ${p.weeklyMileage} mi/week. They've been notified.`,
        actionChip: `✅ Plan updated for ${p.athleteName}`,
        toast: { title: "Plan updated", description: `"${existingPlan.name}" is now ${p.weeklyMileage} mi/week.` },
        effect: () => {
          setPlanOverride(existingPlan.id, { weeklyMileage: p.weeklyMileage, status: "active" });
          addDirectMessage(p.athleteUserId, "coach", `Updated your plan "${existingPlan.name}" — now ${p.weeklyMileage} mi/week (was ${existingPlan.weeklyMileage}).`);
        },
      };
    }

    return {
      trace: [`Creating "${p.name}" for ${p.athleteName}…`, `Adding ${p.sessions.length} sessions…`],
      reply: `Done — assigned "${p.name}" to ${p.athleteName}: ${p.weeklyMileage} mi/week from ${p.startDate} to ${p.endDate}. They've been notified.`,
      actionChip: `✅ Plan assigned to ${p.athleteName}`,
      toast: { title: "Plan assigned", description: `"${p.name}" is now active for ${p.athleteName}.` },
      effect: () => {
        addExtraPlan({
          athleteUserId: p.athleteUserId,
          athleteName: p.athleteName,
          name: p.name,
          goal: p.goal,
          status: "active",
          weeklyMileage: p.weeklyMileage,
          startDate: p.startDate,
          endDate: p.endDate,
        });
        addDirectMessage(p.athleteUserId, "coach", `Assigned you a new plan: "${p.name}" — ${p.weeklyMileage} mi/week, ${p.startDate} to ${p.endDate}.`);
      },
    };
  }

  const suggestionIndex = SUGGESTIONS.indexOf(text);
  if (suggestionIndex !== -1) {
    const traceByIndex = [
      ["Checking injury alerts across your roster…"],
      ["Aggregating this week's training load…"],
      ["Scanning HRV trends for your roster…"],
    ];
    return { trace: traceByIndex[suggestionIndex], reply: SUGGESTION_REPLIES[suggestionIndex] };
  }

  const athlete = findMentionedAthlete(text);

  // Write action: something directed at one named athlete — a note on their
  // alert if the wording references a note/alert, otherwise a direct message.
  if (athlete && ATHLETE_ACTION_VERB_RE.test(text)) {
    const quoted = text.match(/["“]([^"”]+)["”]/)?.[1];
    const firstName = athlete.name.split(" ")[0];
    const stripRe = new RegExp(
      `^(please\\s+)?(tell|message|send( a)?( message| note)?|ask|remind|leave( a| him| her| them)? note( to| on)?|comment on|reach out to|check in with)\\s+${firstName}\\S*\\s*(to|that|about)?\\s*`,
      "i"
    );
    const stripped = text.replace(stripRe, "").trim();

    if (ALERT_NOTE_RE.test(text)) {
      const detail = getDemoAthleteDetail(athlete.userId);
      const alert = detail?.alerts[0];
      if (!alert) {
        return {
          trace: [`Checking ${athlete.name}'s active alerts…`],
          reply: `${athlete.name} doesn't have any active alerts right now, so there's nothing to leave a note on.`,
        };
      }
      const content = quoted ?? alert.recommendation;
      return {
        trace: [`Checking ${athlete.name}'s active alerts…`, `Drafting a note on their ${alert.bodyPart} alert…`, "Sending note…"],
        reply: `Done — I left a note on ${athlete.name}'s ${alert.bodyPart} alert: "${content}" They'll see it on their alert and get notified.`,
        actionChip: `✅ Note sent to ${athlete.name}`,
        toast: { title: "Note added", description: `Left on ${athlete.name}'s ${alert.bodyPart} alert.` },
        effect: () => addDirectMessage(athlete.userId, "coach", `Note on your ${alert.bodyPart} alert: "${content}"`),
      };
    }

    const content = quoted ?? (stripped || `a check-in about their training`);
    return {
      trace: [`Looking up ${athlete.name}…`, "Sending message…"],
      reply: `Done — I sent ${athlete.name} a message: "${content}" They'll see it and get notified.`,
      actionChip: `✅ Message sent to ${athlete.name}`,
      toast: { title: "Message sent", description: `Sent to ${athlete.name}.` },
      effect: () => addDirectMessage(athlete.userId, "coach", content),
    };
  }

  // Write action: broadcast to the whole team (no specific athlete named).
  if ((BROADCAST_VERB_RE.test(text) && TEAM_TARGET_RE.test(text)) || /\bbroadcast\b/i.test(text)) {
    const quoted = text.match(/["“]([^"”]+)["”]/)?.[1];
    const stripped = text.replace(/^(please\s+)?(message|tell|notify|announce|broadcast)\b(\s+the)?(\s+team|\s+everyone|\s+athletes|\s+roster|\s+squad)?[:,]?\s*/i, "").trim();
    const message = quoted ?? (stripped || text);
    const count = DEMO_COACH_DATA.roster.length;
    return {
      trace: ["Loading your roster…", `Sending to ${count} athletes…`],
      reply: `Sent to all ${count} athletes on ${DEMO_COACH_DATA.team.name}: "${message}"`,
      actionChip: `✅ Broadcast sent to ${count} athletes`,
      toast: { title: "Broadcast sent", description: `Delivered to ${count} athletes.` },
      effect: () => {
        for (const m of DEMO_COACH_DATA.roster) addDirectMessage(m.userId, "coach", `[Team broadcast] ${message}`);
      },
    };
  }

  // Read-only: same grounded answers as plain mode, with a trace shown first
  // so it's visible that agent mode actually looked something up.
  const planRe = /\b(plans?|planning|schedule|program|assign\w*)\b/i;
  const readTraces: Array<{ re: RegExp; trace: string[] }> = [
    { re: /\b(injur|risk|hurt|pain|overtrain\w*)\b/i, trace: ["Checking injury alerts across your roster…"] },
    { re: /\b(mileage|volume|load|distance|training load)\b/i, trace: ["Aggregating this week's training load…"] },
    { re: /\b(hrv|recover\w*|resting heart rate)\b/i, trace: ["Scanning HRV trends for your roster…"] },
    { re: planRe, trace: ["Reviewing recent load for a plan proposal…"] },
    { re: /\b(roster|team|summar|overview)\b/i, trace: ["Loading your team roster…"] },
  ];
  const matchedTrace = readTraces.find(({ re }) => re.test(text));
  if (matchedTrace) {
    return { trace: matchedTrace.trace, reply: demoReplyFor(text), proposesPlan: planRe.test(text) };
  }

  // Nothing deterministic matched — ask the real model instead of a canned
  // "I don't understand" line, so free-form questions get real understanding.
  return {
    trace: ["Thinking…"],
    reply: demoReplyFor(text),
    resolveReply: () => fetchDemoChatReply(buildDemoCoachSystemPrompt(), getDemoState().coachChat),
  };
}

const AGENT_OFF_ACTION_REPLY =
  "Agent mode is off, so I can only talk right now — I can't send messages or leave notes for you. Flip on Agent Mode above the chat to let me take actions.";

export default function DemoCoachChat() {
  const { toast } = useToast();
  const messages = useDemoState().coachChat;
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [agentMode, setAgentMode] = useState(true);
  const [traceStep, setTraceStep] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState(false);
  const [voiceModeOpen, setVoiceModeOpen] = useState(false);
  const voiceModeOpenRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const voice = useDemoVoiceInput((transcript) => {
    if (voiceModeOpenRef.current) {
      handleSend(transcript);
    } else {
      setInput(prev => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
    }
  });

  useEffect(() => {
    if (voice.error) toast({ title: "Voice input failed", description: voice.error, variant: "destructive" });
  }, [voice.error, toast]);

  // Keeps the mic listening for the next turn while voice mode is open —
  // fires once recording stops and no reply is in flight (covers both the
  // initial open and the gap after each exchange finishes).
  useEffect(() => {
    if (!voiceModeOpen || sending || voice.recording) return;
    const t = setTimeout(() => {
      if (voiceModeOpenRef.current && !voice.recording) voice.toggle();
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceModeOpen, sending, voice.recording]);

  function openVoiceMode() {
    if (!voice.supported) return;
    voiceModeOpenRef.current = true;
    setVoiceModeOpen(true);
  }

  function closeVoiceMode() {
    voiceModeOpenRef.current = false;
    setVoiceModeOpen(false);
    if (voice.recording) voice.toggle();
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  function handleSend(override?: string) {
    const text = (override ?? input).trim();
    if (!text || sending) return;
    appendCoachChat({ role: "user", text });
    setInput("");
    setSending(true);

    if (!agentMode) {
      // Plain-chat mode: no tool trace, and write-intent requests are declined
      // rather than silently acted on — mirrors the real backend gate. Known
      // topics still answer instantly; anything else asks the real model
      // (still read-only, no actions) instead of a canned fallback.
      const mentionsAthlete = !!findMentionedAthlete(text);
      const isWriteIntent =
        (mentionsAthlete && ATHLETE_ACTION_VERB_RE.test(text)) ||
        (BROADCAST_VERB_RE.test(text) && TEAM_TARGET_RE.test(text)) ||
        /\bbroadcast\b/i.test(text);

      if (AGENT_MODE_QUESTION_RE.test(text) || isWriteIntent || hasKnownTopic(text)) {
        const reply = AGENT_MODE_QUESTION_RE.test(text)
          ? "No — Agent Mode is off right now, so I can only talk. Flip the toggle above the chat on if you want me to look things up or take action."
          : isWriteIntent ? AGENT_OFF_ACTION_REPLY : demoReplyFor(text);
        setTimeout(() => {
          appendCoachChat({ role: "assistant", text: reply });
          setSending(false);
        }, 900);
        return;
      }

      setTraceStep("Thinking…");
      fetchDemoChatReply(buildDemoCoachSystemPrompt(), getDemoState().coachChat).then((reply) => {
        setTraceStep(null);
        appendCoachChat({ role: "assistant", text: reply ?? demoReplyFor(text) });
        setSending(false);
      });
      return;
    }

    const plan = planAgentResponse(text, pendingPlan);
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
        finishAgentTurn(plan);
      }
    }, 550);
  }

  async function finishAgentTurn(plan: AgentPlan) {
    // Keep the last trace step ("Thinking…") visible through the actual
    // network wait instead of clearing it beforehand.
    const text = plan.resolveReply ? (await plan.resolveReply()) ?? plan.reply : plan.reply;
    setTraceStep(null);
    appendCoachChat({ role: "assistant", text, actionChip: plan.actionChip });
    setSending(false);
    setPendingPlan(!!plan.proposesPlan);
    plan.effect?.();
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
          onClick={openVoiceMode}
          disabled={sending || voice.recording}
          aria-label="Open voice mode"
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-40 bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80"
        >
          <AudioLines className="w-4 h-4" />
        </button>
      )}
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

  const lastUserMessage = [...messages].reverse().find(m => m.role === "user");
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === "assistant");
  const voicePhase: VoicePhase = voice.recording ? "listening" : sending ? "responding" : "listening";

  return (
    <div className="flex flex-col h-[calc(100vh-52px)]">
      <VoiceModeOverlay
        open={voiceModeOpen}
        phase={voicePhase}
        userText={lastUserMessage?.text}
        assistantText={lastAssistantMessage?.text}
        onStop={() => { if (voice.recording) voice.toggle(); }}
        onClose={closeVoiceMode}
      />
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
