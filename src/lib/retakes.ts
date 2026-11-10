import { recordAudit } from "./audit";
import { prisma } from "./db";
import { DomainError } from "./errors";
import { notify } from "./notifications";
import { assertTransition, retakeTransitions } from "./state-machine";
import { formatDate } from "./time";

export async function requestRetake(input: {
  studentId: string;
  actorUserId: string;
  interviewTypeId: string;
  reason: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (input.reason.trim().length < 15) {
    throw new DomainError("VALIDATION", "Explain why you are requesting a retake review (15 characters minimum).");
  }

  return prisma.$transaction(async (tx) => {
    const lastResult = await tx.interview.findFirst({
      where: {
        studentId: input.studentId,
        interviewTypeId: input.interviewTypeId,
        outcome: { in: ["FAIL", "RETAKE_LATER"] },
        resultPublishedAt: { not: null },
      },
      orderBy: { resultPublishedAt: "desc" },
    });
    if (!lastResult) {
      throw new DomainError("STATE", "A retake can only be requested after a published FAIL or RETAKE_LATER result.");
    }
    const pending = await tx.retakeRequest.findFirst({
      where: { studentId: input.studentId, interviewTypeId: input.interviewTypeId, status: "PENDING" },
    });
    if (pending) throw new DomainError("CONFLICT", "You already have a retake request awaiting review.");

    const request = await tx.retakeRequest.create({
      data: {
        studentId: input.studentId,
        interviewId: lastResult.id,
        interviewTypeId: input.interviewTypeId,
        reason: input.reason.trim(),
        status: "PENDING",
        eligibleFrom: lastResult.retakeEligibleFrom ?? now,
        createdAt: now,
      },
    });

    await recordAudit(tx, {
      actorUserId: input.actorUserId,
      actorRole: "STUDENT",
      action: "retake.requested",
      entityType: "RetakeRequest",
      entityId: request.id,
      summary: "Student requested a retake review.",
      newValue: { reason: input.reason.trim(), eligibleFrom: request.eligibleFrom.toISOString() },
      createdAt: now,
    });

    return request;
  });
}

export async function reviewRetake(input: {
  requestId: string;
  adminUserId: string;
  decision: "APPROVED" | "REJECTED";
  note: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (input.note.trim().length < 5) {
    throw new DomainError("VALIDATION", "Add a decision note (5 characters minimum).");
  }

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "RetakeRequest" WHERE id = ${input.requestId} FOR UPDATE`;
    const request = await tx.retakeRequest.findUnique({
      where: { id: input.requestId },
      include: { student: { include: { user: true } } },
    });
    if (!request) throw new DomainError("NOT_FOUND", "Retake request not found.");
    assertTransition(retakeTransitions, request.status, input.decision, "Retake request");

    const updated = await tx.retakeRequest.update({
      where: { id: request.id },
      data: {
        status: input.decision,
        reviewedByUserId: input.adminUserId,
        reviewedAt: now,
        decisionNote: input.note.trim(),
      },
    });

    await notify(tx, {
      userId: request.student.userId,
      type: "RETAKE_UPDATED",
      title: input.decision === "APPROVED" ? "Retake approved" : "Retake request declined",
      body:
        input.decision === "APPROVED"
          ? `Interview operations approved an early retake. You can now book a new interview slot. Your scheduled retake window is ${formatDate(
              request.eligibleFrom,
            )}, but approval allows you to book ahead of that date.`
          : `Interview operations reviewed your retake request and could not approve an earlier attempt. ${
              request.eligibleFrom ? `Your next eligible attempt date is ${formatDate(request.eligibleFrom)}. ` : ""
            }Reason: ${input.note.trim()}`,
      link: "/student/book",
      createdAt: now,
    });

    await recordAudit(tx, {
      actorUserId: input.adminUserId,
      actorRole: "ADMIN",
      action: input.decision === "APPROVED" ? "retake.approved" : "retake.rejected",
      entityType: "RetakeRequest",
      entityId: request.id,
      summary: `Retake request ${input.decision.toLowerCase()}.`,
      previousValue: { status: request.status },
      newValue: { status: input.decision, note: input.note.trim() },
      createdAt: now,
    });

    return updated;
  });
}
