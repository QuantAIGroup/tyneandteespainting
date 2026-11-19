"use client";

import { useTransition } from "react";
import { setMessageStatus } from "../../actions";

const OPTIONS = [
  { id: "new", label: "New" },
  { id: "replied", label: "Replied" },
  { id: "archived", label: "Archived" },
] as const;

export function MessageStatusButtons({ id, status }: { id: string; status: "new" | "replied" | "archived" }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-1 rounded-lg bg-navy-50 p-1" role="group" aria-label="Message status">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          disabled={pending}
          aria-pressed={status === o.id}
          onClick={() => start(async () => void (await setMessageStatus(id, o.id)))}
          className={`rounded-md px-3 py-1 text-xs font-medium ${status === o.id ? "bg-navy-900 text-white" : "text-navy-700 hover:bg-white"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
