import type { Prisma } from "@/generated/prisma/client";
import type { InterviewOutcome } from "@/generated/prisma/enums";
import { recordAudit } from "./audit";
import { prisma } from "./db";
import { DomainError } from "./errors";
import { assertTransition, interviewTransitions } from "./state-machine";

export async function startInterview(input: {
  interviewId: string;
  interviewerId: string;
  actorUserId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  return prisma.$transaction(async (tx) => {
    const interview = await tx.interview.findUnique({
      where: { id: input.interviewId },
      include: { booking: { include: { slot: true } }, student: { include: { user: true } } },
    });
    if (!interview) throw new DomainError("NOT_FOUND", "Interview not found.");
    if (interview.interviewerId !== input.interviewerId) {
      throw new DomainError("FORBIDDEN", "You can only start interviews assigned to you.");
    }
    assertTransition(interviewTransitions, interview.status, "IN_PROGRESS", "Interview");

    await tx.interview.update({
      where: { id: interview.id },
      data: { status: "IN_PROGRESS", startedAt: now },
    });

    await recordAudit(tx, {
      actorUserId: input.actorUserId,
      actorRole: "INTERVIEWER",
      action: "interview.started",
      entityType: "Interview",
      entityId: interview.id,
      summary: `Interview started for ${interview.student.user.name}.`,
      previousValue: { status: interview.status },
      newValue: { status: "IN_PROGRESS" },
      createdAt: now,
    });

    return { status: "IN_PROGRESS" as const };
  });
}

const SCORE_MIN = 0;
const SCORE_MAX = 100;

function validateScore(label: string, value: number) {
  if (!Number.isInteger(value) || value < SCORE_MIN || value > SCORE_MAX) {
    throw new DomainError("VALIDATION", `${label} must be a whole number between ${SCORE_MIN} and ${SCORE_MAX}.`);
  }
}

const OUTCOMES: InterviewOutcome[] = ["PASS", "FAIL", "RETAKE_LATER"];

export type SubmitEvaluationInput = {
  interviewId: string;
  interviewerId: string;
  actorUserId: string;
  technicalScore: number;
  problemSolvingScore: number;
  communicationScore: number;
  strengths: string;
  improvements: string;
  notes: string;
  recommendation: InterviewOutcome;
  now?: Date;
};

export async function submitEvaluation(input: SubmitEvaluationInput) {
  const now = input.now ?? new Date();
  validateScore("Technical knowledge", input.technicalScore);
  validateScore("Problem solving", input.problemSolvingScore);
  validateScore("Communication", input.communicationScore);
  if (!OUTCOMES.includes(input.recommendation)) {
    throw new DomainError("VALIDATION", "Choose a valid final recommendation.");
  }
  if (input.strengths.trim().length < 10) {
    throw new DomainError("VALIDATION", "Describe at least one strength (10 characters minimum).");
  }
  if (input.improvements.trim().length < 10) {
    throw new DomainError("VALIDATION", "Describe at least one area for improvement (10 characters minimum).");
  }

  const overallScore = Math.round(
    (input.technicalScore + input.problemSolvingScore + input.communicationScore) / 3,
  );

  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Interview" WHERE id = ${input.interviewId} FOR UPDATE`;
    const interview = await tx.interview.findUnique({
      where: { id: input.interviewId },
      include: {
        student: { include: { user: true } },
        interviewType: true,
        booking: true,
        evaluation: true,
      },
    });
    if (!interview) throw new DomainError("NOT_FOUND", "Interview not found.");
    if (interview.interviewerId !== input.interviewerId) {
      throw new DomainError("FORBIDDEN", "You are not authorised to evaluate this interview.");
    }
    if (interview.evaluation) {
      throw new DomainError("CONFLICT", "An evaluation has already been submitted for this interview.");
    }
    assertTransition(interviewTransitions, interview.status, "RESULT_PENDING", "Interview");

    await tx.interviewEvaluation.create({
      data: {
        interviewId: interview.id,
        technicalScore: input.technicalScore,
        problemSolvingScore: input.problemSolvingScore,
        communicationScore: input.communicationScore,
        overallScore,
        strengths: input.strengths.trim(),
        improvements: input.improvements.trim(),
        notes: input.notes.trim(),
        recommendation: input.recommendation,
        submittedByUserId: input.actorUserId,
        submittedAt: now,
      },
    });

    await tx.interview.update({
      where: { id: interview.id },
      data: {
        status: "RESULT_PENDING",
        completedAt: now,
        startedAt: interview.startedAt ?? now,
      },
    });
    await tx.interviewBooking.update({
      where: { id: interview.bookingId },
      data: { status: "COMPLETED" },
    });
    await tx.retakeRequest.updateMany({
      where: { studentId: interview.studentId, status: "SCHEDULED" },
      data: { status: "COMPLETED" },
    });

    await prismaNotification(tx, {
      userId: interview.student.userId,
      title: "Interview completed",
      body: `Your GRIT interview for ${interview.interviewType.name} is complete. The evaluation has been submitted and your result is now awaiting publication by interview operations.`,
      link: "/student/interviews",
      now,
    });

    await recordAudit(tx, {
      actorUserId: input.actorUserId,
      actorRole: "INTERVIEWER",
      action: "result.submitted",
      entityType: "Interview",
      entityId: interview.id,
      summary: `Evaluation submitted with recommendation ${input.recommendation} (overall ${overallScore}).`,
      previousValue: { status: interview.status },
      newValue: {
        status: "RESULT_PENDING",
        recommendation: input.recommendation,
        overallScore,
        technicalScore: input.technicalScore,
        problemSolvingScore: input.problemSolvingScore,
        communicationScore: input.communicationScore,
      },
      createdAt: now,
    });

    return { overallScore, status: "RESULT_PENDING" as const };
  });
}

async function prismaNotification(
  tx: Prisma.TransactionClient,
  input: { userId: string; title: string; body: string; link: string; now: Date },
) {
  await tx.notification.create({
    data: {
      userId: input.userId,
      type: "INTERVIEW_COMPLETED",
      title: input.title,
      body: input.body,
      link: input.link,
      createdAt: input.now,
    },
  });
}
