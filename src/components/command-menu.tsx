"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type CommandGroup = {
  title: string;
  items: Array<{ href: string; label: string; icon: ReactNode }>;
};

type IndexedItem = CommandGroup["items"][number] & { index: number };
type IndexedGroup = { title: string; items: IndexedItem[] };

export function CommandMenu({
  open,
  onOpenChange,
  groups,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: CommandGroup[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const filtered = useMemo<IndexedGroup[]>(() => {
    const term = query.trim().toLowerCase();
    let index = 0;
    return groups
      .map((group) => {
        const items: IndexedGroup["items"] = group.items
          .filter((item) => !term || `${item.label} ${group.title}`.toLowerCase().includes(term))
          .map((item) => ({ ...item, index: index++ }));
        return { title: group.title, items };
      })
      .filter((group) => group.items.length > 0);
  }, [groups, query]);

  const flat = filtered.flatMap((group) => group.items);

  function choose(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-label="Search GRIT"
      onClose={() => onOpenChange(false)}
      onClick={(event) => {
        if (event.target === dialogRef.current) onOpenChange(false);
      }}
      className="command-dialog m-0 max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <div className="mx-auto w-[min(92vw,620px)] overflow-hidden rounded-[16px] border border-line bg-surface shadow-pop">
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search className="size-4 shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((current) => (flat.length === 0 ? 0 : (current + 1) % flat.length));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((current) => (flat.length === 0 ? 0 : (current - 1 + flat.length) % flat.length));
              } else if (event.key === "Enter" && flat[active]) {
                event.preventDefault();
                choose(flat[active].href);
              }
            }}
            placeholder="Search pages, queues and actions…"
            aria-label="Search pages and actions"
            className="h-[52px] flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
          />
          <kbd className="rounded border border-line bg-canvas px-1.5 py-0.5 text-[10px] font-medium text-muted">
            ESC
          </kbd>
        </div>

        <div className="max-h-[min(56vh,420px)] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-10 text-center text-[13px] text-muted">
              No matches for “{query.trim()}”. Try “students”, “results” or “availability”.
            </p>
          ) : (
            filtered.map((group) => (
              <div key={group.title} className="pb-1">
                <p className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted">
                  {group.title}
                </p>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <button
                        type="button"
                        onMouseEnter={() => setActive(item.index)}
                        onClick={() => choose(item.href)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-[9px] px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
                          active === item.index ? "bg-accent-soft text-accent-ink" : "text-ink-soft hover:bg-canvas",
                        )}
                      >
                        <span className={active === item.index ? "text-accent" : "text-zinc-400"}>{item.icon}</span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {active === item.index ? (
                          <CornerDownLeft className="size-3.5 shrink-0 text-accent" />
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-line bg-[#fafaf8] px-4 py-2 text-[10.5px] text-muted">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-line bg-surface px-1 py-0.5">↑</kbd>
            <kbd className="rounded border border-line bg-surface px-1 py-0.5">↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-line bg-surface px-1 py-0.5">↵</kbd> open
          </span>
          <span className="ml-auto hidden sm:inline">GRIT workspace search</span>
        </div>
      </div>
    </dialog>
  );
}
