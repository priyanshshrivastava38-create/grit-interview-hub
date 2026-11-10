import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertTransition,
  badgeTransitions,
  bookingTransitions,
  canTransition,
  eligibilityTransitions,
  humanize,
  interviewTransitions,
  malpracticeTransitions,
  retakeTransitions,
} from "@/lib/state-machine";
import { DomainError } from "@/lib/errors";

describe("booking state machine", () => {
  it("allows the documented booking moves", () => {
    assert.equal(canTransition(bookingTransitions, "CONFIRMED", "CANCELLED"), true);
    assert.equal(canTransition(bookingTransitions, "CONFIRMED", "RESCHEDULED"), true);
    assert.equal(canTransition(bookingTransitions, "CONFIRMED", "COMPLETED"), true);
    assert.equal(canTransition(bookingTransitions, "CONFIRMED", "NO_SHOW"), true);
  });

  it("treats cancelled, rescheduled, no-show and completed as terminal", () => {
    for (const state of ["CANCELLED", "RESCHEDULED", "NO_SHOW", "COMPLETED"] as const) {
      assert.deepEqual(bookingTransitions[state], []);
      assert.equal(canTransition(bookingTransitions, state, "CONFIRMED"), false);
    }
  });

  it("throws a domain error for an illegal transition", () => {
    assert.throws(
      () => assertTransition(bookingTransitions, "CANCELLED", "CONFIRMED", "Booking"),
      (error) => error instanceof DomainError && error.code === "STATE" && /cannot move from/i.test(error.message),
    );
  });
});

describe("interview state machine", () => {
  it("permits the happy path through evaluation to publication", () => {
    assert.equal(canTransition(interviewTransitions, "SCHEDULED", "IN_PROGRESS"), true);
    assert.equal(canTransition(interviewTransitions, "IN_PROGRESS", "RESULT_PENDING"), true);
    assert.equal(canTransition(interviewTransitions, "COMPLETED", "RESULT_PENDING"), true);
    assert.equal(canTransition(interviewTransitions, "RESULT_PENDING", "RESULT_PUBLISHED"), true);
  });

  it("does not allow a published result to move again", () => {
    assert.deepEqual(interviewTransitions.RESULT_PUBLISHED, []);
    assert.equal(canTransition(interviewTransitions, "SCHEDULED", "RESULT_PUBLISHED"), false);
  });
});

describe("badge, retake, malpractice and eligibility machines", () => {
  it("only awards badges through clearance", () => {
    assert.equal(canTransition(badgeTransitions, "NOT_EARNED", "PENDING_CLEARANCE"), true);
    assert.equal(canTransition(badgeTransitions, "PENDING_CLEARANCE", "AWARDED"), true);
    assert.equal(canTransition(badgeTransitions, "AWARDED", "NULLIFIED"), true);
    assert.equal(canTransition(badgeTransitions, "NULLIFIED", "AWARDED"), false);
  });

  it("keeps retake decisions and scheduling ordered", () => {
    assert.equal(canTransition(retakeTransitions, "PENDING", "APPROVED"), true);
    assert.equal(canTransition(retakeTransitions, "APPROVED", "SCHEDULED"), true);
    assert.equal(canTransition(retakeTransitions, "REJECTED", "APPROVED"), false);
  });

  it("requires investigation before confirming malpractice", () => {
    assert.equal(canTransition(malpracticeTransitions, "REPORTED", "UNDER_REVIEW"), true);
    assert.equal(canTransition(malpracticeTransitions, "REPORTED", "CONFIRMED"), false);
    assert.equal(canTransition(malpracticeTransitions, "UNDER_REVIEW", "CONFIRMED"), true);
    assert.equal(canTransition(malpracticeTransitions, "CONFIRMED", "CLOSED"), true);
  });

  it("moves eligibility between eligible, revoked and back", () => {
    assert.equal(canTransition(eligibilityTransitions, "NOT_ELIGIBLE", "ELIGIBLE"), true);
    assert.equal(canTransition(eligibilityTransitions, "ELIGIBLE", "ELIGIBILITY_REVOKED"), true);
    assert.equal(canTransition(eligibilityTransitions, "ELIGIBILITY_REVOKED", "ELIGIBLE"), true);
  });
});

describe("humanize", () => {
  it("expands machine states for UI copy", () => {
    assert.equal(humanize("RESULT_PENDING"), "Result Pending");
    assert.equal(humanize("NO_SHOW"), "No Show");
  });
});
