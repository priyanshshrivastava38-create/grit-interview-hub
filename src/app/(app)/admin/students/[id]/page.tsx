import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Award,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Mail,
  RotateCcw,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revokeEligibilityAction, restoreEligibilityAction, setBadgeStatusAction } from "@/app/actions/admin";
import { ActionForm, Modal } from "@/components/action-form";
import {
  Badge,
  buttonClasses,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  InfoBanner,
  KeyValue,
  PageHeader,
  Progress,
  SectionTitle,
  StatusPill,
  TableCell,
  TableHead,
  TableRow,
  TableShell,
} from "@/components/ui";
import { formatDate, formatDateTime, relativeTime } from "@/lib/time";
import { humanize } from "@/lib/state-machine";

export const metadata = { title: "Student profile" };

const fieldClasses =
  "w-full rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-sm text-ink placeholder:text-zinc-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15";

export default async function AdminStudentPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("ADMIN");
  const { id } = await params;
  const now = new Date();

  const student = await prisma.studentProfile.findUnique({
    where: { id },
    include: {
      user: true,
      skills: { include: { skill: true }, orderBy: { skill: { sortOrder: "asc" } } },
      interviews: {
        include: {
          interviewType: true,
          interviewer: { include: { user: true } },
          result: true,
          evaluation: true,
          booking: { include: { slot: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      bookings: {
        include: { slot: true, interview: { include: { interviewType: true } } },
        orderBy: { bookedAt: "desc" },
      },
      badgeAwards: { include: { badge: true, interview: { include: { result: true } } } },
      retakes: { include: { interviewType: true, reviewedByUser: true }, orderBy: { createdAt: "desc" } },
      cases: {
        include: { interview: { include: { interviewType: true } }, reportedByUser: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!student) notFound();

  const relevantIds = [student.id, ...student.interviews.map((interview) => interview.id), ...student.bookings.map((booking) => booking.id)];
  const audit = await prisma.auditLog.findMany({
    where: { entityId: { in: relevantIds } },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 25,
  });

  const completedSkills = student.skills.filter((skill) => skill.status === "COMPLETED").length;
  const award = student.badgeAwards[0] ?? null;
  const active = student.bookings.find((booking) => booking.status === "CONFIRMED") ?? null;
  const isEligible = student.eligibilityStatus === "ELIGIBLE";

  return (
    <div>
      <Link href="/admin/students" className="mb-4 inline-flex items-center gap-1.5 text-[12px] font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> All students
      </Link>

      <PageHeader
        eyebrow={`${student.studentCode} · ${student.cohort}`}
        title={student.user.name}
        description={`${student.program} · ${student.university}`}
        actions={
          <>
            <Link href={`/admin/bookings?q=${encodeURIComponent(student.user.name)}`} className={buttonClasses("outline", "sm")}>
              <CalendarDays className="size-3.5" /> Bookings
            </Link>
            {isEligible ? (
              <Modal
                trigger={
                  <>
                    <ShieldX className="size-3.5" /> Revoke eligibility
                  </>
                }
                title="Revoke eligibility"
                description="The student will be unable to book until eligibility is restored. Existing bookings are not cancelled automatically."
              >
                <ActionForm action={revokeEligibilityAction} successMessage="Eligibility revoked">
                  <input type="hidden" name="studentId" value={student.id} />
                  <label className="block text-[13px] font-medium text-ink-soft" htmlFor="revoke-reason">
                    Reason
                  </label>
                  <textarea
                    id="revoke-reason"
                    name="reason"
                    required
                    minLength={10}
                    rows={4}
                    className={`mt-1.5 ${fieldClasses}`}
                    placeholder="Explain why eligibility is being revoked. This is shown to the student and recorded in the audit trail."
                  />
                  <div className="mt-4 flex justify-end gap-2">
                    <button type="submit" className={buttonClasses("danger", "sm")}>
                      Revoke eligibility
                    </button>
                  </div>
                </ActionForm>
              </Modal>
            ) : (
              <Modal
                trigger={
                  <>
                    <ShieldCheck className="size-3.5" /> {student.eligibilityStatus === "ELIGIBILITY_REVOKED" ? "Restore eligibility" : "Grant eligibility"}
                  </>
                }
                title={student.eligibilityStatus === "ELIGIBILITY_REVOKED" ? "Restore eligibility" : "Grant eligibility"}
                description="The student will be able to book an interview immediately, subject to attempt limits."
              >
                <ActionForm action={restoreEligibilityAction} successMessage="Eligibility updated">
                  <input type="hidden" name="studentId" value={student.id} />
                  <label className="block text-[13px] font-medium text-ink-soft" htmlFor="restore-reason">
                    Reason
                  </label>
                  <textarea
                    id="restore-reason"
                    name="reason"
                    required
                    minLength={10}
                    rows={4}
                    className={`mt-1.5 ${fieldClasses}`}
                    placeholder="Reason for restoring eligibility."
                  />
                  <div className="mt-4 flex justify-end gap-2">
                    <button type="submit" className={buttonClasses("primary", "sm")}>
                      Save eligibility
                    </button>
                  </div>
                </ActionForm>
              </Modal>
            )}
          </>
        }
      />

      {student.eligibilityStatus === "ELIGIBILITY_REVOKED" ? (
        <div className="mb-4">
          <InfoBanner tone="bad" title="Eligibility revoked">
            {student.eligibilityReason ?? "No reason recorded."}
            {student.revokedAt ? ` Revoked ${formatDate(student.revokedAt)}.` : ""}
          </InfoBanner>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.45fr_1fr]">
        <Card>
          <CardHeader title="Student record" description="Program details and eligibility state." />
          <CardBody className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
            <dl className="divide-y divide-line">
              <KeyValue label="Student code" value={student.studentCode} />
              <KeyValue label="Cohort" value={student.cohort} />
              <KeyValue label="Program" value={student.program} />
              <KeyValue label="University" value={student.university} />
              <KeyValue
                label="Email"
                value={
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="size-3.5 text-muted" /> {student.user.email}
                  </span>
                }
              />
            </dl>
            <dl className="divide-y divide-line">
              <KeyValue label="Eligibility" value={<StatusPill value={student.eligibilityStatus} />} />
              <KeyValue label="Eligible since" value={student.eligibleAt ? formatDate(student.eligibleAt) : "—"} />
              <KeyValue label="Skills complete" value={`${completedSkills}/${student.skills.length}`} />
              <KeyValue label="Attempts used" value={`${student.interviews.length}`} />
              <KeyValue label="Joined" value={formatDate(student.createdAt)} />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Badge clearance"
            description="Badge state is managed independently of interview results."
            action={<Award className="size-4 text-muted" />}
          />
          <CardBody>
            {award ? (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[14px] font-semibold">{award.badge.name}</p>
                    <p className="text-[11.5px] text-muted">
                      {award.badge.code} · {award.badge.level} level · {award.badge.validityMonths} months validity
                    </p>
                  </div>
                  <StatusPill value={award.status} />
                </div>
                <dl className="space-y-1.5 text-[12.5px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Awarded</dt>
                    <dd className="font-medium">{award.awardedAt ? formatDate(award.awardedAt) : "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Source result</dt>
                    <dd className="font-medium">{award.interview.result?.outcome ?? "—"}</dd>
                  </div>
                  {award.statusNote ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted">Last note</dt>
                      <dd className="max-w-[220px] text-right font-medium">{award.statusNote}</dd>
                    </div>
                  ) : null}
                </dl>
                <Modal
                  trigger={award.status === "NULLIFIED" ? "View badge action" : "Change badge status"}
                  title="Change badge status"
                  description="Badge changes are transition-checked and recorded in the audit trail."
                >
                  <ActionForm action={setBadgeStatusAction} successMessage="Badge status updated">
                    <input type="hidden" name="awardId" value={award.id} />
                    <label className="block text-[13px] font-medium text-ink-soft" htmlFor="badge-status">
                      New status
                    </label>
                    <select
                      id="badge-status"
                      name="status"
                      defaultValue={award.status === "NULLIFIED" ? "NULLIFIED" : award.status === "SUSPENDED" ? "AWARDED" : "SUSPENDED"}
                      className={`mt-1.5 ${fieldClasses}`}
                    >
                      {award.status === "SUSPENDED" || award.status === "AWARDED" ? (
                        <option value="AWARDED">Awarded</option>
                      ) : null}
                      {award.status === "AWARDED" || award.status === "SUSPENDED" ? (
                        <option value="SUSPENDED">Suspended</option>
                      ) : null}
                      {award.status !== "NULLIFIED" ? <option value="NULLIFIED">Nullified</option> : null}
                      {award.status === "NULLIFIED" ? <option value="NULLIFIED">Nullified (terminal)</option> : null}
                    </select>
                    <label className="mt-3 block text-[13px] font-medium text-ink-soft" htmlFor="badge-note">
                      Reason
                    </label>
                    <textarea
                      id="badge-note"
                      name="note"
                      required
                      minLength={5}
                      rows={3}
                      className={`mt-1.5 ${fieldClasses}`}
                      placeholder="Reason for the badge status change."
                    />
                    <div className="mt-4 flex justify-end">
                      <button type="submit" className={buttonClasses("primary", "sm")}>
                        Update badge
                      </button>
                    </div>
                  </ActionForm>
                </Modal>
              </div>
            ) : (
              <div className="py-4 text-center">
                <div className="mx-auto grid size-11 place-items-center rounded-full border border-line bg-canvas text-muted">
                  <Award className="size-5" />
                </div>
                <p className="mt-3 text-[13px] font-medium">No badge awarded</p>
                <p className="mx-auto mt-1 max-w-[240px] text-[11.5px] leading-5 text-muted">
                  A badge is created automatically when a published result is a pass.
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Skill progress" description={`${completedSkills} of ${student.skills.length} milestones complete`} />
          <CardBody className="space-y-3">
            <Progress value={(completedSkills / Math.max(student.skills.length, 1)) * 100} tone={completedSkills === student.skills.length ? "good" : "accent"} />
            <ul className="divide-y divide-line">
              {student.skills.map((skill) => (
                <li key={skill.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium">{skill.skill.name}</p>
                    <p className="text-[10.5px] text-muted">
                      {skill.skill.isRequired ? "Required" : "Optional"}
                      {skill.score ? ` · ${skill.score}%` : ""}
                    </p>
                  </div>
                  <Badge tone={skill.status === "COMPLETED" ? "good" : skill.status === "IN_PROGRESS" ? "warn" : "neutral"}>
                    {humanize(skill.status)}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Active booking"
            description="The student's current confirmed interview, if any."
            action={<CalendarDays className="size-4 text-muted" />}
          />
          <CardBody>
            {active ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold">{active.interview?.interviewType.name ?? "Interview"}</p>
                    <p className="text-[11.5px] text-muted">{formatDateTime(active.slot.startsAt)}</p>
                  </div>
                  <StatusPill value={active.status} />
                </div>
                <dl className="space-y-1.5 text-[12.5px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Attempt</dt>
                    <dd className="font-medium">{active.attemptNumber}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Booked</dt>
                    <dd className="font-medium">{formatDateTime(active.bookedAt)}</dd>
                  </div>
                </dl>
                <Link href="/admin/bookings" className={buttonClasses("outline", "sm", "w-full")}>
                  Manage in bookings
                </Link>
              </div>
            ) : (
              <div className="py-3 text-center">
                <p className="text-[13px] font-medium">No active booking</p>
                <p className="mt-1 text-[11.5px] text-muted">
                  {isEligible ? "The student is eligible and can book a slot." : "Booking is blocked by eligibility."}
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-8">
        <SectionTitle title="Interview history" description="Every attempt, evaluation and published result." />
        {student.interviews.length === 0 ? (
          <Card>
            <EmptyState icon={<ClipboardList className="size-4" />} title="No interviews yet" />
          </Card>
        ) : (
          <TableShell>
            <TableHead>
              <TableRow className="border-0 hover:bg-transparent">
                <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Interview</TableCell>
                <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">When</TableCell>
                <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Interviewer</TableCell>
                <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Score</TableCell>
                <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Status</TableCell>
                <TableCell className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Result</TableCell>
              </TableRow>
            </TableHead>
            <tbody>
              {student.interviews.map((interview) => (
                <TableRow key={interview.id}>
                  <TableCell>
                    <p className="text-[13px] font-medium">{interview.interviewType.code}</p>
                    <p className="text-[11px] text-muted">Attempt {interview.attemptNumber}</p>
                  </TableCell>
                  <TableCell className="text-[12.5px]">{formatDateTime(interview.booking.slot.startsAt)}</TableCell>
                  <TableCell className="text-[12.5px]">{interview.interviewer.user.name}</TableCell>
                  <TableCell className="text-[12.5px] tabular">
                    {interview.result?.overallScore ?? interview.evaluation?.overallScore ?? "—"}
                  </TableCell>
                  <TableCell>
                    <StatusPill value={interview.booking.status === "NO_SHOW" ? "NO_SHOW" : interview.status} />
                  </TableCell>
                  <TableCell>
                    {interview.result ? (
                      <div className="flex flex-col gap-0.5">
                        <StatusPill value={interview.result.outcome} />
                        <span className="text-[10.5px] text-muted">{formatDate(interview.result.publishedAt)}</span>
                      </div>
                    ) : interview.evaluation ? (
                      <Badge tone="warn">Evaluation submitted</Badge>
                    ) : (
                      <span className="text-[11.5px] text-muted">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </tbody>
          </TableShell>
        )}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Booking history" description="Confirmed, rescheduled, cancelled and no-show records." />
          <CardBody className="p-0">
            {student.bookings.length === 0 ? (
              <EmptyState icon={<CalendarDays className="size-4" />} title="No bookings" />
            ) : (
              <ul className="divide-y divide-line">
                {student.bookings.map((booking) => (
                  <li key={booking.id} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium">
                        {booking.interview?.interviewType.code ?? `Attempt ${booking.attemptNumber}`}
                      </p>
                      <p className="text-[11px] text-muted">{formatDateTime(booking.slot.startsAt)}</p>
                    </div>
                    <StatusPill value={booking.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Retake requests"
              action={
                <Link href="/admin/retakes" className="text-[12px] font-medium text-accent hover:underline">
                  Review queue
                </Link>
              }
            />
            <CardBody className="p-0">
              {student.retakes.length === 0 ? (
                <EmptyState icon={<RotateCcw className="size-4" />} title="No retake requests" />
              ) : (
                <ul className="divide-y divide-line">
                  {student.retakes.map((retake) => (
                    <li key={retake.id} className="px-5 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12.5px] font-medium">{retake.interviewType.name}</p>
                        <StatusPill value={retake.status} />
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-muted">{retake.reason}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Integrity cases"
              action={
                <Link href="/admin/malpractice" className="text-[12px] font-medium text-accent hover:underline">
                  Open cases
                </Link>
              }
            />
            <CardBody className="p-0">
              {student.cases.length === 0 ? (
                <EmptyState icon={<ShieldAlert className="size-4" />} title="No integrity cases" />
              ) : (
                <ul className="divide-y divide-line">
                  {student.cases.map((item) => (
                    <li key={item.id} className="px-5 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12.5px] font-medium">{item.interview.interviewType.code}</p>
                        <StatusPill value={item.status} />
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-muted">{item.allegation}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="mt-8">
        <SectionTitle title="Audit trail" description="Actions recorded against this student and their records." />
        {audit.length === 0 ? (
          <Card>
            <EmptyState icon={<ScrollText className="size-4" />} title="No audit events" />
          </Card>
        ) : (
          <Card>
            <ul className="divide-y divide-line">
              {audit.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium">{humanize(entry.action.replaceAll(".", " "))}</p>
                    <p className="mt-0.5 text-[11.5px] leading-5 text-muted">{entry.summary}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-ink-soft">{entry.actor?.name ?? "System"}</p>
                    <p className="text-[10.5px] text-zinc-400">{relativeTime(entry.createdAt, now)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-[11.5px] text-muted">
        <GraduationCap className="size-3.5" /> Eligibility and badge decisions require a recorded reason and are written to
        the audit trail.
      </p>
    </div>
  );
}
