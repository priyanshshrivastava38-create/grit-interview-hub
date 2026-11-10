import Link from "next/link";
import {
  Award,
  Bell,
  BellRing,
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  CheckCheck,
  ClipboardCheck,
  Info,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/notifications";
import { buttonClasses } from "@/components/ui";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { relativeTime } from "@/lib/time";
import { cn } from "@/lib/utils";

const typeMeta: Record<string, { icon: React.ReactNode; label: string }> = {
  ELIGIBILITY_UNLOCKED: { icon: <Sparkles className="size-4" />, label: "Eligibility" },
  BOOKING_CONFIRMED: { icon: <CalendarCheck2 className="size-4" />, label: "Booking" },
  BOOKING_RESCHEDULED: { icon: <CalendarClock className="size-4" />, label: "Booking" },
  BOOKING_CANCELLED: { icon: <CalendarX2 className="size-4" />, label: "Booking" },
  INTERVIEW_REMINDER: { icon: <BellRing className="size-4" />, label: "Reminder" },
  INTERVIEW_COMPLETED: { icon: <ClipboardCheck className="size-4" />, label: "Interview" },
  RESULT_PUBLISHED: { icon: <ClipboardCheck className="size-4" />, label: "Result" },
  BADGE_AWARDED: { icon: <Award className="size-4" />, label: "Badge" },
  RETAKE_UPDATED: { icon: <RotateCcw className="size-4" />, label: "Retake" },
  MALPRACTICE_UPDATE: { icon: <ShieldAlert className="size-4" />, label: "Review" },
  SYSTEM: { icon: <Info className="size-4" />, label: "System" },
};

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = notifications.filter((item) => !item.readAt).length;

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Account"
        title="Notifications"
        description="Booking confirmations, result publications, badge changes and operational updates."
        actions={
          unread > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <button type="submit" className={buttonClasses("outline", "sm")}>
                <CheckCheck className="size-3.5" /> Mark all read
              </button>
            </form>
          ) : (
            <Badge tone="neutral">All caught up</Badge>
          )
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Badge tone={unread > 0 ? "accent" : "neutral"} dot>
          {unread > 0 ? `${unread} unread` : "No unread notifications"}
        </Badge>
        <span className="text-[12px] text-muted">{notifications.length} total</span>
      </div>

      {notifications.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bell className="size-4" />}
            title="No notifications yet"
            description="Booking confirmations and result updates will appear here as the clearance process moves forward."
          />
        </Card>
      ) : (
        <ul className="space-y-2">
          {notifications.map((notification) => {
            const meta = typeMeta[notification.type] ?? { icon: <Bell className="size-4" />, label: "Update" };
            return (
              <li
                key={notification.id}
                className={cn(
                  "rounded-card border bg-surface p-4 shadow-card",
                  notification.readAt ? "border-line" : "border-[#c4e8df] bg-[#fbfdfc]",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "mt-0.5 grid size-8 shrink-0 place-items-center rounded-[9px] border",
                      notification.readAt
                        ? "border-line bg-canvas text-muted"
                        : "border-[#c4e8df] bg-accent-soft text-accent-ink",
                    )}
                  >
                    {meta.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13.5px] font-semibold text-ink">{notification.title}</p>
                      <Badge tone={notification.readAt ? "neutral" : "accent"}>{meta.label}</Badge>
                      {!notification.readAt ? <span className="size-1.5 rounded-full bg-accent" aria-label="Unread" /> : null}
                    </div>
                    <p className="mt-1 text-[13px] leading-6 text-ink-soft">{notification.body}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11.5px] text-muted">
                      <span>{relativeTime(notification.createdAt)}</span>
                      <span aria-hidden>·</span>
                      <span>{notification.createdAt.toLocaleString("en-GB", { timeZone: user.timezone })}</span>
                      {notification.link ? (
                        <Link href={notification.link} className="font-medium text-accent hover:underline">
                          Open record
                        </Link>
                      ) : null}
                      {!notification.readAt ? (
                        <form action={markNotificationReadAction} className="ml-auto">
                          <input type="hidden" name="notificationId" value={notification.id} />
                          <button
                            type="submit"
                            className="text-[11.5px] font-medium text-muted hover:text-ink"
                          >
                            Mark as read
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
