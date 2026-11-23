import Link from "next/link";
import { telHref } from "@/config/site";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/enquiry";
import { ceilingArea, roomWallArea } from "@/lib/pricing/engine";
import type { PricingSettings, QuoteItem, QuoteResult } from "@/lib/pricing/types";
import { createSessionClient } from "@/lib/supabase/server";
import { QuoteBreakdown } from "@/components/calculator/QuoteBreakdown";
import { StatusBadge } from "../../StatusBadge";
import { EnquiryActions, NotesForm } from "./EnquiryControls";
import { PaymentPanel } from "./PaymentPanel";

const SURFACE: Record<string, string> = { good: "Good condition", minor_defects: "Small nail holes / minor cracks (included)", major_damage: "Larger cracks or damage", bare_wood: "Bare / new wood" };
const yesNo = (b: boolean) => (b ? "Yes" : "No");
const m = (n: number) => `${n.toFixed(2)} m`;

function ItemDetails({ item }: { item: QuoteItem }) {
  const rows: [string, string][] = [];
  if (item.type === "bedroom" || item.type === "living_room") {
    if (item.measurementMode === "simple") {
      rows.push(["Measurements", `${m(item.length)} long × ${m(item.width)} wide × ${m(item.height)} high`]);
    } else {
      rows.push(["Walls", item.walls.map((w, i) => `Wall ${i + 1}: ${m(w.width)} × ${m(w.height)}`).join(" · ")]);
    }
    rows.push(["Wall area", `${roomWallArea(item).toFixed(2)} m²`]);
    rows.push(["Ceiling", item.includeCeiling ? `Yes – ${ceilingArea(item.length, item.width).toFixed(2)} m² (${m(item.length)} × ${m(item.width)})` : "No"]);
    rows.push(["Wall condition", SURFACE[item.condition.surface]]);
    rows.push(["Colour change", item.condition.colourChange === "significant" ? "Significant" : "Similar colour"]);
    rows.push(["Newly skimmed", yesNo(item.condition.newlySkimmed)]);
    rows.push(["Wallpaper to remove", yesNo(item.condition.wallpaperToRemove)]);
    rows.push(["Damp / stains", yesNo(item.condition.dampOrStains)]);
  } else if (item.type === "skirting") {
    rows.push(["Length", m(item.linearMetres)]);
    rows.push(["Condition", SURFACE[item.condition]]);
  } else {
    rows.push(["Measurements", `${m(item.length)} × ${m(item.width)} = ${ceilingArea(item.length, item.width).toFixed(2)} m²`]);
    rows.push(["Condition", SURFACE[item.condition.surface]]);
    rows.push(["Newly plastered", yesNo(item.condition.newlySkimmed)]);
    rows.push(["Damp / stains", yesNo(item.condition.dampOrStains)]);
  }
  rows.push(["Coats", String(item.coats)]);

  return (
    <div className="rounded-lg bg-white p-5 ring-1 ring-ink-900/10">
      <h3 className="font-sans text-base font-semibold text-ink-950">{item.label}</h3>
      <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[160px_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-ink-600">{k}</dt>
            <dd className="text-ink-950">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default async function EnquiryPage({ params }: PageProps<"/admin/enquiries/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = (await createSessionClient())!;
  const { data: enquiry } = await supabase.from("enquiries").select("*").eq("id", id).maybeSingle();
  if (!enquiry) notFound();

  const { data: photoRows } = await supabase.from("enquiry_photos").select("id, storage_path, file_name").eq("enquiry_id", id).order("created_at");
  const photos = photoRows ?? [];
  let signed: { path: string | null; signedUrl: string }[] = [];
  if (photos.length) {
    // Private photos: create links that expire after 1 hour
    const { data } = await supabase.storage.from("enquiry-photos").createSignedUrls(photos.map((p) => p.storage_path as string), 3600);
    signed = (data ?? []).flatMap((d) => (!d.error && d.signedUrl ? [{ path: d.path, signedUrl: d.signedUrl }] : []));
  }

  const items = enquiry.items as QuoteItem[];
  const breakdown = enquiry.breakdown as QuoteResult;
  const snapshot = enquiry.pricing_snapshot as PricingSettings;
  const created = new Date(enquiry.created_at as string).toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short", timeZone: "Europe/London" });
  const tel = telHref(String(enquiry.phone));

  return (
    <div>
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-ink-700 hover:text-ink-950">
        <ArrowLeft className="size-4" aria-hidden /> All enquiries
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <h1 className="font-mono text-3xl">{enquiry.reference as string}</h1>
        <StatusBadge status={enquiry.status as string} />
        <Link href={`/admin/jobs/new?enquiry=${id}`} className="ml-auto rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          Create painter job
        </Link>
      </div>
      <p className="mt-1 text-ink-600">Received {created}</p>

      <div className="mt-6">
        <EnquiryActions id={id} status={enquiry.status as string} depositPaid={Boolean(enquiry.deposit_paid_at)} contactedAt={(enquiry.contacted_at as string | null) ?? null} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="space-y-8">
          <section className="rounded-xl bg-white p-6 ring-1 ring-ink-900/10">
            <h2 className="font-sans text-lg font-semibold">Customer</h2>
            <p className="mt-3 text-xl font-medium text-ink-950">{enquiry.full_name as string}</p>
            <ul className="mt-3 space-y-2 text-[15px]">
              <li className="flex items-center gap-2">
                <Phone className="size-4 text-brand-600" aria-hidden />
                <a href={tel} className="underline-offset-2 hover:underline">
                  {enquiry.phone as string}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-4 text-brand-600" aria-hidden />
                <a href={`mailto:${enquiry.email}?subject=Your painting quotation ${enquiry.reference}`} className="underline-offset-2 hover:underline">
                  {enquiry.email as string}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="size-4 text-brand-600" aria-hidden /> {enquiry.postcode as string}
              </li>
            </ul>
            <dl className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-[160px_1fr]">
              <dt className="text-ink-600">Preferred contact</dt>
              <dd className="capitalize">{enquiry.preferred_contact as string}</dd>
              <dt className="text-ink-600">Preferred start</dt>
              <dd>{enquiry.preferred_start_date ? new Date(enquiry.preferred_start_date as string).toLocaleDateString("en-GB", { dateStyle: "long" }) : "Not given"}</dd>
            </dl>
            {enquiry.comments && (
              <div className="mt-4 rounded-lg bg-grey-50 p-4 text-[15px] whitespace-pre-wrap text-ink-900">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-600">Customer comments</p>
                {enquiry.comments as string}
              </div>
            )}
          </section>

          <section>
            <h2 className="font-sans text-lg font-semibold">Rooms, measurements & condition</h2>
            <div className="mt-3 space-y-3">
              {items.map((item) => (
                <ItemDetails key={item.id} item={item} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-sans text-lg font-semibold">Photographs ({photos.length})</h2>
            {photos.length === 0 ? (
              <p className="mt-2 text-ink-600">No photos were uploaded.</p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {signed.map((p) => (
                  <a key={p.path} href={p.signedUrl} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-lg bg-grey-100 ring-1 ring-ink-900/10">
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived private signed URL */}
                    <img src={p.signedUrl} alt="Customer photo" className="size-full object-cover transition hover:scale-105" />
                  </a>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-ink-600">Photo links are private and expire after one hour. Refresh the page for new links.</p>
          </section>
        </div>

        <aside className="space-y-6">
          <PaymentPanel enquiry={enquiry} items={items} estimatePence={breakdown.hasPricedItems ? breakdown.totalPence : 0} />
          <QuoteBreakdown quote={breakdown} title="Online estimate (calculated)" />
          <details className="rounded-lg bg-white p-4 text-sm ring-1 ring-ink-900/10">
            <summary className="cursor-pointer font-medium">Prices used for this estimate</summary>
            <ul className="mt-3 space-y-1 text-ink-700">
              <li>Bedroom: £{snapshot.bedroom.ratePerSqm}/m², minimum £{snapshot.bedroom.minimumCharge}</li>
              <li>Living room: £{snapshot.livingRoom.ratePerSqm}/m², minimum £{snapshot.livingRoom.minimumCharge}</li>
              <li>Skirting: £{snapshot.skirting.ratePerMetre}/m, minimum £{snapshot.skirting.minimumCharge}</li>
              <li>Ceiling: £{snapshot.ceiling.ratePerSqm}/m², minimum £{snapshot.ceiling.minimumCharge}</li>
              <li>Rounded to nearest £{snapshot.roundToNearest}</li>
            </ul>
          </details>
          <NotesForm id={id} notes={(enquiry.admin_notes as string | null) ?? ""} />
        </aside>
      </div>
    </div>
  );
}
