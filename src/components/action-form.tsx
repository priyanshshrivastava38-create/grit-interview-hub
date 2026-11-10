"use client";

import { useId, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/errors";
import { buttonClasses, cn } from "@/components/ui-utils";

export function ActionForm<T = undefined>({
  action,
  successMessage,
  children,
  className,
  resetOnSuccess = false,
  onSuccess,
}: {
  action: (formData: FormData) => Promise<ActionResult<T>>;
  successMessage: string;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  onSuccess?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        setError(null);
        startTransition(async () => {
          const result = await action(data);
          if (result.ok) {
            toast.success(successMessage);
            form.closest("dialog")?.close();
            if (resetOnSuccess) form.reset();
            onSuccess?.();
            router.refresh();
          } else {
            setError(result.error);
            toast.error(result.error);
          }
        });
      }}
    >
      <fieldset disabled={pending} className="m-0 min-w-0 border-0 p-0">
        {children}
        {error ? (
          <p role="alert" className="mt-3 rounded-lg border border-[#f5cfcb] bg-bad-soft px-3 py-2 text-[12px] leading-5 text-bad">
            {error}
          </p>
        ) : null}
      </fieldset>
    </form>
  );
}

export function Modal({
  trigger,
  title,
  description,
  children,
  triggerClassName,
  wide = false,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  triggerClassName?: string;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const close = () => ref.current?.close();

  return (
    <>
      <button
        type="button"
        className={cn(buttonClasses("outline", "sm"), triggerClassName)}
        onClick={() => ref.current?.showModal()}
      >
        {trigger}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className={cn(
          "m-auto w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-black/40",
          wide ? "max-w-3xl" : "max-w-lg",
        )}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="text-[15px] font-semibold tracking-tight">
              {title}
            </h2>
            {description ? <p className="mt-0.5 text-[13px] leading-5 text-muted">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-md p-1 text-muted hover:bg-black/[0.04] hover:text-ink"
            aria-label="Close dialog"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </dialog>
    </>
  );
}
