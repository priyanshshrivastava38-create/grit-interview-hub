"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Clock3, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { bookSlotAction } from "@/app/actions/student";
import { Modal } from "@/components/action-form";
import { buttonClasses } from "@/components/ui-utils";

export function BookSlotButton({
  slotId,
  disabled,
  disabledReason,
  compact = false,
  slotDate,
  slotTime,
  interviewerName,
  cancellationHours,
}: {
  slotId: string;
  disabled?: boolean;
  disabledReason?: string;
  compact?: boolean;
  slotDate: string;
  slotTime: string;
  interviewerName: string;
  cancellationHours: number;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const idempotencyKey = useRef<string | null>(null);
  const keyForRequest = () => {
    idempotencyKey.current ??= `book-${slotId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    return idempotencyKey.current;
  };

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        title={disabledReason}
        className={buttonClasses("outline", "sm", "w-full")}
      >
        {disabledReason ? "Unavailable" : "Book"}
      </button>
    );
  }

  return (
    <Modal
      trigger={
        <>
          <CalendarCheck className="size-3.5" /> {compact ? "Book" : "Book this slot"}
        </>
      }
      triggerClassName={buttonClasses("primary", compact ? "sm" : "md", "w-full")}
      title="Confirm this interview"
      description="Your slot is reserved only after you confirm. Nothing is held while this dialog is open."
    >
      <div className="rounded-xl border border-line bg-canvas p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">GRIT interview</p>
        <p className="mt-1.5 text-[16px] font-semibold tracking-tight text-ink">{slotDate}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-soft">
          <Clock3 className="size-3.5 text-accent" /> {slotTime} · with {interviewerName}
        </p>
      </div>

      <ul className="mt-4 space-y-2 text-[12.5px] leading-5 text-ink-soft">
        <li className="flex gap-2">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-accent" />
          You can cancel or reschedule up to {cancellationHours} hours before the interview.
        </li>
        <li className="flex gap-2">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-accent" />
          Only one confirmed interview is allowed at a time.
        </li>
      </ul>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          className={buttonClasses("outline", "md")}
          onClick={(event) => event.currentTarget.closest("dialog")?.close()}
        >
          Keep browsing
        </button>
        <button
          type="button"
          disabled={pending}
          className={buttonClasses("primary", "md")}
          onClick={() =>
            startTransition(async () => {
              const result = await bookSlotAction(slotId, keyForRequest());
              if (result.ok) {
                toast.success("Interview booked", {
                  description: "Your confirmation is ready in My Interviews.",
                });
                router.push("/student/interviews?booked=1");
                router.refresh();
              } else {
                toast.error(result.error);
                router.refresh();
              }
            })
          }
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Reserving…
            </>
          ) : (
            <>
              <CalendarCheck className="size-4" /> Confirm booking
            </>
          )}
        </button>
      </div>
    </Modal>
  );
}

export function CountdownTimer({ startsAtLabel }: { startsAtLabel: string }) {
  const [label] = useState(startsAtLabel);
  return <span className="tabular">{label}</span>;
}
