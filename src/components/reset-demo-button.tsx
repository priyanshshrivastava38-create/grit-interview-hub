"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { resetDemoAction } from "@/app/actions/session";
import { Modal } from "@/components/action-form";
import { buttonClasses } from "@/components/ui-utils";

export function ResetDemoButton({ full = false }: { full?: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Modal
      title="Reset demo data?"
      description="This restores every student, interviewer, booking, result and audit record to the original demo scenarios. Accounts stay the same. This cannot be undone."
      triggerClassName={full ? "w-full" : undefined}
      trigger={
        <>
          <RotateCcw className="size-3.5" /> {full ? "Reset demo data" : "Reset demo"}
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-[#f2ddb8] bg-warn-soft px-3 py-2.5 text-[12px] leading-5 text-warn">
          Any bookings or results created while exploring will be removed. The demo admin session is restored automatically.
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className={buttonClasses("outline", "sm")}
            onClick={(event) => event.currentTarget.closest("dialog")?.close()}
          >
            Keep current data
          </button>
          <button
            type="button"
            className={buttonClasses("danger", "sm")}
            disabled={pending}
            onClick={(event) => {
              const dialog = event.currentTarget.closest("dialog");
              startTransition(async () => {
                const result = await resetDemoAction();
                if (result.ok) {
                  toast.success("Demo data restored to the original scenarios.");
                  dialog?.close();
                  router.push("/admin");
                  router.refresh();
                } else {
                  toast.error(result.error);
                }
              });
            }}
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
            {pending ? "Restoring…" : "Reset scenarios"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
