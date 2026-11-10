import type { MalpracticeBadgeAction, MalpracticeStatus } from "@/generated/prisma/enums";
import { recordAudit } from "./audit";
import { setBadgeStatusTx } from "./badges";
import { prisma } from "./db";
import { DomainError } from "./errors";
import { notify } from "./notifications";
import { assertTransition, malpracticeTransitions } from "./state-machine";

export async function reportMalpractice(input: {
  studentId: string;
  interviewId: string;
  adminUserId: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  allegation: string;
  evidence?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (input.allegation.trim().length < 20) {
    throw new DomainError("VALIDATION", "Describe the allegation in at least 20 characters.");
  }
  if (!["LOW", "MEDIUM", "HIGH"].includes(input.severity)) {
    throw new DomainError("VALIDATION", "Choose a valid severity.");
  }

  return prisma.$transaction(async (tx) => {
    const interview = await tx.interview.findUnique({
      where: { id: input.interviewId },
      include: { student: true },
    });
    if (!interview) throw new DomainError("NOT_FOUND", "Interview not found.");
    if (interview.studentId !== input.studentId) {
      throw new DomainError("VALIDATION", "That interview does not belong to the selected student.");
    }

    const existing = await tx.malpracticeCase.findFirst({
      where: {
        interviewId: input.interviewId,
        status: { in: ["REPORTED", "UNDER_REVIEW", "CONFIRMED"] },
      },
    });
    if (existing) throw new DomainError("CONFLICT", "An open malpractice case already exists for this interview.");

    const created = await tx.malpracticeCase.create({
      data: {
        studentId: input.studentId,
        interviewId: input.interviewId,
        reportedByUserId: input.adminUserId,
        severity: input.severity,
        allegation: input.allegation.trim(),
        evidence: input.evidence?.trim() || null,
        status: "REPORTED",
        createdAt: now,
      },
    });

    await recordAudit(tx, {
      actorUserId: input.adminUserId,
      actorRole: "ADMIN",
      action: "malpractice.reported",
      entityType: "MalpracticeCase",
      entityId: created.id,
      summary: `Malpractice allegation reported (${input.severity}).`,
      newValue: { severity: input.severity, interviewId: input.interviewId },
      createdAt: now,
    });

    return created;
  });
}

export async function updateMalpracticeCase(input: {
  caseId: string;
  adminUserId: string;
  status: MalpracticeStatus;
  resolution?: string;
  badgeAction?: MalpracticeBadgeAction;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "MalpracticeCase" WHERE id = ${input.caseId} FOR UPDATE`;
      const existing = await tx.malpracticeCase.findUnique({
        where: { id: input.caseId },
        include: {
          student: { include: { user: true } },
          interview: { include: { interviewType: true, result: true } },
        },
      });
      if (!existing) throw new DomainError("NOT_FOUND", "Malpractice case not found.");
      assertTransition(malpracticeTransitions, existing.status, input.status, "Malpractice case");

      if (input.status === "CONFIRMED") {
        if (!input.resolution || input.resolution.trim().length < 15) {
          throw new DomainError("VALIDATION", "Document the investigation outcome (15 characters minimum).");
        }
        if (!input.badgeAction) {
          throw new DomainError("VALIDATION", "Choose how the badge should be affected.");
        }
        if (input.badgeAction !== "NONE") {
          const award = await tx.badgeAward.findFirst({
            where: { studentId: existing.studentId, badge: { interviewTypeId: existing.interview.interviewTypeId } },
          });
          if (!award) {
            throw new DomainError(
              "VALIDATION",
              "This student has no awarded badge for the interview type, so there is nothing to suspend or nullify.",
            );
          }
          await setBadgeStatusTx(tx, {
            awardId: award.id,
            adminUserId: input.adminUserId,
            status: input.badgeAction === "SUSPEND" ? "SUSPENDED" : "NULLIFIED",
            note: `Malpractice case ${existing.id} confirmed: ${input.resolution.trim()}`,
            now,
          });
        }
      }

      const updated = await tx.malpracticeCase.update({
        where: { id: existing.id },
        data: {
          status: input.status,
          resolution: input.resolution?.trim() || existing.resolution,
          badgeAction: input.badgeAction ?? existing.badgeAction,
          confirmedByUserId: input.status === "CONFIRMED" ? input.adminUserId : existing.confirmedByUserId,
          confirmedAt: input.status === "CONFIRMED" ? now : existing.confirmedAt,
        },
      });

      if (input.status === "CONFIRMED" || input.status === "REJECTED" || input.status === "CLOSED") {
        const body =
          input.status === "CONFIRMED"
            ? `Interview operations has concluded its review of the integrity concern on your interview. ${
                input.badgeAction === "SUSPEND"
                  ? "Your badge has been suspended pending further review."
                  : input.badgeAction === "NULLIFY"
                    ? "Your badge has been nullified."
                    : "No badge change was required."
              } Your original interview result and evaluation remain on record.`
            : input.status === "REJECTED"
              ? "Interview operations reviewed an integrity concern on your interview and closed the case without adverse findings. No action has been taken against your record."
              : "The integrity review on your interview record has been closed. Contact interview operations if you need more information.";
        await notify(tx, {
          userId: existing.student.userId,
          type: "MALPRACTICE_UPDATE",
          title: input.status === "CONFIRMED" ? "Review concluded" : "Review update",
          body,
          link: "/student/badge",
          createdAt: now,
        });
      }

      await recordAudit(tx, {
        actorUserId: input.adminUserId,
        actorRole: "ADMIN",
        action: `malpractice.${input.status.toLowerCase()}`,
        entityType: "MalpracticeCase",
        entityId: existing.id,
        summary: `Malpractice case moved from ${existing.status} to ${input.status}.`,
        previousValue: { status: existing.status },
        newValue: {
          status: input.status,
          resolution: input.resolution ?? null,
          badgeAction: input.badgeAction ?? existing.badgeAction,
        },
        createdAt: now,
      });

      return updated;
    },
    { timeout: 15_000 },
  );
}
