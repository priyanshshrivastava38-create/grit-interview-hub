import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { seedDemoData } from "../src/lib/demo/seed";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    if (process.argv.includes("--if-empty") && (await prisma.user.count()) > 0) {
      console.log("GRIT demo data already present; skipping seed.");
      return;
    }
    const { seededAt } = await seedDemoData(prisma);
    console.log(`GRIT demo data seeded at ${seededAt.toISOString()}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
