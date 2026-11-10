import { AlertCircle, Check } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

export type JourneyStep = {
  label: string;
  detail?: string;
  state: "done" | "current" | "attention" | "upcoming";
};

function stepIcon(state: JourneyStep["state"], index: number) {
  if (state === "done") return <Check className="size-3.5" strokeWidth={2.5} />;
  if (state === "attention") return <AlertCircle className="size-3.5" />;
  return index + 1;
}

export function JourneyTracker({ steps, title = "Your clearance path" }: { steps: JourneyStep[]; title?: string }) {
  const completed = steps.filter((step) => step.state === "done").length;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
        <div>
          <p className="text-[13px] font-semibold tracking-tight text-ink">{title}</p>
          <p className="text-[12px] text-muted">Six stages from skill milestones to an active badge.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 text-[11.5px] font-medium text-ink-soft">
          <span className="size-1.5 rounded-full bg-accent" />
          {completed} of {steps.length} complete
        </span>
      </div>

      <ol className="grid grid-cols-2 gap-2 p-3 sm:hidden">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={cn(
              "flex items-start gap-2.5 rounded-[10px] border px-2.5 py-2",
              step.state === "current" ? "border-accent/35 bg-accent-soft" : "border-line bg-surface",
            )}
          >
            <span
              style={{ animationDelay: `${index * 60}ms` }}
              className={cn(
                "animate-pop mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-[10px] font-semibold",
                step.state === "done" && "bg-accent-gradient border-transparent text-white",
                step.state === "current" && "border-accent bg-surface text-accent-ink",
                step.state === "attention" && "border-[#f2ddb8] bg-warn-soft text-warn",
                step.state === "upcoming" && "border-line bg-canvas text-muted",
              )}
            >
              {stepIcon(step.state, index)}
            </span>
            <div className="min-w-0">
              <p className={cn("text-[12px] font-medium", step.state === "upcoming" ? "text-muted" : "text-ink")}>
                {step.label}
              </p>
              {step.detail ? <p className="mt-0.5 text-[10.5px] leading-4 text-muted">{step.detail}</p> : null}
              {step.state === "current" ? (
                <span className="mt-1 inline-block text-[9.5px] font-semibold uppercase tracking-[0.05em] text-accent-ink">
                  You are here
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <ol className="no-scrollbar hidden overflow-x-auto px-2 py-4 sm:flex sm:px-3">
        {steps.map((step, index) => (
          <li key={step.label} className="relative flex min-w-0 flex-1 flex-col px-2">
            {index < steps.length - 1 ? (
              <span
                aria-hidden
                style={{ animationDelay: `${index * 70 + 120}ms` }}
                className={cn(
                  "animate-grow-x absolute left-[calc(50%+16px)] right-[-50%] top-[13px] h-px",
                  step.state === "done" ? "bg-gradient-to-r from-accent/50 to-accent/15" : "bg-line",
                )}
              />
            ) : null}
            <div className="flex justify-center">
              <span
                style={{ animationDelay: `${index * 70}ms` }}
                className={cn(
                  "animate-pop relative z-10 grid size-7 place-items-center rounded-full border text-[11px] font-semibold transition-colors",
                  step.state === "done" && "bg-accent-gradient border-transparent text-white",
                  step.state === "current" &&
                    "current-step-ring border-accent bg-accent-soft text-accent-ink ring-4 ring-accent/10",
                  step.state === "attention" && "border-[#f2ddb8] bg-warn-soft text-warn",
                  step.state === "upcoming" && "border-line bg-canvas text-muted",
                )}
              >
                {stepIcon(step.state, index)}
              </span>
            </div>
            <div className="mt-2 text-center">
              <p className={cn("text-[12px] font-medium", step.state === "upcoming" ? "text-muted" : "text-ink")}>
                {step.label}
              </p>
              {step.detail ? (
                <p className="mx-auto mt-0.5 max-w-[120px] text-[11px] leading-4 text-muted">{step.detail}</p>
              ) : null}
              {step.state === "current" ? (
                <span className="mt-1 inline-block rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.05em] text-accent-ink">
                  You are here
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}
