import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonClasses } from "@/components/ui-utils";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-6 text-center">
      <span className="grid size-12 place-items-center rounded-[14px] border border-line bg-surface text-muted shadow-card">
        <Compass className="size-6" />
      </span>
      <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">404 · Not found</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">That record or page does not exist</h1>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted">
        The link may be out of date, or you may not have access to this workspace.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link href="/login" className={buttonClasses("primary", "sm")}>
          Go to demo login
        </Link>
        <Link href="/" className={buttonClasses("outline", "sm")}>
          Back to overview
        </Link>
      </div>
    </div>
  );
}
