const required = (name: string, fallback?: string) => {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

export const env = {
  databaseUrl: required("DATABASE_URL"),
  authSecret: required("AUTH_SECRET", process.env.NODE_ENV === "test" ? "test-secret" : undefined),
  appTimezone: process.env.APP_TIMEZONE ?? "Asia/Kolkata",
  demoMode: (process.env.DEMO_MODE ?? "true") === "true",
  isProduction: process.env.NODE_ENV === "production",
};
