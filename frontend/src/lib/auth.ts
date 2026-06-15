const USER_KEY = "atlas_user";

let inMemoryToken: string | null = null;
let _initialized = false;

export function getAccessToken(): string | null {
  return inMemoryToken;
}

export function setTokens(access: string): void {
  inMemoryToken = access;
}

export function clearAuth(): void {
  inMemoryToken = null;
  _initialized = false;
  localStorage.removeItem(USER_KEY);
}

export async function initializeAuth(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (_initialized) return true;
  try {
    const res = await fetch("/api/auth/token");
    const data = await res.json();
    if (data.token) {
      inMemoryToken = data.token;
      _initialized = true;
      return true;
    }
  } catch {
    // network error — proceed as unauthenticated
  }
  _initialized = true;
  return false;
}

export function isInitialized(): boolean {
  return _initialized;
}

export function setStoredUser(user: object): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser<T>(): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}
