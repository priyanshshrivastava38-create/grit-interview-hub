import { AlertCircle, Check } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

export type JourneyStep = {
  label: string;
  detail?: string;
  state: "done" | "current" | "attention" | "upcoming";
};

export function JourneyTracker({ steps }: { steps: JourneyStep[] }) {
  const completed = steps.filter((step) => step.state === "done").length;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
        <div>
          <p className="text-[13px] font-semibold tracking-tight text-ink">Your clearance path</p>
          <p className="text-[11.5px] text-muted">Six stages from skill milestones to an active badge.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas px-2.5 py-1 text-[11px] font-medium text-ink-soft">
          <span className="size-1.5 rounded-full bg-accent" />
          {completed} of {steps.length} complete
        </span>
      </div>

      <ol className="no-scrollbar flex overflow-x-auto px-2 py-4 sm:px-3">
        {steps.map((step, index) => (
          <li key={step.label} className="relative flex min-w-[112px] flex-1 flex-col px-2 sm:min-w-0">
            {index < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[calc(50%+16px)] right-[-50%] top-[13px] h-px",
                  step.state === "done" ? "bg-accent/35" : "bg-line",
                )}
              />
            ) : null}
            <div className="flex justify-center">
              <span
                className={cn(
                  "relative z-10 grid size-7 place-items-center rounded-full border text-[11px] font-semibold transition-colors",
                  step.state === "done" && "border-accent bg-accent text-white",
                  step.state === "current" && "border-accent bg-accent-soft text-accent-ink ring-4 ring-accent/10",
                  step.state === "attention" && "border-[#f2ddb8] bg-warn-soft text-warn",
                  step.state === "upcoming" && "border-line bg-canvas text-muted",
                )}
              >
                {step.state === "done" ? (
                  <Check className="size-3.5" strokeWidth={2.5} />
                ) : step.state === "attention" ? (
                  <AlertCircle className="size-3.5" />
                ) : (
                  index + 1
                )}
              </span>
            </div>
            <div className="mt-2 text-center">
              <p
                className={cn(
                  "text-[11.5px] font-medium",
                  step.state === "upcoming" ? "text-muted" : "text-ink",
                )}
              >
                {step.label}
              </p>
              {step.detail ? (
                <p className="mx-auto mt-0.5 max-w-[120px] text-[10.5px] leading-4 text-muted">{step.detail}</p>
              ) : null}
              {step.state === "current" ? (
                <span className="mt-1 inline-block rounded-full bg-accent-soft px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.05em] text-accent-ink">
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
