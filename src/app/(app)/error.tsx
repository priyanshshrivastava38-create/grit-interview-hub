"use client";

import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { buttonClasses } from "@/components/ui-utils";

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <div className="mx-auto grid size-11 place-items-center rounded-full border border-[#f5cfcb] bg-bad-soft text-bad">
        <AlertTriangle className="size-5" />
      </div>
      <h1 className="mt-4 text-xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        This page could not be loaded. Your data is unchanged. Try again, or return to your workspace.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={reset} className={buttonClasses("primary", "sm")}>
          <RotateCcw className="size-3.5" /> Try again
        </button>
        <Link href="/login" className={buttonClasses("outline", "sm")}>
          Switch workspace
        </Link>
      </div>
    </div>
  );
}
