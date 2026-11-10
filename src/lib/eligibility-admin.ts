import { recordAudit } from "./audit";
import { prisma } from "./db";
import { DomainError } from "./errors";
import { notify } from "./notifications";
import { assertTransition, eligibilityTransitions } from "./state-machine";

export async function revokeEligibility(input: {
  studentId: string;
  adminUserId: string;
  reason: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (input.reason.trim().length < 10) {
    throw new DomainError("VALIDATION", "Add a reason for revoking eligibility (10 characters minimum).");
  }

  return prisma.$transaction(async (tx) => {
    const student = await tx.studentProfile.findUnique({
      where: { id: input.studentId },
      include: { user: true },
    });
    if (!student) throw new DomainError("NOT_FOUND", "Student not found.");
    assertTransition(eligibilityTransitions, student.eligibilityStatus, "ELIGIBILITY_REVOKED", "Eligibility");

    await tx.studentProfile.update({
      where: { id: student.id },
      data: {
        eligibilityStatus: "ELIGIBILITY_REVOKED",
        eligibilityReason: input.reason.trim(),
        revokedAt: now,
      },
    });

    await notify(tx, {
      userId: student.userId,
      type: "SYSTEM",
      title: "Eligibility updated",
      body: `Interview operations has placed your interview eligibility on hold. Reason: ${input.reason.trim()}. Please contact your program coordinator for next steps.`,
      link: "/student",
      createdAt: now,
    });

    await recordAudit(tx, {
      actorUserId: input.adminUserId,
      actorRole: "ADMIN",
      action: "eligibility.revoked",
      entityType: "StudentProfile",
      entityId: student.id,
      summary: `Eligibility revoked: ${input.reason.trim()}`,
      previousValue: { eligibilityStatus: student.eligibilityStatus },
      newValue: { eligibilityStatus: "ELIGIBILITY_REVOKED", reason: input.reason.trim() },
      createdAt: now,
    });

    return { status: "ELIGIBILITY_REVOKED" as const };
  });
}

export async function restoreEligibility(input: {
  studentId: string;
  adminUserId: string;
  reason: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (input.reason.trim().length < 10) {
    throw new DomainError("VALIDATION", "Add a reason for restoring eligibility (10 characters minimum).");
  }

  return prisma.$transaction(async (tx) => {
    const student = await tx.studentProfile.findUnique({
      where: { id: input.studentId },
      include: { user: true },
    });
    if (!student) throw new DomainError("NOT_FOUND", "Student not found.");
    assertTransition(eligibilityTransitions, student.eligibilityStatus, "ELIGIBLE", "Eligibility");

    await tx.studentProfile.update({
      where: { id: student.id },
      data: {
        eligibilityStatus: "ELIGIBLE",
        eligibilityReason: input.reason.trim(),
        eligibleAt: student.eligibleAt ?? now,
        revokedAt: null,
      },
    });

    await notify(tx, {
      userId: student.userId,
      type: "ELIGIBILITY_UNLOCKED",
      title: "Eligibility restored",
      body: "Interview operations has restored your interview eligibility. You can now choose an available slot from your dashboard.",
      link: "/student/book",
      createdAt: now,
    });

    await recordAudit(tx, {
      actorUserId: input.adminUserId,
      actorRole: "ADMIN",
      action: "eligibility.restored",
      entityType: "StudentProfile",
      entityId: student.id,
      summary: `Eligibility restored: ${input.reason.trim()}`,
      previousValue: { eligibilityStatus: student.eligibilityStatus },
      newValue: { eligibilityStatus: "ELIGIBLE", reason: input.reason.trim() },
      createdAt: now,
    });

    return { status: "ELIGIBLE" as const };
  });
}
