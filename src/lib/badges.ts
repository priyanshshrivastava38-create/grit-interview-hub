import type { Prisma } from "@/generated/prisma/client";
import type { BadgeStatus } from "@/generated/prisma/enums";
import { recordAudit } from "./audit";
import { prisma } from "./db";
import { DomainError } from "./errors";
import { notify } from "./notifications";
import { assertTransition, badgeTransitions } from "./state-machine";

export async function setBadgeStatusTx(
  tx: Prisma.TransactionClient,
  input: {
    awardId: string;
    adminUserId: string;
    status: BadgeStatus;
    note: string;
    now: Date;
  },
) {
  const award = await tx.badgeAward.findUnique({
    where: { id: input.awardId },
    include: { badge: true, student: { include: { user: true } } },
  });
  if (!award) throw new DomainError("NOT_FOUND", "Badge award not found.");
  assertTransition(badgeTransitions, award.status, input.status, "Badge");
  if (!input.note.trim()) throw new DomainError("VALIDATION", "Add a reason for the badge status change.");

  await tx.badgeAward.update({
    where: { id: award.id },
    data: {
      status: input.status,
      statusNote: input.note.trim(),
      awardedAt: input.status === "AWARDED" ? (award.awardedAt ?? input.now) : award.awardedAt,
    },
  });

  const copy: Record<string, string> = {
    AWARDED: `Your ${award.badge.name} badge is active. You can view and share it from your dashboard.`,
    SUSPENDED: `Your ${award.badge.name} badge has been suspended while interview operations review your record. Your original interview result is unchanged.`,
    NULLIFIED: `Your ${award.badge.name} badge has been nullified following an operations review. Your original interview result remains on record.`,
    PENDING_CLEARANCE: `Your ${award.badge.name} badge is awaiting clearance from interview operations.`,
  };

  await notify(tx, {
    userId: award.student.userId,
    type: "BADGE_AWARDED",
    title: input.status === "AWARDED" ? "Badge active" : "Badge status updated",
    body: copy[input.status] ?? `Your badge status changed to ${input.status}.`,
    link: "/student/badge",
    createdAt: input.now,
  });

  await recordAudit(tx, {
    actorUserId: input.adminUserId,
    actorRole: "ADMIN",
    action: "badge.status_changed",
    entityType: "BadgeAward",
    entityId: award.id,
    summary: `Badge ${award.badge.code} changed from ${award.status} to ${input.status}.`,
    previousValue: { status: award.status },
    newValue: { status: input.status, note: input.note.trim() },
    createdAt: input.now,
  });

  return award;
}

export async function setBadgeStatus(input: {
  awardId: string;
  adminUserId: string;
  status: BadgeStatus;
  note: string;
}) {
  return prisma.$transaction((tx) =>
    setBadgeStatusTx(tx, { ...input, now: new Date() }),
  );
}
