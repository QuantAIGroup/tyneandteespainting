"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Loader2, Upload } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { LIMITS } from "@/lib/pricing/schema";
import { Button } from "@/components/ui/Button";
import { Alert, Field, Input, Select } from "@/components/ui/Form";
import { createGalleryItem, deleteGalleryItem, setGalleryPublished } from "../../actions";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function checkFile(file: File | null, label: string): string | null {
  if (!file || file.size === 0) return null;
  if (!(LIMITS.photoTypes as readonly string[]).includes(file.type)) return `${label}: only JPG, PNG or WEBP`;
  if (file.size > LIMITS.maxPhotoBytes) return `${label}: must be under 10 MB`;
  return null;
}

export function GalleryUploadForm({ categories }: { categories: { id: string; label: string }[] }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const category = String(fd.get("category"));
    const before = fd.get("before") as File | null;
    const after = fd.get("after") as File | null;
    setResult(null);
    if (!after || after.size === 0) return setResult({ ok: false, message: "Please choose an 'after' photo." });
    const problem = checkFile(before, "Before photo") || checkFile(after, "After photo");
    if (problem) return setResult({ ok: false, message: problem });

    const supabase = createBrowserSupabase();
    if (!supabase) return setResult({ ok: false, message: "Supabase isn't configured." });
    setBusy(true);
    try {
      const upload = async (file: File) => {
        const path = `${category}/${crypto.randomUUID()}.${EXT[file.type]}`;
        const { error } = await supabase.storage.from("gallery").upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw new Error(error.message);
        return path;
      };
      const afterPath = await upload(after);
      const beforePath = before && before.size > 0 ? await upload(before) : undefined;
      const res = await createGalleryItem({
        category: category as "bedrooms",
        title: String(fd.get("title") ?? ""),
        location: String(fd.get("location") ?? ""),
        beforePath,
        afterPath,
      });
      setResult(res);
      if (res?.ok) form.reset();
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl bg-white p-6 ring-1 ring-ink-900/10">
      <h2 className="font-sans text-lg font-semibold">Add before-and-after photos</h2>
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        <Field label="Category" htmlFor="category" required>
          <Select id="category" name="category" defaultValue={categories[0].id}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" htmlFor="title" required hint="e.g. Double bedroom in soft grey">
          <Input id="title" name="title" required minLength={2} maxLength={100} />
        </Field>
        <Field label="Area (optional)" htmlFor="location" hint="e.g. Jesmond">
          <Input id="location" name="location" maxLength={60} />
        </Field>
        <Field label="Before photo (optional)" htmlFor="before">
          <Input id="before" name="before" type="file" accept="image/jpeg,image/png,image/webp" />
        </Field>
        <Field label="After photo" htmlFor="after" required>
          <Input id="after" name="after" type="file" accept="image/jpeg,image/png,image/webp" required />
        </Field>
      </div>
      <p className="mt-4 text-sm text-ink-600">For the slider to look right, take the before and after photos from the same spot. Landscape photos work best.</p>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
          {busy ? "Uploading…" : "Add to gallery"}
        </Button>
        {result && <Alert tone={result.ok ? "success" : "error"}>{result.message}</Alert>}
      </div>
    </form>
  );
}

export function GalleryItemControls({ id, published }: { id: string; published: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="mt-3 flex gap-2">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => start(async () => void (await setGalleryPublished(id, !published)))}>
        {published ? "Hide from website" : "Publish"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-red-700 hover:bg-red-50"
        disabled={pending}
        onClick={() => {
          if (window.confirm("Delete this gallery item and its photos? This can't be undone.")) start(async () => void (await deleteGalleryItem(id)));
        }}
      >
        Delete
      </Button>
      {!published && <span className="self-center text-xs text-ink-600">Hidden</span>}
    </div>
  );
}
