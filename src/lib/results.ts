import { recordAudit } from "./audit";
import { prisma } from "./db";
import { DomainError } from "./errors";
import { STUDENT_MESSAGES, notify } from "./notifications";
import { assertTransition, interviewTransitions } from "./state-machine";
import { addDays } from "./time";

export async function publishResult(input: {
  interviewId: string;
  adminUserId: string;
  feedbackSummary: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  if (input.feedbackSummary.trim().length < 10) {
    throw new DomainError("VALIDATION", "Add a short feedback summary before publishing.");
  }

  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Interview" WHERE id = ${input.interviewId} FOR UPDATE`;
      const interview = await tx.interview.findUnique({
        where: { id: input.interviewId },
        include: {
          evaluation: true,
          result: true,
          student: { include: { user: true } },
          interviewType: true,
          booking: { include: { slot: { include: { interviewer: { include: { user: true } } } } } },
        },
      });
      if (!interview) throw new DomainError("NOT_FOUND", "Interview not found.");
      if (!interview.evaluation) {
        throw new DomainError("STATE", "The interviewer has not submitted an evaluation yet.");
      }
      if (interview.result) {
        throw new DomainError("CONFLICT", "This result has already been published.");
      }
      assertTransition(interviewTransitions, interview.status, "RESULT_PUBLISHED", "Interview");

      const outcome = interview.evaluation.recommendation;
      const overallScore = interview.evaluation.overallScore;

      await tx.interviewResult.create({
        data: {
          interviewId: interview.id,
          outcome,
          overallScore,
          feedbackSummary: input.feedbackSummary.trim(),
          publishedAt: now,
          publishedByUserId: input.adminUserId,
        },
      });

      let retakeEligibleFrom: Date | null = null;
      if (outcome === "PASS") {
        const badge = await tx.badge.findFirst({ where: { interviewTypeId: interview.interviewTypeId } });
        if (badge) {
          await tx.badgeAward.upsert({
            where: { studentId_badgeId: { studentId: interview.studentId, badgeId: badge.id } },
            update: {
              interviewId: interview.id,
              status: "AWARDED",
              awardedAt: now,
              statusNote: "Awarded automatically when the PASS result was published.",
            },
            create: {
              studentId: interview.studentId,
              badgeId: badge.id,
              interviewId: interview.id,
              status: "AWARDED",
              awardedAt: now,
              statusNote: "Awarded automatically when the PASS result was published.",
            },
          });

          await notify(tx, {
            userId: interview.student.userId,
            type: "BADGE_AWARDED",
            title: "Badge awarded",
            body: `Your ${badge.name} badge has been added to your dashboard. It is verifiable against your published interview result.`,
            link: "/student/badge",
            createdAt: now,
          });
        }
      } else {
        retakeEligibleFrom = addDays(now, interview.interviewType.retakeWaitDays);
      }

      await tx.interview.update({
        where: { id: interview.id },
        data: {
          status: "RESULT_PUBLISHED",
          outcome,
          resultPublishedAt: now,
          retakeEligibleFrom,
          completedAt: interview.completedAt ?? now,
        },
      });

      const body =
        outcome === "PASS"
          ? STUDENT_MESSAGES.resultPass
          : outcome === "FAIL"
            ? STUDENT_MESSAGES.resultFail
            : STUDENT_MESSAGES.resultRetake;

      await notify(tx, {
        userId: interview.student.userId,
        type: "RESULT_PUBLISHED",
        title: outcome === "PASS" ? "You passed your GRIT interview" : "Interview result published",
        body,
        link: "/student/interviews",
        createdAt: now,
      });

      await recordAudit(tx, {
        actorUserId: input.adminUserId,
        actorRole: "ADMIN",
        action: "result.published",
        entityType: "Interview",
        entityId: interview.id,
        summary: `Result published: ${outcome} (overall ${overallScore}).`,
        previousValue: { status: interview.status },
        newValue: {
          status: "RESULT_PUBLISHED",
          outcome,
          overallScore,
          retakeEligibleFrom: retakeEligibleFrom?.toISOString() ?? null,
        },
        createdAt: now,
      });

      return { outcome, overallScore, retakeEligibleFrom };
    },
    { timeout: 15_000 },
  );
}
