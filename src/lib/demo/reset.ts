import type { PrismaClient } from "@/generated/prisma/client";
import { seedDemoData } from "./seed";

const TABLES = [
  "AuditLog",
  "Notification",
  "MalpracticeCase",
  "RetakeRequest",
  "BadgeAward",
  "InterviewResult",
  "InterviewEvaluation",
  "Interview",
  "InterviewBooking",
  "InterviewSlot",
  "InterviewerAvailability",
  "Badge",
  "InterviewType",
  "StudentSkillProgress",
  "Skill",
  "InterviewerProfile",
  "StudentProfile",
  "User",
];

/**
 * Demo-only reset. This intentionally wipes every GRIT table and rebuilds the seeded
 * scenarios. In production this endpoint is disabled unless DEMO_MODE=true and the
 * caller is an administrator.
 */
export async function resetAndSeedDemo(prisma: PrismaClient) {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(", ")} RESTART IDENTITY CASCADE;`,
  );
  return seedDemoData(prisma);
}
