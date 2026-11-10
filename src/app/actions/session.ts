"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSession, destroySession, homeForRole, requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { resetAndSeedDemo } from "@/lib/demo/reset";
import { actionError, type ActionResult } from "@/lib/errors";

export async function demoLogin(formData: FormData) {
  if (!env.demoMode) redirect("/login?error=demo-disabled");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) redirect("/login?error=unknown");
  await createSession(user.id);
  redirect(homeForRole(user.role));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

export async function resetDemoAction(): Promise<ActionResult> {
  try {
    await requireRole("ADMIN");
    if (!env.demoMode) {
      return { ok: false, error: "Demo reset is disabled outside demo mode.", code: "FORBIDDEN" };
    }
    await resetAndSeedDemo(prisma);
    const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    await createSession(admin.id);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
