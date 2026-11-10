"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { cancelBooking, markNoShow, rescheduleBooking } from "@/lib/booking";
import { setBadgeStatus } from "@/lib/badges";
import { actionError, DomainError, type ActionResult } from "@/lib/errors";
import { restoreEligibility, revokeEligibility } from "@/lib/eligibility-admin";
import { updateMalpracticeCase, reportMalpractice } from "@/lib/malpractice";
import { publishResult } from "@/lib/results";
import { reviewRetake } from "@/lib/retakes";

function revalidateAdminSurfaces() {
  revalidatePath("/admin");
  revalidatePath("/admin/students");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/interviewers");
  revalidatePath("/admin/results");
  revalidatePath("/admin/retakes");
  revalidatePath("/admin/malpractice");
  revalidatePath("/admin/analytics");
  revalidatePath("/admin/audit");
  revalidatePath("/student");
  revalidatePath("/student/interviews");
  revalidatePath("/student/badge");
  revalidatePath("/student/book");
  revalidatePath("/interviewer");
  revalidatePath("/interviewer/interviews");
  revalidatePath("/interviewer/availability");
  revalidatePath("/notifications");
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the submitted values.";
}

export async function publishResultAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const parsed = z
      .object({
        interviewId: z.string().min(1),
        feedbackSummary: z.string().min(10, "Add a feedback summary (10 characters minimum)."),
      })
      .safeParse({
        interviewId: String(formData.get("interviewId") ?? ""),
        feedbackSummary: String(formData.get("feedbackSummary") ?? ""),
      });
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error), code: "VALIDATION" };
    await publishResult({
      interviewId: parsed.data.interviewId,
      adminUserId: user.id,
      feedbackSummary: parsed.data.feedbackSummary,
    });
    revalidateAdminSurfaces();
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function reassignInterviewAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const parsed = z
      .object({ bookingId: z.string().min(1), newSlotId: z.string().min(1) })
      .safeParse({
        bookingId: String(formData.get("bookingId") ?? ""),
        newSlotId: String(formData.get("newSlotId") ?? ""),
      });
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error), code: "VALIDATION" };
    await rescheduleBooking({
      bookingId: parsed.data.bookingId,
      newSlotId: parsed.data.newSlotId,
      actorUserId: user.id,
      actorRole: "ADMIN",
      reason: "Reassigned by interview operations",
    });
    revalidateAdminSurfaces();
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function markNoShowAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const bookingId = String(formData.get("bookingId") ?? "");
    if (!bookingId) throw new DomainError("VALIDATION", "Booking is missing.");
    await markNoShow({ bookingId, actorUserId: user.id });
    revalidateAdminSurfaces();
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function adminCancelBookingAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const parsed = z
      .object({ bookingId: z.string().min(1), reason: z.string().min(5, "Add a cancellation reason.") })
      .safeParse({
        bookingId: String(formData.get("bookingId") ?? ""),
        reason: String(formData.get("reason") ?? ""),
      });
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error), code: "VALIDATION" };
    await cancelBooking({
      bookingId: parsed.data.bookingId,
      actorUserId: user.id,
      actorRole: "ADMIN",
      reason: parsed.data.reason,
    });
    revalidateAdminSurfaces();
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function revokeEligibilityAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const parsed = z
      .object({
        studentId: z.string().min(1),
        reason: z.string().min(10, "Add a reason (10 characters minimum)."),
      })
      .safeParse({
        studentId: String(formData.get("studentId") ?? ""),
        reason: String(formData.get("reason") ?? ""),
      });
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error), code: "VALIDATION" };
    await revokeEligibility({ ...parsed.data, adminUserId: user.id });
    revalidateAdminSurfaces();
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function restoreEligibilityAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const parsed = z
      .object({
        studentId: z.string().min(1),
        reason: z.string().min(10, "Add a reason (10 characters minimum)."),
      })
      .safeParse({
        studentId: String(formData.get("studentId") ?? ""),
        reason: String(formData.get("reason") ?? ""),
      });
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error), code: "VALIDATION" };
    await restoreEligibility({ ...parsed.data, adminUserId: user.id });
    revalidateAdminSurfaces();
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function reviewRetakeAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const parsed = z
      .object({
        requestId: z.string().min(1),
        decision: z.enum(["APPROVED", "REJECTED"]),
        note: z.string().min(5, "Add a decision note (5 characters minimum)."),
      })
      .safeParse({
        requestId: String(formData.get("requestId") ?? ""),
        decision: String(formData.get("decision") ?? ""),
        note: String(formData.get("note") ?? ""),
      });
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error), code: "VALIDATION" };
    await reviewRetake({ ...parsed.data, adminUserId: user.id });
    revalidateAdminSurfaces();
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function reportMalpracticeAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const parsed = z
      .object({
        studentId: z.string().min(1),
        interviewId: z.string().min(1),
        severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
        allegation: z.string().min(20, "Describe the allegation (20 characters minimum)."),
        evidence: z.string().max(2000).optional(),
      })
      .safeParse({
        studentId: String(formData.get("studentId") ?? ""),
        interviewId: String(formData.get("interviewId") ?? ""),
        severity: String(formData.get("severity") ?? ""),
        allegation: String(formData.get("allegation") ?? ""),
        evidence: String(formData.get("evidence") ?? ""),
      });
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error), code: "VALIDATION" };
    await reportMalpractice({ ...parsed.data, adminUserId: user.id });
    revalidateAdminSurfaces();
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateMalpracticeAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const parsed = z
      .object({
        caseId: z.string().min(1),
        status: z.enum(["UNDER_REVIEW", "CONFIRMED", "REJECTED", "CLOSED"]),
        resolution: z.string().max(2000).optional(),
        badgeAction: z.enum(["NONE", "SUSPEND", "NULLIFY"]).optional(),
      })
      .safeParse({
        caseId: String(formData.get("caseId") ?? ""),
        status: String(formData.get("status") ?? ""),
        resolution: String(formData.get("resolution") ?? ""),
        badgeAction: formData.has("badgeAction") ? String(formData.get("badgeAction")) : undefined,
      });
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error), code: "VALIDATION" };
    await updateMalpracticeCase({ ...parsed.data, adminUserId: user.id });
    revalidateAdminSurfaces();
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function setBadgeStatusAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireRole("ADMIN");
    const parsed = z
      .object({
        awardId: z.string().min(1),
        status: z.enum(["AWARDED", "SUSPENDED", "NULLIFIED"]),
        note: z.string().min(5, "Add a reason (5 characters minimum)."),
      })
      .safeParse({
        awardId: String(formData.get("awardId") ?? ""),
        status: String(formData.get("status") ?? ""),
        note: String(formData.get("note") ?? ""),
      });
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error), code: "VALIDATION" };
    await setBadgeStatus({ ...parsed.data, adminUserId: user.id });
    revalidateAdminSurfaces();
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
