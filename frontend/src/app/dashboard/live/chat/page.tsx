"use client";

import { useState } from "react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useSSEChannel } from "@/hooks/use-realtime";
import { LiveIndicator } from "@/components/live/live-indicator";
import { PresenceAvatar } from "@/components/live/presence-avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageSquare, Users, Hash } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMsg {
  id: string;
  sender: string;
  message: string;
  message_type: string;
  room: string;
  timestamp: string;
}

interface PresenceUser {
  user_id: string;
  name: string;
  status: string;
  department?: string;
  role?: string;
}

const ROOMS = ["general", "engineering", "hr", "security", "announcements"];

export default function LiveChatPage() {
  const [room, setRoom] = useState("general");
  const [input, setInput] = useState("");
  const { messages: chatMessages, connected: chatConnected, send } = useWebSocket<ChatMsg>(`chat/${room}`);
  const { events: presenceEvents } = useSSEChannel<PresenceUser>("presence");
  const presenceUsers = presenceEvents
    .map((e) => e.data)
    .filter((u) => u?.user_id);
  const uniquePresence = [...new Map(presenceUsers.map((u) => [u.user_id, u])).values()];
  const onlineUsers = uniquePresence.filter((u) => u.status === "online" || u.status === "available");

  const handleSend = () => {
    if (!input.trim()) return;
    send({
      id: crypto.randomUUID(),
      sender: "You",
      message: input.trim(),
      message_type: "text",
      room,
      timestamp: new Date().toISOString(),
    });
    setInput("");
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <div className="w-60 space-y-4 shrink-0">
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm"><Hash className="h-4 w-4" />Rooms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            {ROOMS.map((r) => (
              <button
                key={r}
                onClick={() => setRoom(r)}
                className={cn("w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  room === r ? "bg-primary text-primary-foreground" : "hover:bg-muted")}
              >
                <span className="capitalize">{r}</span>
              </button>
            ))}
          </CardContent>
        </Card>
        <Card className="glass-panel">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4" />
              <span>Online <LiveIndicator connected={chatConnected} /></span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {onlineUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No users online</p>
            ) : (
              <div className="space-y-1.5">
                {onlineUsers.slice(0, 10).map((u) => (
                  <div key={u.user_id} className="flex items-center gap-2 text-xs">
                    <PresenceAvatar name={u.name} status={u.status} />
                    <span className="truncate">{u.name}</span>
                  </div>
                ))}
                {onlineUsers.length > 10 && (
                  <p className="text-[10px] text-muted-foreground">+{onlineUsers.length - 10} more</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel flex-1 flex flex-col">
        <CardHeader className="pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base capitalize">
              <MessageSquare className="h-4 w-4" />
              #{room}
            </CardTitle>
            <LiveIndicator connected={chatConnected} label={chatConnected ? "Connected" : "Connecting..."} />
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col pt-0 min-h-0">
          <ScrollArea className="flex-1 pr-3">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <MessageSquare className="h-8 w-8" />
                <p className="text-sm">No messages yet. Start the conversation!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {chatMessages.map((msg, i) => (
                  <div key={msg.id ?? i} className="flex items-start gap-2 text-sm">
                    <PresenceAvatar name={msg.sender} status="online" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-xs">{msg.sender}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm">{msg.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          <div className="flex items-center gap-2 pt-3 shrink-0">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Message #${room}...`}
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
