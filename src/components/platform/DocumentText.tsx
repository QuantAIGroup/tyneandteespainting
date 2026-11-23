/**
 * Shows legal document text safely as plain paragraphs (no HTML is ever
 * interpreted). Lines that look like headings ("3.2 Title", "SCHEDULE A")
 * are made bold. Painters can print or "Save as PDF" from the browser.
 */
export function DocumentText({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-ink-900 print:text-black">
      {paragraphs.map((p, i) => {
        const firstLine = p.split("\n")[0];
        const isHeading = /^(\d+(\.\d+)*\.?\s+[A-Z]|SCHEDULE|DOCUMENT|Schedule|PART\s)/.test(firstLine) && firstLine.length < 90 && !firstLine.endsWith(".");
        return isHeading ? (
          <h3 key={i} className="pt-2 font-bold">
            {p}
          </h3>
        ) : (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        );
      })}
    </div>
  );
}
