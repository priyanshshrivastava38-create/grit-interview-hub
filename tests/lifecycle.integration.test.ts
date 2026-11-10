import assert from "node:assert/strict";
import { after, afterEach, beforeEach, describe, it } from "node:test";
import { bookSlot } from "@/lib/booking";
import { prisma } from "@/lib/db";
import { restoreEligibility, revokeEligibility } from "@/lib/eligibility-admin";
import { DomainError } from "@/lib/errors";
import { startInterview, submitEvaluation } from "@/lib/interviews";
import { reportMalpractice, updateMalpracticeCase } from "@/lib/malpractice";
import { STUDENT_MESSAGES } from "@/lib/notifications";
import { publishResult } from "@/lib/results";
import { requestRetake, reviewRetake } from "@/lib/retakes";
import { addStudent, cleanupWorld, createWorld, type TestWorld } from "./helpers/fixtures";

function expectCode(error: unknown, code: string) {
  assert.ok(error instanceof DomainError, `expected DomainError, received ${String(error)}`);
  assert.equal((error as DomainError).code, code);
  return true;
}

async function bookFirstSlot(world: TestWorld, studentId: string, userId: string, slotIndex = 0) {
  return bookSlot({
    studentId,
    slotId: world.slots[slotIndex].id,
    actorUserId: userId,
    interviewTypeId: world.type.id,
  });
}

async function evaluate(
  world: TestWorld,
  interviewId: string,
  recommendation: "PASS" | "FAIL" | "RETAKE_LATER",
  scores = { technical: 80, problem: 80, communication: 80 },
) {
  return submitEvaluation({
    interviewId,
    interviewerId: world.interviewer.id,
    actorUserId: world.interviewerUser.id,
    technicalScore: scores.technical,
    problemSolvingScore: scores.problem,
    communicationScore: scores.communication,
    strengths: "Strong structured thinking and clear trade-off reasoning.",
    improvements: "Deepen testing strategy and failure-mode analysis.",
    notes: "Integration test evaluation.",
    recommendation,
  });
}

describe("evaluation, publication and badge lifecycle", () => {
  let world: TestWorld;

  beforeEach(async () => {
    world = await createWorld("lifecycle");
  });

  afterEach(async () => {
    await cleanupWorld(world);
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it("publishes a pass, awards the badge and notifies with the exact copy", async () => {
    const { student, user } = await addStudent(world);
    const booking = await bookFirstSlot(world, student.id, user.id);

    await startInterview({
      interviewId: booking.interviewId,
      interviewerId: world.interviewer.id,
      actorUserId: world.interviewerUser.id,
    });
    const evaluation = await evaluate(world, booking.interviewId, "PASS", {
      technical: 90,
      problem: 80,
      communication: 70,
    });
    assert.equal(evaluation.overallScore, 80);

    const published = await publishResult({
      interviewId: booking.interviewId,
      adminUserId: world.admin.id,
      feedbackSummary: "Cleared the bar with strong product thinking and clear communication.",
    });
    assert.equal(published.outcome, "PASS");

    const interview = await prisma.interview.findUniqueOrThrow({ where: { id: booking.interviewId } });
    assert.equal(interview.status, "RESULT_PUBLISHED");
    assert.equal(interview.outcome, "PASS");

    const award = await prisma.badgeAward.findFirstOrThrow({ where: { studentId: student.id } });
    assert.equal(award.status, "AWARDED");
    assert.equal(award.badgeId, world.badge.id);
    assert.ok(award.awardedAt);

    const result = await prisma.interviewResult.findUniqueOrThrow({ where: { interviewId: booking.interviewId } });
    assert.equal(result.overallScore, 80);
    assert.equal(result.feedbackSummary, "Cleared the bar with strong product thinking and clear communication.");

    const notifications = await prisma.notification.findMany({
      where: { userId: user.id, type: { in: ["RESULT_PUBLISHED", "BADGE_AWARDED"] } },
    });
    const resultNotification = notifications.find((notification) => notification.type === "RESULT_PUBLISHED");
    assert.equal(resultNotification?.body, STUDENT_MESSAGES.resultPass);
    assert.ok(notifications.some((notification) => notification.type === "BADGE_AWARDED"));

    const audit = await prisma.auditLog.findFirst({
      where: { entityId: booking.interviewId, action: "result.published" },
    });
    assert.ok(audit);
  });

  it("refuses to evaluate for another interviewer and refuses a second evaluation", async () => {
    const { student, user } = await addStudent(world);
    const booking = await bookFirstSlot(world, student.id, user.id);

    await assert.rejects(
      submitEvaluation({
        interviewId: booking.interviewId,
        interviewerId: "not-the-assigned-interviewer",
        actorUserId: world.interviewerUser.id,
        technicalScore: 70,
        problemSolvingScore: 70,
        communicationScore: 70,
        strengths: "Enough detail to pass validation.",
        improvements: "Enough detail to pass validation.",
        notes: "",
        recommendation: "PASS",
      }),
      (error) => expectCode(error, "FORBIDDEN"),
    );

    await evaluate(world, booking.interviewId, "PASS");
    await assert.rejects(
      evaluate(world, booking.interviewId, "FAIL"),
      (error) => expectCode(error, "CONFLICT"),
    );
  });

  it("rejects invalid evaluation scores", async () => {
    const { student, user } = await addStudent(world);
    const booking = await bookFirstSlot(world, student.id, user.id);

    await assert.rejects(
      evaluate(world, booking.interviewId, "PASS", { technical: 101, problem: 70, communication: 70 }),
      (error) => expectCode(error, "VALIDATION"),
    );
  });

  it("cannot publish a result before an evaluation exists", async () => {
    const { student, user } = await addStudent(world);
    const booking = await bookFirstSlot(world, student.id, user.id);

    await assert.rejects(
      publishResult({
        interviewId: booking.interviewId,
        adminUserId: world.admin.id,
        feedbackSummary: "This should not be allowed yet.",
      }),
      (error) => expectCode(error, "STATE"),
    );
  });

  it("cannot publish the same result twice", async () => {
    const { student, user } = await addStudent(world);
    const booking = await bookFirstSlot(world, student.id, user.id);
    await evaluate(world, booking.interviewId, "FAIL", { technical: 40, problem: 50, communication: 60 });
    await publishResult({
      interviewId: booking.interviewId,
      adminUserId: world.admin.id,
      feedbackSummary: "Not cleared on this attempt. Feedback is available.",
    });

    await assert.rejects(
      publishResult({
        interviewId: booking.interviewId,
        adminUserId: world.admin.id,
        feedbackSummary: "Attempting to publish twice.",
      }),
      (error) => expectCode(error, "CONFLICT"),
    );
  });

  it("blocks the wait period, then allows an approved early retake", async () => {
    const { student, user } = await addStudent(world);
    const firstBooking = await bookFirstSlot(world, student.id, user.id, 0);
    await evaluate(world, firstBooking.interviewId, "FAIL", { technical: 40, problem: 50, communication: 45 });
    const published = await publishResult({
      interviewId: firstBooking.interviewId,
      adminUserId: world.admin.id,
      feedbackSummary: "Not cleared. A further attempt is recommended after the waiting period.",
    });
    assert.ok(published.retakeEligibleFrom);
    assert.ok(published.retakeEligibleFrom!.getTime() > Date.now());

    await assert.rejects(
      bookFirstSlot(world, student.id, user.id, 1),
      (error) => {
        expectCode(error, "POLICY");
        assert.match((error as DomainError).message, /retake window opens/i);
        return true;
      },
    );

    const retake = await requestRetake({
      studentId: student.id,
      actorUserId: user.id,
      interviewTypeId: world.type.id,
      reason: "I have completed two additional projects and want to retake earlier.",
    });
    assert.equal(retake.status, "PENDING");

    const reviewed = await reviewRetake({
      requestId: retake.id,
      adminUserId: world.admin.id,
      decision: "APPROVED",
      note: "Additional preparation is evidenced.",
    });
    assert.equal(reviewed.status, "APPROVED");

    const secondBooking = await bookFirstSlot(world, student.id, user.id, 1);
    assert.ok(secondBooking.bookingId);
    const booking = await prisma.interviewBooking.findUniqueOrThrow({ where: { id: secondBooking.bookingId } });
    assert.equal(booking.status, "CONFIRMED");
    assert.equal(booking.attemptNumber, 2);

    const updatedRetake = await prisma.retakeRequest.findUniqueOrThrow({ where: { id: retake.id } });
    assert.equal(updatedRetake.status, "SCHEDULED");
    assert.equal(
      await prisma.notification.count({ where: { userId: user.id, type: "RETAKE_UPDATED" } }),
      1,
    );
  });

  it("confirms malpractice, nullifies the badge and preserves the published result", async () => {
    const { student, user } = await addStudent(world);
    const booking = await bookFirstSlot(world, student.id, user.id);
    await evaluate(world, booking.interviewId, "PASS");
    await publishResult({
      interviewId: booking.interviewId,
      adminUserId: world.admin.id,
      feedbackSummary: "Cleared the bar. Badge awarded pending integrity review.",
    });

    const allegation = "Candidate appeared to receive outside assistance during the live coding exercise.";
    const report = await reportMalpractice({
      studentId: student.id,
      interviewId: booking.interviewId,
      adminUserId: world.admin.id,
      severity: "HIGH",
      allegation,
    });

    await assert.rejects(
      reportMalpractice({
        studentId: student.id,
        interviewId: booking.interviewId,
        adminUserId: world.admin.id,
        severity: "LOW",
        allegation: "Duplicate report for the same interview should be rejected.",
      }),
      (error) => expectCode(error, "CONFLICT"),
    );

    await assert.rejects(
      updateMalpracticeCase({
        caseId: report.id,
        adminUserId: world.admin.id,
        status: "CONFIRMED",
        resolution: "Skipping investigation should not be allowed.",
        badgeAction: "NULLIFY",
      }),
      (error) => expectCode(error, "STATE"),
    );

    await updateMalpracticeCase({
      caseId: report.id,
      adminUserId: world.admin.id,
      status: "UNDER_REVIEW",
    });
    await updateMalpracticeCase({
      caseId: report.id,
      adminUserId: world.admin.id,
      status: "CONFIRMED",
      resolution: "Session recording confirms unauthorised assistance. Badge nullified.",
      badgeAction: "NULLIFY",
    });

    const award = await prisma.badgeAward.findFirstOrThrow({ where: { studentId: student.id } });
    assert.equal(award.status, "NULLIFIED");
    const result = await prisma.interviewResult.findUniqueOrThrow({ where: { interviewId: booking.interviewId } });
    assert.equal(result.outcome, "PASS");

    await updateMalpracticeCase({
      caseId: report.id,
      adminUserId: world.admin.id,
      status: "CLOSED",
    });
    const closed = await prisma.malpracticeCase.findUniqueOrThrow({ where: { id: report.id } });
    assert.equal(closed.status, "CLOSED");
    assert.equal(closed.badgeAction, "NULLIFY");
    assert.ok(
      (await prisma.notification.count({ where: { userId: user.id, type: "MALPRACTICE_UPDATE" } })) >= 2,
    );
  });

  it("revokes and restores eligibility with audit history", async () => {
    const { student, user } = await addStudent(world, { eligibility: "NOT_ELIGIBLE" });

    await restoreEligibility({
      studentId: student.id,
      adminUserId: world.admin.id,
      reason: "Required milestones verified by the program team.",
    });
    let profile = await prisma.studentProfile.findUniqueOrThrow({ where: { id: student.id } });
    assert.equal(profile.eligibilityStatus, "ELIGIBLE");
    assert.ok(profile.eligibleAt);

    await revokeEligibility({
      studentId: student.id,
      adminUserId: world.admin.id,
      reason: "Attendance policy violation requires review.",
    });
    profile = await prisma.studentProfile.findUniqueOrThrow({ where: { id: student.id } });
    assert.equal(profile.eligibilityStatus, "ELIGIBILITY_REVOKED");

    await restoreEligibility({
      studentId: student.id,
      adminUserId: world.admin.id,
      reason: "Review completed with no further action needed.",
    });
    profile = await prisma.studentProfile.findUniqueOrThrow({ where: { id: student.id } });
    assert.equal(profile.eligibilityStatus, "ELIGIBLE");

    assert.equal(
      await prisma.notification.count({ where: { userId: user.id, type: "ELIGIBILITY_UNLOCKED" } }),
      2,
    );
    assert.equal(
      await prisma.auditLog.count({ where: { entityId: student.id, entityType: "StudentProfile" } }),
      3,
    );
  });
});
