export const JOB_STATUS_LABELS: Record<string, string> = {
  draft: "Draft – not offered",
  offered: "Offered",
  agreed: "Agreed",
  in_progress: "In progress",
  completion_submitted: "Completion to review",
  completed: "Completed",
  cancelled: "Cancelled",
  closed: "Closed",
};

export const ONBOARDING_LABELS: Record<string, string> = {
  draft: "Profile in progress",
  submitted: "Submitted – needs review",
  more_information_requested: "More information requested",
  approved: "Approved",
  rejected: "Not approved",
  ended: "Ended",
};

export const ENGAGEMENT_ROUTE_LABELS: Record<string, string> = {
  independent_business: "Independent business (Model A)",
  status_review_required: "Employment-status review required",
  worker_or_employee: "Worker / employee – use payroll, not this module",
};

/** YYYY-MM-DD for today plus `days` (UK date boundaries are close enough for reminders). */
export function isoDateFromToday(days = 0): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}
