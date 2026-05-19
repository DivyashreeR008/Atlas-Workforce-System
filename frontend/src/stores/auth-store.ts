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
          const { data } = await authApi.login(email, password);
          setTokens(data.token, data.refreshToken);
          setStoredUser(data.user);
          set({ user: data.user, isLoading: false });
        } catch (e) {
          set({ isLoading: false });
          throw e;
        }
      },
      register: async (payload) => {
        set({ isLoading: true });
        try {
          await authApi.register(payload);
          const { data } = await authApi.login(payload.email, payload.password);
          setTokens(data.token, data.refreshToken);
          setStoredUser(data.user);
          set({ user: data.user, isLoading: false });
        } catch (e) {
          set({ isLoading: false });
          throw e;
        }
      },
      logout: () => {
        clearAuth();
        set({ user: null });
      },
    }),
    { name: "atlas-auth", partialize: (s) => ({ user: s.user }) }
  )
);
