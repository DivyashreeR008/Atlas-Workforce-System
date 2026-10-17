function isLocalDev(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_ALLOW_LOCALHOST === "true"
  );
}

export function requiredEnv(name: string, localFallback: string): string {
  const value = process.env[name];
  if (value && value.length > 0) return value;
  if (isLocalDev()) return localFallback;
  throw new Error(
    `[frontend boot] Missing required environment variable ${name}. ` +
      `Set ${name} before starting the app. ` +
      `The localhost fallback is local-dev only (NODE_ENV=development or NEXT_PUBLIC_ALLOW_LOCALHOST=true).`
  );
}
