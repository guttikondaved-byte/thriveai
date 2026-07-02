import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Bot, Send, Loader2 } from "lucide-react";
import { DEMO_COACH_DATA } from "@/lib/demoData";

type Message = { role: "user" | "assistant"; text: string };

const MAX_DEMO_MESSAGES = 4;

const DEMO_REPLIES = [
  "Look at pairing weekly mileage with HRV trends per athlete — a mileage jump alongside a dropping HRV is the clearest early warning sign of overreaching.",
  "For a roster this size, a simple rule of thumb: no athlete should increase weekly volume more than 20% week over week, regardless of how good they're feeling.",
  "Consistency of training days matters as much as total volume — athletes who spread miles across more days per week tend to have lower injury rates than those who cram the same volume into fewer, harder days.",
  "Once you sign up, AveraAI can generate a full training plan proposal for any athlete on your roster based on their actual data — not just general coaching guidance.",
];

export default function DemoCoachChat() {
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<Message[]>(DEMO_COACH_DATA.coachConversation);
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
    <div className="p-8 flex flex-col h-[calc(100vh-52px)] max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Bot className="w-6 h-6 text-primary" />
          AveraAI
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Your AI coaching assistant, tuned for your roster</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4">
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
          onClick={() => navigate("/sign-up?role=coach")}
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
            placeholder="Ask AveraAI about your roster…"
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
          {MAX_DEMO_MESSAGES - demoMessagesSent} message{MAX_DEMO_MESSAGES - demoMessagesSent === 1 ? "" : "s"} left in this demo — sign up for the full conversation.
        </p>
      )}
    </div>
  );
}
