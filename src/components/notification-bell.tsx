"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

export type NotificationPreview = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  relative: string;
  read: boolean;
};

export function NotificationBell({ unread, items }: { unread: number; items: NotificationPreview[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "relative inline-flex size-9 items-center justify-center rounded-[9px] text-ink-soft transition-colors hover:bg-white hover:shadow-card",
          open && "bg-white shadow-card",
        )}
      >
        <Bell className="size-[18px]" />
        {unread > 0 ? (
          <span className="absolute right-1.5 top-1.5 size-2 animate-pulse rounded-full bg-accent ring-2 ring-canvas" />
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Recent notifications"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-[14px] border border-line bg-surface shadow-pop"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="text-[13px] font-semibold text-ink">Notifications</p>
            <span className="rounded-full border border-line bg-canvas px-2 py-0.5 text-[10.5px] font-medium text-muted">
              {unread > 0 ? `${unread} unread` : "All caught up"}
            </span>
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12.5px] text-muted">
              Updates about eligibility, interviews and results will appear here.
            </p>
          ) : (
            <ul className="max-h-[320px] divide-y divide-line overflow-y-auto">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.link ?? "/notifications"}
                    onClick={() => setOpen(false)}
                    className="flex gap-2.5 px-4 py-3 transition-colors hover:bg-[#fafaf8]"
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-1.5 shrink-0 rounded-full",
                        item.read ? "bg-zinc-300" : "bg-accent",
                      )}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-[12.5px] font-medium text-ink">{item.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-5 text-muted">{item.body}</span>
                      <span className="mt-1 block text-[10.5px] text-zinc-400">{item.relative}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-between border-t border-line bg-[#fafaf8] px-4 py-2.5 text-[12px] font-medium text-accent hover:bg-canvas"
          >
            View all notifications <ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
