import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { tzAbbreviation } from "@/lib/time";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const unread = await prisma.notification.count({ where: { userId: user.id, readAt: null } });
  const offset = tzAbbreviation(user.timezone);
  const city = user.timezone.split("/").pop()?.replaceAll("_", " ") ?? user.timezone;
  const timezoneLabel = user.timezone === "Asia/Kolkata" ? `IST · ${offset}` : `${city} · ${offset}`;

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role, timezone: user.timezone }}
      unread={unread}
      demoMode={env.demoMode}
      timezoneLabel={timezoneLabel}
    >
      {children}
    </AppShell>
  );
}
