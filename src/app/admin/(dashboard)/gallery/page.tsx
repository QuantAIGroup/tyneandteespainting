import { requireAdmin } from "@/lib/auth";
import { GALLERY_CATEGORIES, galleryPublicUrl } from "@/lib/gallery";
import { createSessionClient } from "@/lib/supabase/server";
import { GalleryItemControls, GalleryUploadForm } from "./GalleryAdmin";

export default async function AdminGalleryPage() {
  await requireAdmin();
  const supabase = (await createSessionClient())!;
  const { data } = await supabase.from("gallery_items").select("*").order("created_at", { ascending: false });
  const rows = data ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl">Gallery</h1>
        <p className="mt-1 max-w-2xl text-ink-600">
          Add before-and-after photos of your own completed work. They appear at the top of the website gallery, above the photos built into the site (src/config/gallery.ts).
          Only use customers&rsquo; photos with their permission.
        </p>
      </div>
      <GalleryUploadForm categories={GALLERY_CATEGORIES} />
      <section>
        <h2 className="font-sans text-lg font-semibold">Your gallery ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="mt-3 rounded-xl bg-white p-8 text-center text-ink-600 ring-1 ring-ink-900/10">No uploaded photos yet – the website is showing the before-and-after photos built into the site.</p>
        ) : (
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <li key={r.id as string} className="overflow-hidden rounded-xl bg-white ring-1 ring-ink-900/10">
                <div className="grid grid-cols-2 gap-px bg-ink-900/10">
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
                  {r.before_path ? <img src={galleryPublicUrl(r.before_path as string)} alt="Before" className="aspect-square size-full object-cover" /> : <div className="grid aspect-square place-items-center bg-grey-50 text-xs text-ink-600">No before photo</div>}
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin preview */}
                  <img src={galleryPublicUrl(r.after_path as string)} alt="After" className="aspect-square size-full object-cover" />
                </div>
                <div className="p-4">
                  <p className="font-medium text-ink-950">{r.title as string}</p>
                  <p className="text-sm text-ink-600">
                    {GALLERY_CATEGORIES.find((c) => c.id === r.category)?.label}
                    {r.location ? ` · ${r.location}` : ""}
                  </p>
                  <GalleryItemControls id={r.id as string} published={r.published as boolean} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
