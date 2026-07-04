import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Send, Loader2, ArrowUp } from "lucide-react";

type Message = { role: "user" | "assistant"; text: string };

const MAX_DEMO_MESSAGES = 4;

const DEMO_REPLIES = [
  "Look at pairing weekly mileage with HRV trends per athlete. A mileage jump alongside a dropping HRV is the clearest early warning sign of overreaching.",
  "For a roster this size, a simple rule of thumb: no athlete should increase weekly volume more than 20% week over week, regardless of how good they're feeling.",
  "Consistency of training days matters as much as total volume. Athletes who spread miles across more days per week tend to have lower injury rates than those who cram the same volume into fewer, harder days.",
  "Once you sign up, AveraAI can generate a full training plan proposal for any athlete on your roster based on their actual data, not just general coaching guidance.",
];

const SUGGESTIONS = [
  "Who on my team is at injury risk this week?",
  "Summarize my team's training load",
  "How should I handle an athlete with dropping HRV?",
];

export default function DemoCoachChat() {
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [demoMessagesSent, setDemoMessagesSent] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const limitReached = demoMessagesSent >= MAX_DEMO_MESSAGES;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  function handleSend(override?: string) {
    const text = (override ?? input).trim();
    if (!text || limitReached || sending) return;
    setMessages(prev => [...prev, { role: "user", text }]);
    setInput("");
    setSending(true);
    setTimeout(() => {
      const reply = DEMO_REPLIES[demoMessagesSent % DEMO_REPLIES.length];
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
        placeholder="Ask AveraAI about your roster…"
        disabled={sending}
        className="flex-1 bg-transparent text-[15px] leading-6 text-foreground placeholder:text-muted-foreground outline-none disabled:opacity-50"
      />
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
