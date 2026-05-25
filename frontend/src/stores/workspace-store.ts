import { create } from "zustand";

export interface SavedView {
  id: string;
  name: string;
  filters: Record<string, any>;
  timestamp: number;
}

export interface WidgetLayout {
  id: string;
  title: string;
  size: "sm" | "md" | "lg" | "xl" | "full";
  order: number;
  visible: boolean;
}

export interface WorkspacePreferences {
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  commandPaletteEnabled: boolean;
  globalSearchEnabled: boolean;
  keyboardShortcutsHint: boolean;
  denseMode: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
}

interface WorkspaceState {
  preferences: WorkspacePreferences;
  savedViews: Record<string, SavedView[]>;
  widgetLayouts: Record<string, WidgetLayout[]>;
  setPreference: <K extends keyof WorkspacePreferences>(key: K, value: WorkspacePreferences[K]) => void;
  resetPreferences: () => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  getSavedViews: (page: string) => SavedView[];
  saveView: (page: string, view: SavedView) => void;
  deleteView: (page: string, viewId: string) => void;
  renameView: (page: string, viewId: string, name: string) => void;
  getWidgetLayout: (dashboard: string) => WidgetLayout[];
  setWidgetLayout: (dashboard: string, layouts: WidgetLayout[]) => void;
}

const DEFAULT_PREFERENCES: WorkspacePreferences = {
  sidebarCollapsed: false,
  sidebarWidth: 260,
  commandPaletteEnabled: true,
  globalSearchEnabled: true,
  keyboardShortcutsHint: true,
  denseMode: false,
  reducedMotion: false,
  highContrast: false,
};

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  preferences: DEFAULT_PREFERENCES,
  savedViews: {},
  widgetLayouts: {},

  setPreference: (key, value) =>
    set((state) => ({
      preferences: { ...state.preferences, [key]: value },
    })),

  resetPreferences: () => set({ preferences: DEFAULT_PREFERENCES }),

  toggleSidebar: () =>
    set((state) => ({
      preferences: {
        ...state.preferences,
        sidebarCollapsed: !state.preferences.sidebarCollapsed,
      },
    })),

  setSidebarCollapsed: (collapsed) =>
    set((state) => ({
      preferences: { ...state.preferences, sidebarCollapsed: collapsed },
    })),

  getSavedViews: (page) => get().savedViews[page] || [],

  saveView: (page, view) =>
    set((state) => ({
      savedViews: {
        ...state.savedViews,
        [page]: [...(state.savedViews[page] || []), view],
      },
    })),

  deleteView: (page, viewId) =>
    set((state) => ({
      savedViews: {
        ...state.savedViews,
        [page]: (state.savedViews[page] || []).filter((v) => v.id !== viewId),
      },
    })),

  renameView: (page, viewId, name) =>
    set((state) => ({
      savedViews: {
        ...state.savedViews,
        [page]: (state.savedViews[page] || []).map((v) =>
          v.id === viewId ? { ...v, name } : v
        ),
      },
    })),

  getWidgetLayout: (dashboard) => get().widgetLayouts[dashboard] || [],

  setWidgetLayout: (dashboard, layouts) =>
    set((state) => ({
      widgetLayouts: {
        ...state.widgetLayouts,
        [dashboard]: layouts,
      },
    })),
}));
