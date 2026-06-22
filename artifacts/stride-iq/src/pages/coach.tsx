import { useState, useRef, useEffect } from "react";
import {
  useListOpenaiConversations,
  useCreateOpenaiConversation,
  useGetOpenaiConversation,
  getListOpenaiConversationsQueryKey,
  getGetOpenaiConversationQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Send, Bot, User, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type StreamMessage = { role: "user" | "assistant"; content: string; streaming?: boolean };

export default function CoachAI() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [streamMessages, setStreamMessages] = useState<StreamMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: conversations, isLoading: convsLoading } = useListOpenaiConversations();
  const createConv = useCreateOpenaiConversation();
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

  // Pin the messages container to the bottom as content grows, but only when the
  // user is already near the bottom. Scrolling the container directly (instant)
  // avoids the janky, stacked smooth-scroll animations that fired on every token.
  useEffect(() => {
    const el = messagesRef.current;
    if (!el || !shouldAutoScroll.current) return;
    el.scrollTop = el.scrollHeight;
  }, [streamMessages]);

  // When switching conversations, always start pinned to the bottom.
  useEffect(() => {
    shouldAutoScroll.current = true;
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
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
                // done
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
    } catch {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
      setStreamMessages(prev => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex h-screen bg-[#0a0f1e]" data-testid="coach-page">
      {/* Conversation sidebar */}
      <div className="w-56 border-r border-white/10 flex flex-col shrink-0 bg-[#0d1426]">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-cyan-400" />
            <span className="text-sm font-semibold text-white">AveraAI</span>
            <span className="text-xs text-slate-400">Coach Advisor</span>
          </div>
          <Button
            onClick={startNewConversation}
            disabled={createConv.isPending}
            size="sm"
            className="w-full gap-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 hover:text-cyan-200"
            data-testid="button-new-conversation"
          >
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </Button>
        </div>
        <div className="flex-1 overflow-auto py-2">
          {convsLoading ? (
            <div className="px-3 space-y-1.5">
              {[...Array(4)].map((_, i) => <div key={i} className="h-9 bg-white/5 rounded animate-pulse" />)}
            </div>
          ) : !conversations?.length ? (
            <p className="text-xs text-slate-500 px-4 py-3">No conversations yet</p>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setSelectedId(conv.id)}
                data-testid={`conversation-${conv.id}`}
                className={`w-full text-left px-3 py-2 text-xs rounded mx-1 transition-colors ${
                  selectedId === conv.id
                    ? "bg-cyan-500/15 text-cyan-300"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <div className="font-medium truncate">{conv.title}</div>
                <div className="text-slate-500 mt-0.5">{format(new Date(conv.createdAt), "MMM d")}</div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {!selectedId ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="w-14 h-14 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-5">
              <Bot className="w-7 h-7 text-cyan-400" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">AveraAI — Coaching Advisor</h2>
            <p className="text-sm text-slate-400 text-center max-w-sm mb-6">
              Ask about athlete load management, team injury risk, training periodization, or how to approach an athlete concern.
            </p>
            <Button
              onClick={startNewConversation}
              data-testid="button-start-chat"
              className="gap-2 bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20"
            >
              <Plus className="w-4 h-4" />
              Start a conversation
            </Button>
          </div>
        ) : (
          <>
            {/* Messages */}
            <div ref={messagesRef} onScroll={handleMessagesScroll} className="flex-1 overflow-auto p-6 space-y-4" data-testid="messages-container">
              {streamMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full">
                  <p className="text-sm text-slate-500">Ask AveraAI anything about your team or athletes.</p>
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
                      ? "bg-primary text-primary-foreground rounded-tr-sm shadow-md"
                      : "bg-card border border-border text-foreground rounded-tl-sm shadow-sm"
                  }`}>
                    {msg.content || (msg.streaming && <span className="inline-block w-2 h-4 bg-primary opacity-70 animate-pulse rounded-sm" />)}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="border-t border-white/10 p-4 bg-[#0d1426]">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask AveraAI about your team or athletes..."
                  disabled={isStreaming}
                  data-testid="input-message"
                  className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/50"
                />
                <Button
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming}
                  data-testid="button-send-message"
                  size="icon"
                  className="bg-cyan-600 hover:bg-cyan-500 text-white"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
