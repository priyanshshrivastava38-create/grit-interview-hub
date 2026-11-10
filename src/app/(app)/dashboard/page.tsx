import { redirect } from "next/navigation";
import { homeForRole, requireUser } from "@/lib/auth";

export default async function DashboardRedirect() {
  const user = await requireUser();
  redirect(homeForRole(user.role));
}
