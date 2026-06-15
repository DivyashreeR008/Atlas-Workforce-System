"use client";


import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { aiApi } from "@/lib/api";
import type { AICopilotResponse } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Send, Bot, User, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export default function EmployeeCopilotPage() {
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: "Hi! I'm your Employee Copilot. Ask me about benefits, policies, career development, or anything work-related." }]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  const mutation = useMutation({
    mutationFn: async (query: string) => { const { data } = await aiApi.copilot("employee", query); return data as AICopilotResponse; },
    onSuccess: (data) => setMessages((prev) => [...prev, { role: "assistant", content: data.reply, suggestions: data.suggestions }]),
    onError: () => setMessages((prev) => [...prev, { role: "assistant", content: "I encountered an error. Please try again." }]),
  });

  const handleSend = () => { if (!input.trim() || mutation.isPending) return; setMessages((prev) => [...prev, { role: "user", content: input.trim() }]); mutation.mutate(input.trim()); setInput(""); };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <Card className="glass-panel flex-1 flex flex-col">
        <CardHeader className="pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-5 w-5 text-primary" />Employee Copilot</CardTitle>
            <Badge variant="success" className="gap-1"><Sparkles className="h-3 w-3" />AI Powered</Badge>
          </div>
          <CardDescription>Personal employee experience assistant</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col pt-0 min-h-0">
          <ScrollArea ref={scrollRef} className="flex-1 pr-3">
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex items-start gap-3", msg.role === "user" ? "flex-row-reverse" : "")}>
                  <div className={cn("flex h-8 w-8 items-center justify-center rounded-full shrink-0", msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                    {msg.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={cn("max-w-[75%] rounded-lg px-4 py-2.5", msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {msg.suggestions?.map((s, j) => (
                      <button key={j} onClick={() => setInput(s)} className="text-xs px-2 py-0.5 rounded-full bg-background/50 hover:bg-background/80 transition-colors mr-1 mt-2">{s}</button>
                    ))}
                  </div>
                </div>
              ))}
              {mutation.isPending && <div className="flex items-start gap-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0"><Bot className="h-4 w-4" /></div><div className="space-y-2 flex-1 max-w-[75%]"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div></div>}
            </div>
          </ScrollArea>
          <div className="flex items-center gap-2 pt-3 shrink-0">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Employee Copilot anything..." className="flex-1" onKeyDown={(e) => e.key === "Enter" && handleSend()} />
            <Button size="icon" onClick={handleSend} disabled={!input.trim() || mutation.isPending}><Send className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface Message { role: "user" | "assistant"; content: string; suggestions?: string[]; }
