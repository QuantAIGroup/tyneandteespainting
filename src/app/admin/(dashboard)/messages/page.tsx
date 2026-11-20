import { requireAdmin } from "@/lib/auth";
import { createSessionClient } from "@/lib/supabase/server";
import { MessageStatusButtons } from "./MessageStatusButtons";

export default async function MessagesPage() {
  await requireAdmin();
  const supabase = (await createSessionClient())!;
  const { data, error } = await supabase.from("contact_messages").select("*").order("created_at", { ascending: false }).limit(200);
  const rows = data ?? [];

  return (
    <div>
      <h1 className="text-3xl">Booking requests & messages</h1>
      <p className="mt-1 text-ink-600">Sent through the contact form. These are requests only – nothing is confirmed until you agree it with the customer.</p>
      {error && <p className="mt-6 rounded-lg bg-red-50 p-4 text-red-900">Could not load messages: {error.message}</p>}
      <ul className="mt-6 space-y-4">
        {rows.length === 0 && <li className="rounded-xl bg-white p-8 text-center text-ink-600 ring-1 ring-ink-900/10">No messages yet.</li>}
        {rows.map((m) => (
          <li key={m.id as string} className={`rounded-xl bg-white p-5 ring-1 ring-ink-900/10 ${m.status === "archived" ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink-950">
                  {m.name as string}
                  {m.service ? <span className="ml-2 rounded bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">{m.service as string}</span> : null}
                </p>
                <p className="text-sm text-ink-700">
                  <a href={`mailto:${m.email}`} className="underline-offset-2 hover:underline">
                    {m.email as string}
                  </a>
                  {m.phone ? ` · ${m.phone}` : ""} · {new Date(m.created_at as string).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" })}
                </p>
              </div>
              <MessageStatusButtons id={m.id as string} status={m.status as "new" | "replied" | "archived"} />
            </div>
            <p className="mt-3 whitespace-pre-wrap text-[15px] text-ink-900">{m.message as string}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
