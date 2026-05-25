"use client";

import { create } from "zustand";

interface PresenceUser {
  user_id: string;
  name: string;
  status: string;
  department?: string;
  role?: string;
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  message_type: string;
  room: string;
  timestamp: string;
}

interface SLAStatus {
  service: string;
  status: string;
  response_time_ms: number;
  threshold_ms: number;
}

interface ActivityEvent {
  actor: string;
  action: string;
  resource: string;
  details?: string;
  department?: string;
  timestamp?: string;
}

interface LiveStore {
  presence: Record<string, PresenceUser>;
  chatMessages: Record<string, ChatMessage[]>;
  slaStatus: Record<string, SLAStatus>;
  activityFeed: ActivityEvent[];
  alertCount: number;
  unreadChats: Set<string>;
  liveUsers: number;

  setPresence: (user: PresenceUser) => void;
  removePresence: (userId: string) => void;
  addChatMessage: (room: string, msg: ChatMessage) => void;
  setSLA: (service: string, status: SLAStatus) => void;
  addActivity: (event: ActivityEvent) => void;
  incrementAlerts: () => void;
  clearAlerts: () => void;
  markChatRead: (room: string) => void;
  setLiveUsers: (count: number) => void;
}

export const useLiveStore = create<LiveStore>((set, get) => ({
  presence: {},
  chatMessages: {},
  slaStatus: {},
  activityFeed: [],
  alertCount: 0,
  unreadChats: new Set(),
  liveUsers: 0,

  setPresence: (user) =>
    set((s) => ({ presence: { ...s.presence, [user.user_id]: user } })),

  removePresence: (userId) =>
    set((s) => {
      const { [userId]: _, ...rest } = s.presence;
      return { presence: rest };
    }),

  addChatMessage: (room, msg) =>
    set((s) => ({
      chatMessages: {
        ...s.chatMessages,
        [room]: [...(s.chatMessages[room] || []), msg].slice(-200),
      },
      unreadChats: new Set(s.unreadChats).add(room),
    })),

  setSLA: (service, status) =>
    set((s) => ({ slaStatus: { ...s.slaStatus, [service]: status } })),

  addActivity: (event) =>
    set((s) => ({
      activityFeed: [event, ...s.activityFeed].slice(0, 200),
    })),

  incrementAlerts: () => set((s) => ({ alertCount: s.alertCount + 1 })),
  clearAlerts: () => set({ alertCount: 0 }),
  markChatRead: (room) =>
    set((s) => {
      const next = new Set(s.unreadChats);
      next.delete(room);
      return { unreadChats: next };
    }),
  setLiveUsers: (count) => set({ liveUsers: count }),
}));
