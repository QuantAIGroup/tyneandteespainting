import { isPlaceholder, telHref, type BusinessSettings } from "@/config/site";

/** Name, address (when set), phone and email (when set) – used where customers need to contact us to cancel. */
export function BusinessContact({ business }: { business: BusinessSettings }) {
  const email = !isPlaceholder(business.email) && business.email.trim() ? business.email : null;
  return (
    <address className="not-italic">
      <strong>{business.name}</strong>
      <br />
      {business.address.trim() ? business.address : "Newcastle upon Tyne"}
      <br />
      Telephone:{" "}
      <a href={telHref(business.phone)} className="font-semibold text-brand-600">
        {business.phone}
      </a>
      {email && (
        <>
          <br />
          Email:{" "}
          <a href={`mailto:${email}`} className="font-semibold text-brand-600">
            {email}
          </a>
        </>
      )}
    </address>
  );
}
