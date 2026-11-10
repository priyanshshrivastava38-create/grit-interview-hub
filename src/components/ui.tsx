import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function buttonClasses(
  variant: "primary" | "secondary" | "ghost" | "danger" | "outline" = "primary",
  size: "sm" | "md" | "lg" = "md",
  className?: string,
) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-[transform,background-color,box-shadow,color,filter] duration-200 disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap",
    size === "sm" && "h-9 px-3.5 text-[13px]",
    size === "md" && "h-10 px-4 text-sm",
    size === "lg" && "h-11 px-5 text-[15px]",
    variant === "primary" &&
      "btn-sheen text-white shadow-[0_1px_2px_var(--accent-glow)] hover:-translate-y-px hover:brightness-105 hover:shadow-[0_10px_24px_-12px_var(--accent-glow)] active:translate-y-0 active:brightness-95",
    variant === "secondary" && "bg-ink text-white hover:bg-zinc-800",
    variant === "outline" && "border border-line-strong bg-surface text-ink hover:bg-canvas",
    variant === "ghost" && "text-ink-soft hover:bg-black/[0.04]",
    variant === "danger" && "bg-bad text-white hover:bg-[#96180f]",
    className,
  );
}

export function Card({
  children,
  className,
  id,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <Tag id={id} className={cn("rounded-card border border-line bg-surface shadow-card", className)}>
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-line px-5 py-4", className)}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
        {description ? <p className="mt-0.5 text-[13px] leading-5 text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "violet" | "accent";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-zinc-100 text-zinc-700 border-zinc-200",
  good: "bg-good-soft text-good border-[#c9e9d3]",
  warn: "bg-warn-soft text-warn border-[#f2ddb8]",
  bad: "bg-bad-soft text-bad border-[#f5cfcb]",
  info: "bg-info-soft text-info border-[#d5dffb]",
  violet: "bg-violet-soft text-violet border-[#e0d6fa]",
  accent: "bg-accent-soft text-accent-ink border-[#c4e8df]",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  dot,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4",
        toneClasses[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current opacity-80" /> : null}
      {children}
    </span>
  );
}

const statusToneMap: Record<string, Tone> = {
  ELIGIBLE: "good",
  NOT_ELIGIBLE: "neutral",
  ELIGIBILITY_REVOKED: "bad",
  CONFIRMED: "good",
  BOOKED: "good",
  COMPLETED: "neutral",
  RESCHEDULED: "info",
  CANCELLED: "bad",
  NO_SHOW: "bad",
  SCHEDULED: "info",
  IN_PROGRESS: "warn",
  RESULT_PENDING: "warn",
  RESULT_PUBLISHED: "good",
  PASS: "good",
  FAIL: "bad",
  RETAKE_LATER: "warn",
  AWARDED: "good",
  PENDING_CLEARANCE: "warn",
  SUSPENDED: "warn",
  NULLIFIED: "bad",
  NOT_EARNED: "neutral",
  PENDING: "warn",
  APPROVED: "good",
  REJECTED: "bad",
  REPORTED: "warn",
  UNDER_REVIEW: "info",
  CLOSED: "neutral",
  ACTIVE: "good",
  BLOCKED: "bad",
  OPEN: "neutral",
};

export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function StatusPill({ value, className }: { value: string; className?: string }) {
  return (
    <Badge tone={statusToneMap[value] ?? "neutral"} dot className={className}>
      {humanize(value)}
    </Badge>
  );
}

export function Progress({
  value,
  className,
  tone = "accent",
}: {
  value: number;
  className?: string;
  tone?: "accent" | "good" | "warn" | "bad" | "ink";
}) {
  const bar =
    tone === "accent"
      ? "bg-accent-gradient"
      : tone === "good"
        ? "bg-good"
        : tone === "warn"
          ? "bg-warn"
          : tone === "bad"
            ? "bg-bad"
            : "bg-ink";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-zinc-100", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", bar)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const label = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const hue = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5;
  const tones = [
    "bg-[#e7f4f0] text-[#0b4f4a]",
    "bg-[#eef1fb] text-[#273c8f]",
    "bg-[#f4effb] text-[#542a8f]",
    "bg-[#fdf1e6] text-[#8a4b13]",
    "bg-[#edf1f4] text-[#334155]",
  ];
  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
        tones[hue],
        className,
      )}
      aria-hidden
    >
      {label}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {icon ? (
        <div className="mb-3 flex size-10 items-center justify-center rounded-full border border-accent/20 bg-accent-soft text-accent">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-[13px] leading-5 text-muted">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-black/[0.06]", className)} />;
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink-soft">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[12px] text-bad">{error}</p>
      ) : hint ? (
        <p className="text-[12px] leading-4 text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClasses =
  "h-10 w-full rounded-[10px] border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15 disabled:bg-canvas";

export const selectClasses = cn(inputClasses, "appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20fill%3D%22none%22%20stroke%3D%22%2371717a%22%20stroke-width%3D%221.5%22%3E%3Cpath%20d%3D%22m4%206%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[right_10px_center] bg-no-repeat pr-9");

export function StatCard({
  label,
  value,
  detail,
  trend,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  trend?: { value: string; positive?: boolean };
  tone?: "neutral" | "good" | "warn" | "bad";
  icon?: ReactNode;
}) {
  return (
    <Card className="group p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-pop">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-muted">{label}</p>
        {icon ? (
          <span className="grid size-8 place-items-center rounded-[9px] bg-accent-soft text-accent transition-transform duration-200 group-hover:scale-110">
            {icon}
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 text-[26px] font-semibold leading-8 tracking-tight tabular",
          tone === "good" && "text-good",
          tone === "warn" && "text-warn",
          tone === "bad" && "text-bad",
        )}
      >
        {value}
      </p>
      <div className="mt-1 flex items-center gap-2 text-[12px] text-muted">
        {trend ? (
          <span className={trend.positive ? "font-medium text-good" : "font-medium text-muted"}>{trend.value}</span>
        ) : null}
        {detail ? <span>{detail}</span> : null}
      </div>
    </Card>
  );
}

export function SectionTitle({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-end justify-between gap-3", className)}>
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-card border border-line bg-surface shadow-card", className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">{children}</table>
      </div>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-line bg-[#fafaf8] text-[11px] font-medium uppercase tracking-[0.06em] text-muted">
      {children}
    </thead>
  );
}

export function TableRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <tr className={cn("border-b border-line last:border-0 hover:bg-[#fbfbf9]", className)}>{children}</tr>
  );
}

export function TableCell({
  children,
  className,
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cn("px-4 py-3 align-middle", className)}>
      {children}
    </td>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-ink">{value}</dd>
    </div>
  );
}

export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-64 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-[11px] font-normal leading-4 text-white opacity-0 shadow-pop transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
            <span aria-hidden className="bg-accent-gradient size-1.5 rounded-full" />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[26px] font-semibold leading-8 tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function InfoBanner({
  tone = "neutral",
  title,
  children,
  action,
  className,
}: {
  tone?: "neutral" | "good" | "warn" | "bad" | "info" | "accent";
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const styles: Record<string, string> = {
    neutral: "border-line bg-surface",
    good: "border-[#c9e9d3] bg-good-soft",
    warn: "border-[#f2ddb8] bg-warn-soft",
    bad: "border-[#f5cfcb] bg-bad-soft",
    info: "border-[#d5dffb] bg-info-soft",
    accent: "border-[#c4e8df] bg-accent-soft",
  };
  const iconTone: Record<string, string> = {
    neutral: "text-muted",
    good: "text-good",
    warn: "text-warn",
    bad: "text-bad",
    info: "text-info",
    accent: "text-accent",
  };
  return (
    <div className={cn("rounded-card border px-4 py-3.5", styles[tone], className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className={cn("min-w-0 flex-1", iconTone[tone])}>
          {title ? <p className="text-sm font-semibold text-ink">{title}</p> : null}
          <div className="text-[13px] leading-6 text-ink-soft">{children}</div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function StatRow({
  items,
  className,
}: {
  items: Array<{ label: string; value: ReactNode; detail?: ReactNode }>;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-x-8 gap-y-3", className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-[90px]">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">{item.label}</p>
          <p className="mt-0.5 text-sm font-semibold text-ink">{item.value}</p>
          {item.detail ? <p className="text-[11px] text-muted">{item.detail}</p> : null}
        </div>
      ))}
    </div>
  );
}
