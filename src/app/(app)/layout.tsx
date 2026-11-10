import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { relativeTime, tzAbbreviation } from "@/lib/time";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const now = new Date();
  const [unread, recent] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, body: true, link: true, readAt: true, createdAt: true },
    }),
  ]);
  const notifications = recent.map((notification) => ({
    id: notification.id,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    relative: relativeTime(notification.createdAt, now),
    read: notification.readAt !== null,
  }));
  const offset = tzAbbreviation(user.timezone);
  const city = user.timezone.split("/").pop()?.replaceAll("_", " ") ?? user.timezone;
  const timezoneLabel = user.timezone === "Asia/Kolkata" ? `IST · ${offset}` : `${city} · ${offset}`;

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role, timezone: user.timezone }}
      unread={unread}
      notifications={notifications}
      demoMode={env.demoMode}
      timezoneLabel={timezoneLabel}
    >
      {children}
    </AppShell>
  );
}
