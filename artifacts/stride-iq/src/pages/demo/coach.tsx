import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Bot, Send, Loader2 } from "lucide-react";

type Message = { role: "user" | "assistant"; text: string };

const MAX_DEMO_MESSAGES = 4;

const DEMO_REPLIES = [
  "Great question. As a general rule, keep easy runs at a conversational pace, cap weekly mileage increases around 20%, and prioritize sleep and protein for recovery.",
  "That depends on how your body is responding day to day. Soreness that eases within 24-48 hours is normal, but sharp or one-sided pain is a sign to back off and rest.",
  "Strength work 2x a week (focused on hips, glutes, and core) is one of the best things a runner can do to reduce injury risk and improve running economy.",
  "Pacing your long runs 60-90 seconds slower than race pace builds aerobic endurance without accumulating excess fatigue. Most runners go too fast on easy days.",
];

export default function DemoCoach() {
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

  function handleSend() {
    const text = input.trim();
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

  return (
    <div className="p-8 flex flex-col h-[calc(100vh-52px)]">
      <div className="mb-6">
        <h1 className="font-display font-extrabold text-3xl tracking-[-0.01em] text-foreground flex items-center gap-2">
          <Bot className="w-6 h-6 text-primary" />
          AveraAI
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Your AI running coach, available 24/7</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && !sending && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-12">
            <Bot className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground max-w-xs">
              Ask AveraAI about your training, recovery, or an injury concern.
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-white"
                  : "bg-card border border-border text-foreground"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl px-4 py-3">
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            </div>
          </div>
        )}
      </div>

      {limitReached ? (
        <button
          onClick={() => navigate("/sign-up")}
          className="w-full flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-muted-foreground hover:border-primary/40 transition-colors"
        >
          <span className="flex-1">Sign up to keep chatting with AveraAI…</span>
          <Send className="w-4 h-4 text-primary shrink-0" />
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSend()}
            placeholder="Ask AveraAI a training question…"
            disabled={sending}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none py-2 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            aria-label="Send"
            className="shrink-0 text-primary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}
      {!limitReached && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          {MAX_DEMO_MESSAGES - demoMessagesSent} message{MAX_DEMO_MESSAGES - demoMessagesSent === 1 ? "" : "s"} left in this demo. Sign up for the full conversation.
        </p>
      )}
    </div>
  );
}
