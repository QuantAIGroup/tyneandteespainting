/**
 * Cancellation and refund policy – written once and used on the terms page,
 * the cancellation page, the payment page and the payment emails, so the
 * wording is always identical.
 *
 * Based on the policy supplied by the business owner and the Consumer
 * Contracts (Information, Cancellation and Additional Charges) Regulations 2013.
 */

export const COOLING_OFF_DAYS = 14;
export const LATE_CANCELLATION_HOURS = 48;

export const CANCELLATION_POLICY: { title: string; text: string }[] = [
  {
    title: `Your ${COOLING_OFF_DAYS}-day cooling-off period`,
    text: `If you agreed the job with us by phone, email or online, or anywhere other than our business premises, you normally have the legal right to cancel within ${COOLING_OFF_DAYS} days of the day the contract was made, without giving a reason, and receive a full refund. This is subject to the exceptions allowed by law. If you have expressly asked us to start work within those ${COOLING_OFF_DAYS} days and you then cancel, you pay only for the work properly carried out up to the time you tell us. Once the work has been fully completed at your request, the right to cancel no longer applies.`,
  },
  {
    title: `More than ${LATE_CANCELLATION_HOURS} hours before your appointment`,
    text: `Outside the cooling-off period, if you cancel more than ${LATE_CANCELLATION_HOURS} hours before your scheduled appointment, you receive a full refund.`,
  },
  {
    title: `Less than ${LATE_CANCELLATION_HOURS} hours before your appointment`,
    text: "We look at each case individually. We will only deduct reasonable, evidenced direct losses or costs we have actually incurred, and only where the law allows. The rest of your payment is refunded.",
  },
  {
    title: "If we cancel",
    text: "If Tyne & Tees Painting cancels your booking, you receive a full refund.",
  },
  {
    title: "If work has already started",
    text: "You are charged only for work properly completed and any other lawful charges you agreed with us. The rest of your payment is refunded.",
  },
  {
    title: "How refunds are paid",
    text: `Refunds are made through Stripe to the card or payment method you originally used. We refund without undue delay and, if you cancel within the cooling-off period, no later than ${COOLING_OFF_DAYS} days after you tell us you are cancelling. There is no fee for the refund.`,
  },
];

/** Short version for the payment page and emails. */
export const CANCELLATION_SUMMARY = [
  `Cancel within your ${COOLING_OFF_DAYS}-day cooling-off period for a full refund (subject to lawful exceptions and any work you asked us to start early).`,
  `Outside that period, cancel more than ${LATE_CANCELLATION_HOURS} hours before your appointment for a full refund.`,
  `Less than ${LATE_CANCELLATION_HOURS} hours' notice: assessed individually – only reasonable, evidenced costs we've actually incurred may be deducted, where the law allows.`,
  "If we cancel, you get a full refund. Refunds go back to your original payment method through Stripe.",
];

/** Text of the model cancellation form (Consumer Contracts Regulations 2013, Schedule 3, Part B). */
export const MODEL_FORM_LINES = [
  "I/We [*] hereby give notice that I/We [*] cancel my/our [*] contract of sale of the following goods [*]/for the supply of the following service [*],",
  "Ordered on [*]/received on [*],",
  "Name of consumer(s),",
  "Address of consumer(s),",
  "Signature of consumer(s) (only if this form is notified on paper),",
  "Date",
];
