import type { Prisma } from "@/generated/prisma/client";
import type { NotificationType } from "@/generated/prisma/enums";

/** Student-facing copy is fixed by the GRIT assignment brief. */
export const STUDENT_MESSAGES = {
  eligibilityUnlocked:
    "Congratulations! You have completed the required skill milestones and are now eligible for your GRIT interview. Choose an available slot to begin your badge clearance journey.",
  bookingConfirmed:
    "Your GRIT interview has been successfully booked. Your interview details are available in your dashboard. Please review your scheduled date and time and be ready before the interview begins.",
  resultPass:
    "Congratulations! You have successfully cleared your GRIT interview. Your badge has been awarded and is now available in your dashboard.",
  resultFail:
    "Your GRIT interview result has been published. You have not cleared this attempt. Please review your feedback and follow the retake instructions shown in your dashboard.",
  resultRetake:
    "Your interview has been evaluated. A further attempt is recommended after the specified waiting period. Please check your dashboard for the next eligible date and instructions.",
} as const;

type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  createdAt?: Date;
};

export async function notify(tx: Prisma.TransactionClient, input: NotifyInput) {
  return tx.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      createdAt: input.createdAt,
    },
  });
}
