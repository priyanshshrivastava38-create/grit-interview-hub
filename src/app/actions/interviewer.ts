"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireInterviewer } from "@/lib/auth";
import {
  createAvailability,
  deleteAvailability,
  setAvailabilityBlocked,
  updateAvailability,
} from "@/lib/availability";
import { actionError, DomainError, type ActionResult } from "@/lib/errors";
import { startInterview, submitEvaluation } from "@/lib/interviews";

function revalidateInterviewerSurfaces() {
  revalidatePath("/interviewer");
  revalidatePath("/interviewer/availability");
  revalidatePath("/interviewer/interviews");
  revalidatePath("/interviewer/history");
  revalidatePath("/student");
  revalidatePath("/student/book");
  revalidatePath("/admin");
  revalidatePath("/admin/results");
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Check the submitted values.";
}

const availabilitySchema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date."),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid start time."),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a valid end time."),
  slotMinutes: z.coerce.number().int().min(15).max(180),
  breakStart: z.string().optional(),
  breakEnd: z.string().optional(),
  note: z.string().max(200).optional(),
});

function availabilityInput(formData: FormData, interviewerId: string, actorUserId: string) {
  return availabilitySchema.safeParse({
    dateKey: String(formData.get("dateKey") ?? ""),
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
    slotMinutes: String(formData.get("slotMinutes") ?? "45"),
    breakStart: String(formData.get("breakStart") ?? ""),
    breakEnd: String(formData.get("breakEnd") ?? ""),
    note: String(formData.get("note") ?? ""),
    interviewerId,
    actorUserId,
  });
}

export async function createAvailabilityAction(formData: FormData): Promise<ActionResult<{ slotCount: number }>> {
  try {
    const user = await requireInterviewer();
    const parsed = availabilityInput(formData, user.interviewerId, user.id);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error), code: "VALIDATION" };
    const result = await createAvailability({
      ...parsed.data,
      interviewerId: user.interviewerId,
      actorUserId: user.id,
    });
    revalidateInterviewerSurfaces();
    return { ok: true, data: { slotCount: result.slotCount } };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateAvailabilityAction(formData: FormData): Promise<ActionResult<{ slotCount: number }>> {
  try {
    const user = await requireInterviewer();
    const availabilityId = String(formData.get("availabilityId") ?? "");
    if (!availabilityId) throw new DomainError("VALIDATION", "Availability window is missing.");
    const parsed = availabilityInput(formData, user.interviewerId, user.id);
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error), code: "VALIDATION" };
    const result = await updateAvailability({
      ...parsed.data,
      availabilityId,
      interviewerId: user.interviewerId,
      actorUserId: user.id,
    });
    revalidateInterviewerSurfaces();
    return { ok: true, data: { slotCount: result.slotCount } };
  } catch (error) {
    return actionError(error);
  }
}

export async function toggleAvailabilityAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireInterviewer();
    const parsed = z
      .object({
        availabilityId: z.string().min(1),
        blocked: z.enum(["true", "false"]),
      })
      .safeParse({
        availabilityId: String(formData.get("availabilityId") ?? ""),
        blocked: String(formData.get("blocked") ?? ""),
      });
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error), code: "VALIDATION" };
    await setAvailabilityBlocked({
      availabilityId: parsed.data.availabilityId,
      interviewerId: user.interviewerId,
      actorUserId: user.id,
      blocked: parsed.data.blocked === "true",
    });
    revalidateInterviewerSurfaces();
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteAvailabilityAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireInterviewer();
    const availabilityId = String(formData.get("availabilityId") ?? "");
    if (!availabilityId) throw new DomainError("VALIDATION", "Availability window is missing.");
    await deleteAvailability({
      availabilityId,
      interviewerId: user.interviewerId,
      actorUserId: user.id,
    });
    revalidateInterviewerSurfaces();
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function startInterviewAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireInterviewer();
    const interviewId = String(formData.get("interviewId") ?? "");
    if (!interviewId) throw new DomainError("VALIDATION", "Interview is missing.");
    await startInterview({ interviewId, interviewerId: user.interviewerId, actorUserId: user.id });
    revalidateInterviewerSurfaces();
    revalidatePath(`/interviewer/interviews/${interviewId}`);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function submitEvaluationAction(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireInterviewer();
    const parsed = z
      .object({
        interviewId: z.string().min(1),
        technicalScore: z.coerce.number().int().min(0).max(100),
        problemSolvingScore: z.coerce.number().int().min(0).max(100),
        communicationScore: z.coerce.number().int().min(0).max(100),
        strengths: z.string().min(10, "Describe at least one strength (10 characters minimum)."),
        improvements: z.string().min(10, "Describe at least one improvement area (10 characters minimum)."),
        notes: z.string().max(2000),
        recommendation: z.enum(["PASS", "FAIL", "RETAKE_LATER"]),
      })
      .safeParse({
        interviewId: String(formData.get("interviewId") ?? ""),
        technicalScore: String(formData.get("technicalScore") ?? ""),
        problemSolvingScore: String(formData.get("problemSolvingScore") ?? ""),
        communicationScore: String(formData.get("communicationScore") ?? ""),
        strengths: String(formData.get("strengths") ?? ""),
        improvements: String(formData.get("improvements") ?? ""),
        notes: String(formData.get("notes") ?? ""),
        recommendation: String(formData.get("recommendation") ?? ""),
      });
    if (!parsed.success) return { ok: false, error: firstIssue(parsed.error), code: "VALIDATION" };

    await submitEvaluation({
      ...parsed.data,
      interviewerId: user.interviewerId,
      actorUserId: user.id,
    });
    revalidateInterviewerSurfaces();
    revalidatePath(`/interviewer/interviews/${parsed.data.interviewId}`);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
