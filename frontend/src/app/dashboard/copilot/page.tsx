"use client";


import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Bot,
  Send,
  Sparkles,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Users,
  Lightbulb,
  Plus,
  Trash2,
  MessageSquare,
  X,
  Loader2,
} from "lucide-react";
import { copilotApi } from "@/lib/api";
import type { CopilotMessage, CopilotSession } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const suggestedActions = [
  { label: "Attrition risk analysis", icon: AlertTriangle },
  { label: "Department productivity", icon: BarChart3 },
  { label: "Hiring forecast Q3", icon: TrendingUp },
  { label: "Skill gap analysis", icon: Users },
  { label: "Generate report", icon: Lightbulb },
];

const quickInsights = [
  { label: "Engagement Score", value: "78%", change: "+3%", trend: "up" },
  { label: "Attrition Risk", value: "12%", change: "-2%", trend: "down" },
  { label: "Hiring Velocity", value: "18d", change: "-4d", trend: "down" },
  { label: "Productivity", value: "92%", change: "+5%", trend: "up" },
];

export default function CopilotPage() {
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I'm your AI workforce assistant. I can help you with analytics, predictions, reports, and workforce insights. Try asking me something or pick a suggestion below.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [insightsOpen, setInsightsOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: sessions } = useQuery({
    queryKey: ["copilot-sessions"],
    queryFn: async () => {
      const { data } = await copilotApi.sessions.list();
      return (Array.isArray(data) ? data : data?.items ?? []) as CopilotSession[];
    },
  });

  const { data: insights } = useQuery({
    queryKey: ["copilot-insights"],
    queryFn: async () => {
      const { data } = await copilotApi.insights();
      return data as Array<{ title: string; description: string; type: string }>;
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      const { data } = await copilotApi.chat.send(message, sessionId);
      return data as { reply: string; sessionId?: string };
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply,
          timestamp: new Date().toISOString(),
        },
      ]);
      if (data.sessionId) setSessionId(data.sessionId);
    },
  });

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const { data } = await copilotApi.sessions.create("New Chat");
      return data as CopilotSession;
    },
    onSuccess: () => {
      setMessages([
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Hello! I'm your AI workforce assistant. How can I help you today?",
          timestamp: new Date().toISOString(),
        },
      ]);
      setSessionId(undefined);
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || sendMutation.isPending) return;
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: text, timestamp: new Date().toISOString() },
    ]);
    setInput("");
    sendMutation.mutate(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-5rem)] gap-4">
      <div className="flex flex-1 flex-col rounded-xl border bg-card/80 backdrop-blur-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">AI Copilot</h2>
              <p className="text-xs text-muted-foreground">Workforce Intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setInsightsOpen(!insightsOpen)}
              className="hidden lg:flex"
            >
              <Sparkles className="h-4 w-4" />
              Insights
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => createSessionMutation.mutate()}
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3",
                  msg.role === "user" && "justify-end"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className="mt-1 text-xs opacity-50">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                {msg.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
                    <span className="text-xs font-medium text-primary-foreground">U</span>
                  </div>
                )}
              </div>
            ))}
            {sendMutation.isPending && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="flex items-center gap-2 rounded-2xl bg-muted/50 px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <div className="border-t p-3">
          {messages.length === 1 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {suggestedActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => {
                      setInput(action.label);
                    }}
                    className="flex items-center gap-1.5 rounded-full border bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <Icon className="h-3 w-3" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything about your workforce..."
              className="flex-1"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || sendMutation.isPending}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "hidden w-80 shrink-0 flex-col gap-4 transition-all duration-200 lg:flex",
          !insightsOpen && "w-0 overflow-hidden"
        )}
      >
        <Card className="glass-panel">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                Quick Insights
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setInsightsOpen(false)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickInsights.map((insight) => (
              <div
                key={insight.label}
                className="flex items-center justify-between rounded-lg border p-2.5"
              >
                <div>
                  <p className="text-xs text-muted-foreground">{insight.label}</p>
                  <p className="text-lg font-bold">{insight.value}</p>
                </div>
                <Badge
                  variant={insight.trend === "up" ? "success" : "destructive"}
                  className="text-xs"
                >
                  {insight.change}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="glass-panel flex-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4 text-primary" />
              Recent Sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {!sessions ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))
            ) : sessions.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No previous sessions</p>
            ) : (
              sessions.slice(0, 6).map((session) => (
                <button
                  key={session.id}
                  onClick={() => setSessionId(session.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
                >
                  <MessageSquare className="h-3 w-3 shrink-0" />
                  <span className="truncate">{session.title}</span>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
