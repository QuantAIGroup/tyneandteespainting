import Link from "next/link";
import { CANCELLATION_POLICY, CANCELLATION_SUMMARY } from "@/config/cancellation";

/** Full policy – terms page and cancellation page. */
export function CancellationPolicy() {
  return (
    <div className="space-y-4">
      {CANCELLATION_POLICY.map((p) => (
        <div key={p.title}>
          <h3 className="font-sans text-lg font-bold text-ink-950">{p.title}</h3>
          <p className="mt-1">{p.text}</p>
        </div>
      ))}
    </div>
  );
}

/** Short version – payment page. */
export function CancellationSummary() {
  return (
    <div>
      <ul className="list-disc space-y-1.5 pl-5">
        {CANCELLATION_SUMMARY.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-3">
        Full details:{" "}
        <Link href="/cancellation" className="font-semibold underline">
          cancellations, refunds and cancellation form
        </Link>{" "}
        ·{" "}
        <Link href="/terms" className="underline">
          terms and conditions
        </Link>
      </p>
    </div>
  );
}
