import type { Prisma } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";

type AuditInput = {
  actorUserId?: string | null;
  actorRole?: Role | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  previousValue?: unknown;
  newValue?: unknown;
  createdAt?: Date;
};

export async function recordAudit(tx: Prisma.TransactionClient, input: AuditInput) {
  return tx.auditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      actorRole: input.actorRole ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      previousValue: input.previousValue === undefined ? undefined : (input.previousValue as Prisma.InputJsonValue),
      newValue: input.newValue === undefined ? undefined : (input.newValue as Prisma.InputJsonValue),
      createdAt: input.createdAt,
    },
  });
}
