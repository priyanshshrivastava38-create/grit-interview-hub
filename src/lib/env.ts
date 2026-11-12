import { createHash } from "node:crypto";

const required = (name: string, fallback?: string) => {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const demoMode = (process.env.DEMO_MODE ?? "true") === "true";

function resolveAuthSecret(databaseUrl: string): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === "test") return "test-secret";
  if (demoMode) {
    return createHash("sha256").update(`grit-demo-session:${databaseUrl}`).digest("hex");
  }
  throw new Error("Missing required environment variable: AUTH_SECRET");
}

const databaseUrl = required("DATABASE_URL");

export const env = {
  databaseUrl,
  authSecret: resolveAuthSecret(databaseUrl),
  appTimezone: process.env.APP_TIMEZONE ?? "Asia/Kolkata",
  demoMode,
  isProduction: process.env.NODE_ENV === "production",
};
