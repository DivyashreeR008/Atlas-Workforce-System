import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";
import {
  clearAuth,
  setStoredUser,
  setTokens,
} from "@/lib/auth";
import { authApi } from "@/lib/api";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    name: string;
    department?: string;
    position?: string;
  }) => Promise<void>;
  logout: () => void;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      setUser: (user) => set({ user }),
      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const result = await authApi.login(email, password);
          setTokens(result.token);
          setStoredUser(result.user as User);
          await fetch("/api/auth/set-cookie", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: result.token }),
          });
          set({ user: result.user as User, isLoading: false });
        } catch (e) {
          set({ isLoading: false });
          throw e;
        }
      },
      register: async (payload) => {
        set({ isLoading: true });
        try {
          await authApi.register(payload);
          const result = await authApi.login(payload.email, payload.password);
          setTokens(result.token);
          setStoredUser(result.user as User);
          await fetch("/api/auth/set-cookie", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: result.token }),
          });
          set({ user: result.user as User, isLoading: false });
        } catch (e) {
          set({ isLoading: false });
          throw e;
        }
      },
      logout: async () => {
        try {
          await authApi.logout();
        } catch {
          // proceed with local cleanup regardless
        }
        clearAuth();
        set({ user: null });
        await fetch("/api/auth/clear-cookie", { method: "POST" }).catch(() => {});
        if (typeof window !== "undefined") window.location.href = "/login";
      },
    }),
    { name: "atlas-auth", partialize: (s) => ({ user: s.user }) }
  )
);
