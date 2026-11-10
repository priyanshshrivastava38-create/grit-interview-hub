import Link from "next/link";
import {
  Award,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  GraduationCap,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { requireStudent } from "@/lib/auth";
import { getStudentDashboard } from "@/lib/analytics";
import {
  buttonClasses,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  InfoBanner,
  KeyValue,
  PageHeader,
  Progress,
  StatusPill,
} from "@/components/ui";
import { formatDate, formatDateTime, formatLongDate } from "@/lib/time";

export const metadata = { title: "Badge status" };

export default async function StudentBadgePage() {
  const user = await requireStudent();
  const data = await getStudentDashboard(user.studentId);
  const award = data.badge;
  const completed = data.skills.filter((skill) => skill.status === "COMPLETED").length;
  const total = data.skills.length;
  const published = data.history.filter((interview) => interview.result);

  const timeline = [
    {
      label: "Eligibility confirmed",
      date: data.profile.eligibleAt,
      description: data.profile.eligibilityReason ?? "All required skill milestones completed.",
      icon: <GraduationCap className="size-3.5" />,
      done: Boolean(data.profile.eligibleAt),
    },
    ...published
      .slice()
      .reverse()
      .map((interview) => ({
        label:
          interview.result?.outcome === "PASS"
            ? "Interview passed"
            : interview.result?.outcome === "FAIL"
              ? "Interview not cleared"
              : "Retake recommended",
        date: interview.resultPublishedAt,
        description: `${interview.interviewType.name} · overall ${interview.result?.overallScore ?? "—"} · ${interview.interviewer.user.name}`,
        icon: <ClipboardCheck className="size-3.5" />,
        done: true,
      })),
    {
      label:
        award?.status === "AWARDED"
          ? "Badge awarded"
          : award?.status === "NULLIFIED"
            ? "Badge nullified"
            : award?.status === "SUSPENDED"
              ? "Badge suspended"
              : "Badge clearance",
      date: award?.awardedAt ?? award?.updatedAt ?? null,
      description: award
        ? award.badge.name
        : "Awarded automatically when a PASS result is published.",
      icon: <Award className="size-3.5" />,
      done: Boolean(award?.awardedAt),
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Student · Credentials"
        title="Badge status"
        description="Your badge is derived from a published interview result and tracked separately from it."
        actions={
          <Link href="/student/interviews" className={buttonClasses("outline", "sm")}>
            <ClipboardCheck className="size-3.5" /> Interview record
          </Link>
        }
      />

      {award ? (
        <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
          <Card
            className={
              award.status === "AWARDED"
                ? "overflow-hidden border-[#c4e8df]"
                : award.status === "NULLIFIED"
                  ? "overflow-hidden border-[#f5cfcb]"
                  : "overflow-hidden border-[#f2ddb8]"
            }
          >
            <div className="relative p-6">
              <div className="pointer-events-none absolute inset-0 grid-lines opacity-40 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]" />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="grid size-12 place-items-center rounded-[13px] bg-ink text-white">
                      <Award className="size-6" />
                    </span>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">GRIT credential</p>
                      <h2 className="mt-0.5 text-lg font-semibold tracking-tight">{award.badge.name}</h2>
                    </div>
                  </div>
                  <StatusPill value={award.status} />
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[11px] border border-line bg-surface px-3 py-2.5">
                    <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted">Badge code</p>
                    <p className="mt-0.5 text-[13px] font-semibold">{award.badge.code}</p>
                  </div>
                  <div className="rounded-[11px] border border-line bg-surface px-3 py-2.5">
                    <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted">Level</p>
                    <p className="mt-0.5 text-[13px] font-semibold">{award.badge.level}</p>
                  </div>
                  <div className="rounded-[11px] border border-line bg-surface px-3 py-2.5">
                    <p className="text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted">Awarded</p>
                    <p className="mt-0.5 text-[13px] font-semibold">
                      {award.awardedAt ? formatDate(award.awardedAt) : "Pending"}
                    </p>
                  </div>
                </div>

                <p className="mt-4 max-w-xl text-[12.5px] leading-6 text-ink-soft">{award.badge.description}</p>

                {award.statusNote ? (
                  <p className="mt-3 rounded-lg border border-line bg-[#fafaf7] px-3 py-2 text-[11.5px] leading-5 text-muted">
                    {award.statusNote}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="border-t border-line bg-[#fafaf7] px-6 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3 text-[11.5px] text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5 text-accent" /> Verifiable against your published interview result
                </span>
                <span>Validity {award.badge.validityMonths} months</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Verification" description="The result and evaluation behind this badge." />
            <CardBody className="space-y-1">
              <KeyValue label="Interview" value={award.interview.interviewType.name} />
              <KeyValue
                label="Outcome"
                value={award.interview.result ? <StatusPill value={award.interview.result.outcome} /> : "—"}
              />
              <KeyValue label="Overall score" value={award.interview.result?.overallScore ?? "—"} />
              <KeyValue
                label="Result published"
                value={award.interview.result ? formatDate(award.interview.result.publishedAt) : "—"}
              />
              <KeyValue
                label="Interview date"
                value={formatDateTime(award.interview.booking.slot.startsAt)}
              />
              <div className="pt-3">
                <Link href="/student/interviews" className={buttonClasses("outline", "sm", "w-full")}>
                  View interview details
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Award className="size-4" />}
            title="Your badge has not been awarded yet"
            description="The Certified Product Engineer badge is awarded automatically when a PASS result is published. Your clearance steps are shown below."
            action={
              data.eligibility.allowed ? (
                <Link href="/student/book" className={buttonClasses("primary", "sm")}>
                  Book an interview
                </Link>
              ) : (
                <Link href="/student" className={buttonClasses("outline", "sm")}>
                  View your progress
                </Link>
              )
            }
          />
        </Card>
      )}

      {award?.status === "SUSPENDED" ? (
        <div className="mt-4">
          <InfoBanner tone="warn" title="Badge suspended">
            Interview operations has paused your badge while a review is completed. Your original interview result
            remains published and unchanged. You will be notified when the review concludes.
          </InfoBanner>
        </div>
      ) : null}
      {award?.status === "NULLIFIED" ? (
        <div className="mt-4">
          <InfoBanner tone="bad" title="Badge nullified">
            This badge was nullified following an operations review. Your original interview result and evaluation are
            still preserved in your interview record, and the audit trail retains the full decision history.
          </InfoBanner>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader
            title="Clearance timeline"
            description="A chronological record of how this credential was reached."
          />
          <CardBody>
            <ol className="relative space-y-5 before:absolute before:bottom-2 before:left-[9px] before:top-2 before:w-px before:bg-line">
              {timeline.map((item, index) => (
                <li key={`${item.label}-${index}`} className="relative flex gap-4">
                  <span
                    className={
                      item.done
                        ? "relative z-10 mt-0.5 grid size-[19px] shrink-0 place-items-center rounded-full border border-[#c9e9d3] bg-good-soft text-good"
                        : "relative z-10 mt-0.5 grid size-[19px] shrink-0 place-items-center rounded-full border border-line bg-surface text-zinc-300"
                    }
                  >
                    {item.done ? <CheckCircle2 className="size-3" /> : <Clock className="size-3" />}
                  </span>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[13px] font-medium text-ink">{item.label}</p>
                      <span className="text-[11px] text-muted">{item.date ? formatDate(item.date) : "Pending"}</span>
                    </div>
                    <p className="mt-0.5 text-[11.5px] leading-5 text-muted">{item.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Clearance progress" action={<Sparkles className="size-4 text-muted" />} />
            <CardBody className="space-y-3">
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="text-muted">Skill milestones</span>
                  <span className="font-medium tabular">
                    {completed}/{total}
                  </span>
                </div>
                <Progress
                  value={(completed / Math.max(total, 1)) * 100}
                  tone={completed === total ? "good" : "accent"}
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="text-muted">Interview completed</span>
                  <span className="font-medium">{published.length > 0 ? "Yes" : "Not yet"}</span>
                </div>
                <Progress value={published.length > 0 ? 100 : 0} tone="good" />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="text-muted">Result published</span>
                  <span className="font-medium">{published.length > 0 ? "Yes" : "Pending"}</span>
                </div>
                <Progress value={published.length > 0 ? 100 : 0} tone="good" />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="text-muted">Badge awarded</span>
                  <span className="font-medium">{award?.status === "AWARDED" ? "Yes" : "No"}</span>
                </div>
                <Progress value={award?.status === "AWARDED" ? 100 : 0} tone="good" />
              </div>
            </CardBody>
          </Card>

          <Card className="bg-[#fafaf7]">
            <CardBody className="space-y-2 text-[11.5px] leading-5 text-muted">
              <p className="flex items-center gap-1.5 font-medium text-ink-soft">
                <ShieldAlert className="size-3.5" /> Badge policy
              </p>
              <p>
                A badge can be suspended while a review is open, or nullified after a confirmed integrity case. Neither
                action rewrites your interview result — both are recorded in the audit trail.
              </p>
              <p>Badges are valid for {award?.badge.validityMonths ?? 24} months from the award date.</p>
            </CardBody>
          </Card>
        </div>
      </div>

      {published.length > 0 ? (
        <div className="mt-6">
          <Card>
            <CardHeader
              title="Latest published result"
              description={
                published[0].resultPublishedAt
                  ? `Published ${formatLongDate(published[0].resultPublishedAt)}`
                  : "Published result"
              }
              action={<StatusPill value={published[0].result?.outcome ?? "PENDING"} />}
            />
            <CardBody>
              <p className="text-[13px] leading-6 text-ink-soft">{published[0].result?.feedbackSummary}</p>
              <div className="mt-3">
                <Link href="/student/interviews" className="text-[12px] font-medium text-accent hover:underline">
                  Review structured feedback
                </Link>
              </div>
            </CardBody>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
