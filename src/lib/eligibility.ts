import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { recordAudit } from "./audit";
import { STUDENT_MESSAGES, notify } from "./notifications";

type EligibilityDb = Pick<PrismaClient, "studentProfile" | "skill">;

export type EligibilityResult = {
  eligible: boolean;
  completedSkills: number;
  requiredSkills: number;
  completedSkillIds: string[];
  missingSkills: Array<{ id: string; name: string; status: string }>;
};

export async function computeEligibility(db: EligibilityDb, studentId: string): Promise<EligibilityResult> {
  const [student, requiredSkills] = await Promise.all([
    db.studentProfile.findUnique({
      where: { id: studentId },
      include: { skills: { include: { skill: true } } },
    }),
    db.skill.findMany({ where: { isRequired: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  if (!student) throw new Error(`Student ${studentId} not found`);

  const progressBySkill = new Map(student.skills.map((entry) => [entry.skillId, entry]));
  const completed: string[] = [];
  const missing: EligibilityResult["missingSkills"] = [];

  for (const skill of requiredSkills) {
    const progress = progressBySkill.get(skill.id);
    if (progress?.status === "COMPLETED") {
      completed.push(skill.id);
    } else {
      missing.push({ id: skill.id, name: skill.name, status: progress?.status ?? "NOT_STARTED" });
    }
  }

  return {
    eligible: requiredSkills.length > 0 && missing.length === 0,
    completedSkills: completed.length,
    requiredSkills: requiredSkills.length,
    completedSkillIds: completed,
    missingSkills: missing,
  };
}

/**
 * Re-derives stored eligibility from skill progress. A manual revocation by operations is
 * sticky: completing a skill does not silently restore a revoked student.
 */
export async function syncEligibility(
  tx: Prisma.TransactionClient,
  studentId: string,
  actorUserId?: string,
  now = new Date(),
): Promise<EligibilityResult & { changed: boolean }> {
  const student = await tx.studentProfile.findUnique({
    where: { id: studentId },
    include: { user: true },
  });
  if (!student) throw new Error(`Student ${studentId} not found`);

  const result = await computeEligibility(tx, studentId);
  let changed = false;

  if (student.eligibilityStatus === "ELIGIBILITY_REVOKED") {
    return { ...result, eligible: false, changed };
  }

  const nextStatus = result.eligible ? "ELIGIBLE" : "NOT_ELIGIBLE";
  if (student.eligibilityStatus !== nextStatus) {
    changed = true;
    await tx.studentProfile.update({
      where: { id: studentId },
      data: {
        eligibilityStatus: nextStatus,
        eligibilityReason: result.eligible
          ? "All required skill milestones completed."
          : `${result.missingSkills.length} required skill milestone(s) still outstanding.`,
        eligibleAt: result.eligible ? (student.eligibleAt ?? now) : null,
      },
    });

    await recordAudit(tx, {
      actorUserId,
      action: result.eligible ? "eligibility.unlocked" : "eligibility.recalculated",
      entityType: "StudentProfile",
      entityId: studentId,
      summary: result.eligible
        ? "Eligibility unlocked after required skill milestones were completed."
        : "Eligibility recalculated from skill progress.",
      previousValue: { eligibilityStatus: student.eligibilityStatus },
      newValue: { eligibilityStatus: nextStatus },
      createdAt: now,
    });

    if (result.eligible) {
      await notify(tx, {
        userId: student.userId,
        type: "ELIGIBILITY_UNLOCKED",
        title: "Eligibility unlocked",
        body: STUDENT_MESSAGES.eligibilityUnlocked,
        link: "/student/book",
        createdAt: now,
      });
    }
  }

  return { ...result, eligible: true === result.eligible && nextStatus === "ELIGIBLE", changed };
}
