import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

function connectionString(): string {
  const url = new URL(env.databaseUrl);
  const local = ["localhost", "127.0.0.1", "::1", "0.0.0.0"].includes(url.hostname);
  if (!local && !url.searchParams.has("sslmode")) url.searchParams.set("sslmode", "require");
  return url.toString();
}

function createPrismaClient() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: connectionString() }) });
}

type PrismaClientInstance = ReturnType<typeof createPrismaClient>;

const globalForPrisma = globalThis as unknown as { gritPrisma?: PrismaClientInstance };

export const prisma: PrismaClientInstance =
  globalForPrisma.gritPrisma ?? (globalForPrisma.gritPrisma = createPrismaClient());

export type { PrismaClientInstance as DbClient };
