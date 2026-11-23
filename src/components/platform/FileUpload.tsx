"use client";

import { useState } from "react";
import { Loader2, Upload } from "lucide-react";

/**
 * Uploads one file straight to private storage using a one-time link from the
 * server, then puts the stored path into a hidden form field called `name`.
 */
export function FileUpload({
  name,
  purpose,
  jobId,
  accept = "application/pdf,image/jpeg,image/png,image/webp",
  label = "Choose file",
  required,
}: {
  name: string;
  purpose: "evidence" | "job-photo" | "case-evidence";
  jobId?: string;
  accept?: string;
  label?: string;
  required?: boolean;
}) {
  const [path, setPath] = useState("");
  const [status, setStatus] = useState<{ busy: boolean; text: string; error?: boolean }>({ busy: false, text: "" });

  async function onChange(file: File | undefined) {
    if (!file) return;
    setPath("");
    setStatus({ busy: true, text: "Uploading…" });
    try {
      const res = await fetch("/api/painter/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose, contentType: file.type, size: file.size, jobId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      const put = await fetch(json.signedUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!put.ok) throw new Error("Upload failed. Please try again.");
      setPath(json.path);
      setStatus({ busy: false, text: `Uploaded: ${file.name}` });
    } catch (e) {
      setStatus({ busy: false, text: e instanceof Error ? e.message : "Upload failed", error: true });
    }
  }

  return (
    <div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-ink-950/15 bg-white px-4 py-2 text-sm font-semibold hover:border-brand-600 hover:text-brand-600">
        {status.busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
        {label}
        <input type="file" accept={accept} className="sr-only" onChange={(e) => onChange(e.target.files?.[0])} />
      </label>
      <input type="hidden" name={name} value={path} required={required} />
      {status.text && <p className={`mt-1.5 text-sm ${status.error ? "text-red-700" : "text-ink-700"}`}>{status.text}</p>}
    </div>
  );
}
