import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STUDENT_MESSAGES } from "@/lib/notifications";

describe("student notification copy", () => {
  it("matches the assignment copy for eligibility unlock", () => {
    assert.equal(
      STUDENT_MESSAGES.eligibilityUnlocked,
      "Congratulations! You have completed the required skill milestones and are now eligible for your GRIT interview. Choose an available slot to begin your badge clearance journey.",
    );
  });

  it("matches the assignment copy for booking confirmation", () => {
    assert.equal(
      STUDENT_MESSAGES.bookingConfirmed,
      "Your GRIT interview has been successfully booked. Your interview details are available in your dashboard. Please review your scheduled date and time and be ready before the interview begins.",
    );
  });

  it("matches the assignment copy for a pass", () => {
    assert.equal(
      STUDENT_MESSAGES.resultPass,
      "Congratulations! You have successfully cleared your GRIT interview. Your badge has been awarded and is now available in your dashboard.",
    );
  });

  it("matches the assignment copy for a fail", () => {
    assert.equal(
      STUDENT_MESSAGES.resultFail,
      "Your GRIT interview result has been published. You have not cleared this attempt. Please review your feedback and follow the retake instructions shown in your dashboard.",
    );
  });

  it("matches the assignment copy for retake later", () => {
    assert.equal(
      STUDENT_MESSAGES.resultRetake,
      "Your interview has been evaluated. A further attempt is recommended after the specified waiting period. Please check your dashboard for the next eligible date and instructions.",
    );
  });
});
