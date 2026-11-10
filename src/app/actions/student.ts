"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStudent } from "@/lib/auth";
import { bookSlot, cancelBooking, rescheduleBooking } from "@/lib/booking";
import { actionError, DomainError, type ActionResult } from "@/lib/errors";
import { requestRetake } from "@/lib/retakes";

function revalidateStudentSurfaces() {
  revalidatePath("/student");
  revalidatePath("/student/book");
  revalidatePath("/student/interviews");
  revalidatePath("/student/badge");
  revalidatePath("/interviewer");
  revalidatePath("/interviewer/interviews");
  revalidatePath("/admin");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/results");
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the submitted values.";
}

export async function bookSlotAction(
  slotId: string,
  idempotencyKey?: string,
): Promise<ActionResult<{ bookingId: string }>> {
  try {
    const user = await requireStudent();
    if (!z.string().min(1).safeParse(slotId).success) {
      throw new DomainError("VALIDATION", "Choose a valid interview slot.");
    }
    const result = await bookSlot({
      studentId: user.studentId,
      slotId,
      actorUserId: user.id,
      idempotencyKey,
    });
    revalidateStudentSurfaces();
    return { ok: true, data: { bookingId: result.bookingId } };
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelBookingAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireStudent();
    const parsed = z
      .object({
        bookingId: z.string().min(1),
        reason: z.string().max(500).optional(),
      })
      .safeParse({
        bookingId: String(formData.get("bookingId") ?? ""),
        reason: String(formData.get("reason") ?? ""),
      });
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error), code: "VALIDATION" };

    await cancelBooking({
      bookingId: parsed.data.bookingId,
      actorUserId: user.id,
      actorRole: "STUDENT",
      studentId: user.studentId,
      reason: parsed.data.reason || "Cancelled by student",
    });
    revalidateStudentSurfaces();
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function rescheduleBookingAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireStudent();
    const parsed = z
      .object({
        bookingId: z.string().min(1),
        newSlotId: z.string().min(1),
      })
      .safeParse({
        bookingId: String(formData.get("bookingId") ?? ""),
        newSlotId: String(formData.get("newSlotId") ?? ""),
      });
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error), code: "VALIDATION" };

    await rescheduleBooking({
      bookingId: parsed.data.bookingId,
      newSlotId: parsed.data.newSlotId,
      actorUserId: user.id,
      actorRole: "STUDENT",
      studentId: user.studentId,
      reason: "Rescheduled by student",
    });
    revalidateStudentSurfaces();
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function requestRetakeAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireStudent();
    const parsed = z
      .object({
        interviewTypeId: z.string().min(1),
        reason: z.string().min(15, "Explain why you are requesting a retake (15 characters minimum)."),
      })
      .safeParse({
        interviewTypeId: String(formData.get("interviewTypeId") ?? ""),
        reason: String(formData.get("reason") ?? ""),
      });
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error), code: "VALIDATION" };

    await requestRetake({
      studentId: user.studentId,
      actorUserId: user.id,
      interviewTypeId: parsed.data.interviewTypeId,
      reason: parsed.data.reason,
    });
    revalidateStudentSurfaces();
    revalidatePath("/admin/retakes");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
