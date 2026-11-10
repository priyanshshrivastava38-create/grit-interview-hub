import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@/generated/prisma/enums";
import { prisma } from "./db";
import { env } from "./env";
import { signSessionToken, verifySessionToken } from "./session-token";

const COOKIE_NAME = "grit_session";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  timezone: string;
  studentId: string | null;
  interviewerId: string | null;
};

export function homeForRole(role: Role): string {
  if (role === "STUDENT") return "/student";
  if (role === "INTERVIEWER") return "/interviewer";
  return "/admin";
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifySessionToken(token, env.authSecret);
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: {
      student: { select: { id: true } },
      interviewer: { select: { id: true } },
    },
  });
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    timezone: user.timezone,
    studentId: user.student?.id ?? null,
    interviewerId: user.interviewer?.id ?? null,
  };
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(role: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== role) redirect(homeForRole(user.role));
  return user;
}

export async function requireStudent(): Promise<SessionUser & { studentId: string }> {
  const user = await requireRole("STUDENT");
  if (!user.studentId) redirect("/login");
  return user as SessionUser & { studentId: string };
}

export async function requireInterviewer(): Promise<SessionUser & { interviewerId: string }> {
  const user = await requireRole("INTERVIEWER");
  if (!user.interviewerId) redirect("/login");
  return user as SessionUser & { interviewerId: string };
}

export async function createSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, signSessionToken(userId, env.authSecret), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
