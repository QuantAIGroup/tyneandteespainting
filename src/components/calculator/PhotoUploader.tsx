"use client";

import { useRef } from "react";
import { AlertCircle, Camera, CheckCircle2, Loader2, X } from "lucide-react";
import { LIMITS } from "@/lib/pricing/schema";

export interface UploadedPhoto {
  localId: string;
  fileName: string;
  contentType: (typeof LIMITS.photoTypes)[number];
  size: number;
  previewUrl: string;
  status: "uploading" | "done" | "error";
  progress: number;
  path?: string;
  error?: string;
}

const ACCEPT = LIMITS.photoTypes.join(",");
const MAX_MB = LIMITS.maxPhotoBytes / 1024 / 1024;

/** Upload a file straight to private storage using a one-time signed link, reporting progress. */
function uploadWithProgress(signedUrl: string, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("content-type", file.type);
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Upload failed")));
    xhr.onerror = () => reject(new Error("Upload failed – please check your connection"));
    xhr.send(file);
  });
}

export function PhotoUploader({
  getDraftId,
  photos,
  setPhotos,
  enabled,
}: {
  getDraftId: () => string;
  photos: UploadedPhoto[];
  setPhotos: (updater: (prev: UploadedPhoto[]) => UploadedPhoto[]) => void;
  enabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = LIMITS.maxPhotos - photos.length;

  const patch = (localId: string, p: Partial<UploadedPhoto>) => setPhotos((prev) => prev.map((ph) => (ph.localId === localId ? { ...ph, ...p } : ph)));

  async function startUpload(photo: UploadedPhoto, file: File) {
    try {
      const res = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: getDraftId(), contentType: file.type, size: file.size }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Upload failed");
      await uploadWithProgress(json.signedUrl, file, (pct) => patch(photo.localId, { progress: pct }));
      patch(photo.localId, { status: "done", progress: 100, path: json.path });
    } catch (err) {
      patch(photo.localId, { status: "error", error: err instanceof Error ? err.message : "Upload failed" });
    }
  }

  function onFiles(files: FileList | null) {
    if (!files) return;
    const chosen = Array.from(files).slice(0, Math.max(0, remaining));
    const added: { photo: UploadedPhoto; file: File }[] = [];
    for (const file of chosen) {
      const localId = crypto.randomUUID();
      const validType = (LIMITS.photoTypes as readonly string[]).includes(file.type);
      const validSize = file.size <= LIMITS.maxPhotoBytes;
      const photo: UploadedPhoto = {
        localId,
        fileName: file.name,
        contentType: (validType ? file.type : "image/jpeg") as UploadedPhoto["contentType"],
        size: file.size,
        previewUrl: validType ? URL.createObjectURL(file) : "",
        status: validType && validSize ? "uploading" : "error",
        progress: 0,
        error: !validType ? "Only JPG, PNG or WEBP photos can be uploaded" : !validSize ? `This photo is over ${MAX_MB} MB` : undefined,
      };
      added.push({ photo, file });
    }
    setPhotos((prev) => [...prev, ...added.map((a) => a.photo)]);
    for (const { photo, file } of added) if (photo.status === "uploading") void startUpload(photo, file);
    if (inputRef.current) inputRef.current.value = "";
  }

  function remove(localId: string) {
    setPhotos((prev) => {
      const p = prev.find((x) => x.localId === localId);
      if (p?.previewUrl) URL.revokeObjectURL(p.previewUrl);
      return prev.filter((x) => x.localId !== localId);
    });
  }

  if (!enabled) {
    return (
      <div className="rounded-lg bg-sand-50 p-5 text-sm text-navy-700 ring-1 ring-sand-200">
        Photo uploads aren&rsquo;t switched on yet. You can still send your enquiry – we may ask you to email photos instead.
      </div>
    );
  }

  return (
    <div>
      <ul className="mb-5 grid gap-1.5 text-[15px] text-navy-800">
        <li>• One photograph of each wall, where possible</li>
        <li>• A photograph of the whole room</li>
        <li>• Close-ups of any cracks, holes or damage</li>
      </ul>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p) => (
          <div key={p.localId} className="relative aspect-square overflow-hidden rounded-lg bg-sand-100 ring-1 ring-navy-900/10">
            {p.previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              <img src={p.previewUrl} alt={`Preview of ${p.fileName}`} className="size-full object-cover" />
            ) : (
              <div className="grid size-full place-items-center p-3 text-center text-xs text-navy-600">{p.fileName}</div>
            )}
            <button
              type="button"
              onClick={() => remove(p.localId)}
              className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-full bg-white/95 text-navy-900 shadow hover:text-red-700"
            >
              <X className="size-4" aria-hidden />
              <span className="sr-only">Remove {p.fileName}</span>
            </button>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/80 to-transparent p-2 text-xs text-white">
              {p.status === "uploading" && (
                <div aria-live="polite">
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden /> Uploading {p.progress}%
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded bg-white/30" role="progressbar" aria-valuenow={p.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Upload progress for ${p.fileName}`}>
                    <div className="h-full bg-gold-400 transition-all" style={{ width: `${p.progress}%` }} />
                  </div>
                </div>
              )}
              {p.status === "done" && (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-300" aria-hidden /> Uploaded
                </span>
              )}
              {p.status === "error" && (
                <span className="flex items-start gap-1.5 text-red-100" role="alert">
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {p.error}
                </span>
              )}
            </div>
          </div>
        ))}

        {remaining > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-navy-900/20 bg-white p-3 text-center text-sm text-navy-700 transition hover:border-gold-500 hover:bg-sand-50"
          >
            <Camera className="size-7 text-gold-600" aria-hidden />
            <span className="font-medium text-navy-950">Add photos</span>
            <span className="text-xs">
              {remaining} of {LIMITS.maxPhotos} left
            </span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={ACCEPT} multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} aria-label="Choose photos to upload" tabIndex={-1} />
      <p className="mt-3 text-sm text-navy-600">
        JPG, PNG or WEBP, up to {MAX_MB} MB each. Photos are private – only we can see them.
      </p>
      <p className="mt-2 text-sm text-navy-600">Photos help us check the condition of your room. Your price is always based on the measurements you entered, not the photos.</p>
    </div>
  );
}
