import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useListOpenaiConversations,
  useCreateOpenaiConversation,
  useGetOpenaiConversation,
  useDeleteOpenaiConversation,
  getListOpenaiConversationsQueryKey,
  getGetOpenaiConversationQueryKey,
  getListTrainingPlansQueryKey,
} from "@workspace/api-client-react";
import { useGetAthleteProfile } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Send, Bot, User, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type StreamMessage = { role: "user" | "assistant"; content: string; streaming?: boolean };

type AveraProposal = {
  athleteUserId: string;
  athleteName: string;
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
  weeklyMileage: number;
  rationale?: string;
  sessions: Array<{
    weekNumber: number;
    dayOfWeek: number;
    sessionType: string;
    description: string;
    distanceMiles: number;
    durationMinutes: number;
  }>;
};

function findJsonCandidates(content: string): string[] {
  const candidates: string[] = [];
  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
  let fenceMatch: RegExpExecArray | null;

  while ((fenceMatch = fenceRe.exec(content)) !== null) {
    if (fenceMatch[1]?.trim()) {
      candidates.push(fenceMatch[1].trim());
    }
  }

  const raw = content;
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] !== "{") continue;
    let depth = 0;
    for (let j = i; j < raw.length; j += 1) {
      if (raw[j] === "{") depth += 1;
      if (raw[j] === "}") {
        depth -= 1;
        if (depth === 0) {
          const slice = raw.slice(i, j + 1);
          candidates.push(slice);
          break;
        }
      }
    }
  }

  return [...new Set(candidates)];
}

function parseAveraProposal(content: string): AveraProposal | null {
  const candidates = findJsonCandidates(content);
  if (candidates.length === 0) return null;

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      if (
        typeof parsed.athleteUserId !== "string" ||
        typeof parsed.athleteName !== "string" ||
        typeof parsed.name !== "string" ||
        typeof parsed.goal !== "string" ||
        typeof parsed.startDate !== "string" ||
        typeof parsed.endDate !== "string" ||
        (typeof parsed.weeklyMileage !== "number" && typeof parsed.weeklyMileage !== "string") ||
        !Array.isArray(parsed.sessions)
      ) {
        continue;
      }

      const sessions = parsed.sessions.map((s) => {
        const session = s as Record<string, unknown>;
        return {
          weekNumber: Number(session.weekNumber ?? 0),
          dayOfWeek: Number(session.dayOfWeek ?? 0),
          sessionType: String(session.sessionType ?? "easy_run"),
          description: String(session.description ?? "Run"),
          distanceMiles: Number(session.distanceMiles ?? 0),
          durationMinutes: Number(session.durationMinutes ?? 0),
        };
      });

      if (sessions.some((s) => Number.isNaN(s.weekNumber) || Number.isNaN(s.dayOfWeek) || !s.sessionType)) {
        continue;
      }

      return {
        athleteUserId: parsed.athleteUserId,
        athleteName: parsed.athleteName,
        name: parsed.name,
        goal: parsed.goal,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
        weeklyMileage: Number(parsed.weeklyMileage),
        rationale: typeof parsed.rationale === "string" ? parsed.rationale : undefined,
        sessions,
      };
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

function isTrainingPlanResponse(content: string) {
  const normalized = content.toLowerCase();
  const keywords = [
    "training plan",
    "weekly mileage",
    "session",
    "plan",
    "goal",
    "periodization",
    "tempo run",
    "long run",
    "cross training",
    "race",
    "workout",
    "recovery",
    "structured plan",
    "training block",
    "weekly volume",
  ];
  return parseAveraProposal(content) !== null || keywords.some((keyword) => normalized.includes(keyword));
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-2.5 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          h1: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-3 mb-1">{children}</h3>,
          h2: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-3 mb-1">{children}</h3>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-3 mb-1">{children}</h3>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded bg-muted px-1.5 py-0.5 text-[0.85em] font-mono text-foreground">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-lg bg-black/30 border border-border p-3 text-xs font-mono">{children}</pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/40 pl-3 italic text-muted-foreground">{children}</blockquote>
          ),
          hr: () => <hr className="border-border" />,
          table: ({ children }) => (
            <div className="overflow-x-auto"><table className="w-full text-xs border-collapse">{children}</table></div>
          ),
          th: ({ children }) => <th className="border border-border px-2 py-1 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function CoachAI() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [streamMessages, setStreamMessages] = useState<StreamMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [addingPlanMessageIndex, setAddingPlanMessageIndex] = useState<number | null>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  // Set when a conversation is opened so we jump straight to its latest message
  // once the messages have actually rendered (the data loads asynchronously).
  const pendingScrollToBottom = useRef(false);
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const { data: profile } = useGetAthleteProfile();
  const [myTeam, setMyTeam] = useState<null | { id: number; name: string }>(null);

  const { data: conversations, isLoading: convsLoading } = useListOpenaiConversations();
  const createConv = useCreateOpenaiConversation();
  const deleteConv = useDeleteOpenaiConversation();
  const { data: conversation } = useGetOpenaiConversation(selectedId!, {
    query: { enabled: !!selectedId, queryKey: getGetOpenaiConversationQueryKey(selectedId!) },
  });

  useEffect(() => {
    if (conversation?.messages) {
      setStreamMessages(conversation.messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })));
    } else {
      setStreamMessages([]);
    }
  }, [conversation?.id, conversation?.messages?.length]);

  useEffect(() => {
    // Fetch the user's team (if any) so we can suggest plans to the coach instead
    // of attempting a coach-only apply call when the user is an athlete.
    let mounted = true;
    fetch("/api/teams/my", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!mounted) return;
        setMyTeam(d?.team ?? null);
      })
      .catch(() => { if (mounted) setMyTeam(null); });
    return () => { mounted = false; };
  }, []);

  // Pin the messages container to the bottom as content grows, but only when the
  // user is already near the bottom. During streaming we snap instantly to follow
  // token updates; when a message finalises we smooth-scroll to the bottom.
  useEffect(() => {
    if (streamMessages.length === 0) return;
    const el = messagesRef.current;
    const bottomEl = bottomRef.current;
    if (!el || !bottomEl) return;

    // Just opened a conversation: jump instantly to the latest message once it
    // has rendered. Bypasses the near-bottom auto-scroll check.
    if (pendingScrollToBottom.current) {
      pendingScrollToBottom.current = false;
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
      return;
    }

    if (!shouldAutoScroll.current) return;

    const last = streamMessages[streamMessages.length - 1];

    if (last?.streaming) {
      // Snap immediately so token updates don't animate and stay visible.
      el.scrollTop = el.scrollHeight;
      return;
    }

    // Wait until layout stabilises, then smooth-scroll to the bottom.
    // Double rAF helps when images or markdown blocks affect height.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try {
        bottomEl.scrollIntoView({ behavior: "smooth", block: "end" });
      } catch {
        el.scrollTop = el.scrollHeight;
      }
    }));
  }, [streamMessages]);

  // When switching conversations, request a jump to the latest message. The
  // actual scroll happens in the effect above once the messages have rendered.
  useEffect(() => {
    shouldAutoScroll.current = true;
    pendingScrollToBottom.current = true;
  }, [selectedId]);

  function handleMessagesScroll() {
    const el = messagesRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldAutoScroll.current = distanceFromBottom < 80;
  }

  function startNewConversation() {
    createConv.mutate({ data: { title: "New conversation" } }, {
      onSuccess: (conv) => {
        qc.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        setSelectedId(conv.id);
        setStreamMessages([]);
      },
    });
  }

  function handleDeleteConfirm() {
    if (!confirmDeleteId) return;
    const deletingId = confirmDeleteId;
    setConfirmDeleteId(null);
    deleteConv.mutate({ id: deletingId }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
        if (selectedId === deletingId) {
          setSelectedId(null);
          setStreamMessages([]);
        }
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to delete conversation", variant: "destructive" });
      },
    });
  }

  async function sendMessage() {
    if (!input.trim() || !selectedId || isStreaming) return;
    const userContent = input.trim();
    setInput("");
    shouldAutoScroll.current = true;
    setStreamMessages(prev => [...prev, { role: "user", content: userContent }]);
    setStreamMessages(prev => [...prev, { role: "assistant", content: "", streaming: true }]);
    setIsStreaming(true);

    try {
      const response = await fetch(`/api/openai/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: userContent }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";
      let newTitle: string | null = null;
      let planCreated = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) {
                if (typeof data.title === "string") newTitle = data.title;
                if (data.planCreated) planCreated = true;
              } else if (data.content) {
                fullContent += data.content;
                setStreamMessages(prev => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  updated[lastIdx] = { role: "assistant", content: fullContent, streaming: true };
                  return updated;
                });
              }
            } catch {}
          }
        }
      }

      setStreamMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        updated[lastIdx] = { role: "assistant", content: fullContent, streaming: false };
        return updated;
      });
      qc.invalidateQueries({ queryKey: getGetOpenaiConversationQueryKey(selectedId) });
      if (newTitle) {
        const listKey = getListOpenaiConversationsQueryKey();
        qc.setQueryData(listKey, (old: unknown) => {
          if (!Array.isArray(old)) return old;
          return old.map((c: { id: number; title?: string }) =>
            c.id === selectedId ? { ...c, title: newTitle } : c
          );
        });
      }
      qc.invalidateQueries({ queryKey: getListOpenaiConversationsQueryKey() });
      if (planCreated) {
        qc.invalidateQueries({ queryKey: getListTrainingPlansQueryKey() });
        toast({
          title: "Training plan added",
          description: "AveraAI saved it to your Training Plans tab.",
          action: (
            <ToastAction altText="View plans" onClick={() => navigate("/plans")}>
              View
            </ToastAction>
          ),
        });
      }
    } catch {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
      setStreamMessages(prev => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  }

  async function handleAddToTrainingPlan(message: StreamMessage, index: number) {
    if (addingPlanMessageIndex !== null) return;
    setAddingPlanMessageIndex(index);

    let proposal = parseAveraProposal(message.content);
    try {
      if (!proposal) {
        // Only coaches can call the suggest-plan helper on the server — do not
        // attempt that for athletes. If no explicit JSON proposal exists in the
        // message, we can't proceed for athletes.
        if (profile?.userRole === "coach") {
          const suggestResponse = await fetch("/api/openai/suggest-plan", {
            credentials: "include",
          });
          const suggestData = await suggestResponse.json().catch(() => ({}));
          if (!suggestResponse.ok || !suggestData.proposal) {
            throw new Error(suggestData.error || "Failed to generate a training plan");
          }
          proposal = suggestData.proposal as AveraProposal;
        } else {
          throw new Error("Couldn't detect a structured plan in the assistant response. Ask AveraAI to output the plan as JSON or as a fenced ```json``` block.");
        }
      }

      // If the current user is a coach, continue to use the coach-only apply
      // endpoint. If the user is an athlete, either create the plan for them
      // directly (no team) or suggest it to their coach (team exists).
      if (profile?.userRole === "coach") {
        const applyResponse = await fetch(`/api/openai/apply-plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(proposal),
        });
        const applyData = await applyResponse.json().catch(() => ({}));
        if (!applyResponse.ok || !applyData.planId) {
          throw new Error(applyData.error || "Failed to add training plan");
        }

        toast({ title: "Training plan added", description: `${proposal.name} was added for ${proposal.athleteName}.` });
      } else {
        // Athlete path
        if (myTeam) {
          // Suggest the plan to the coach — create a coach notification on the server.
          const res = await fetch(`/api/openai/suggest-to-coach`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(proposal),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "Failed to suggest plan to coach");
          toast({ title: "Suggested to coach", description: `Your coach was notified about "${proposal.name}".` });
        } else {
          // Create a personal plan for the athlete.
          const createRes = await fetch(`/api/plans`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              name: proposal.name,
              goal: proposal.goal,
              startDate: proposal.startDate,
              endDate: proposal.endDate,
              weeklyMileage: proposal.weeklyMileage,
            }),
          });
          const createData = await createRes.json().catch(() => ({}));
          if (!createRes.ok) throw new Error(createData.error || "Failed to add plan to your account");
          toast({ title: "Plan added", description: `${proposal.name} was added to your training plans.` });
        }
      }
    } catch (err) {
      toast({ title: "Unable to add training plan", description: err instanceof Error ? err.message : "Please try again.", variant: "destructive" });
    } finally {
      setAddingPlanMessageIndex(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-background" data-testid="coach-page">
      {/* Conversation sidebar — hidden on mobile; new chats start from the empty state */}
      <div className="hidden md:flex w-56 border-r border-border flex-col shrink-0 bg-background">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">AveraAI</span>
            <span className="text-xs text-muted-foreground">Coach Advisor</span>
          </div>
          <Button
            onClick={startNewConversation}
            disabled={createConv.isPending}
            size="sm"
            className="w-full gap-1.5 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20"
            data-testid="button-new-conversation"
          >
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-auto py-2">
          {convsLoading ? (
            <div className="px-3 space-y-1.5">
              {[...Array(4)].map((_, i) => <div key={i} className="h-9 bg-muted rounded animate-pulse" />)}
            </div>
          ) : !conversations?.length ? (
            <p className="text-xs text-muted-foreground px-4 py-3">No conversations yet</p>
          ) : (
            conversations.map(conv => (
              <div key={conv.id} className="group relative mx-1">
                <button
                  onClick={() => setSelectedId(conv.id)}
                  data-testid={`conversation-${conv.id}`}
                  className={`w-full text-left px-3 py-2 pr-8 text-xs rounded transition-colors ${
                    selectedId === conv.id
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <div className="font-medium truncate">{conv.title}</div>
                  <div className="text-muted-foreground mt-0.5">{format(new Date(conv.createdAt), "MMM d")}</div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(conv.id); }}
                  aria-label="Delete conversation"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600 transition-all"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
              <Bot className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">AveraAI — Coaching Advisor</h2>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
              Ask about athlete load management, team injury risk, training periodization, or how to approach an athlete concern.
            </p>
            <Button
              onClick={startNewConversation}
              data-testid="button-start-chat"
              className="gap-2 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20"
            >
              <Plus className="w-4 h-4" />
              Start a conversation
            </Button>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div ref={messagesRef} onScroll={handleMessagesScroll} className={`flex-1 p-6 space-y-4 ${streamMessages.length === 0 ? "overflow-hidden" : "overflow-auto"}`} data-testid="messages-container">
              {streamMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">Ask AveraAI anything about your team or athletes.</p>
                </div>
              )}
              {streamMessages.map((msg, i) => (
                <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`} data-testid={`message-${i}`}>
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-sm shadow-md whitespace-pre-wrap"
                      : "bg-card border border-border text-foreground rounded-tl-sm shadow-sm"
                  }`}>
                    {msg.role === "assistant"
                      ? (msg.content
                          ? <AssistantMarkdown content={msg.content} />
                          : (msg.streaming && <span className="inline-block w-2 h-4 bg-primary opacity-70 animate-pulse rounded-sm" />))
                      : msg.content}
                  </div>
                  {msg.role === "assistant" && !msg.streaming && isTrainingPlanResponse(msg.content) && (
                    <div className="flex justify-end mt-2">
                      <Button
                        size="icon"
                        onClick={() => handleAddToTrainingPlan(msg, i)}
                        disabled={addingPlanMessageIndex === i}
                        className="h-7 px-3 text-[11px] bg-primary/10 text-primary hover:bg-primary/20"
                      >
                        {addingPlanMessageIndex === i ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
                      </Button>
                    </div>
                  )}
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="border-t border-border p-4 bg-background">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask AveraAI about your team or athletes..."
                  disabled={isStreaming}
                  data-testid="input-message"
                  className="flex-1 bg-muted border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming}
                  data-testid="button-send-message"
                  size="icon"
                  className="bg-primary hover:bg-primary/80 text-[#F5F5F5]"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-card border border-border rounded-xl p-6 w-80 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-foreground mb-1">Delete conversation?</h3>
            <p className="text-xs text-muted-foreground mb-5">This will permanently remove the conversation and all its messages. This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)} className="text-muted-foreground">
                Cancel
              </Button>
              <Button size="sm" onClick={handleDeleteConfirm} className="bg-red-500 hover:bg-red-600 text-foreground">
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
