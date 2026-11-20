import { Phone } from "lucide-react";
import { telHref } from "@/config/site";

/** Always-visible call button fixed to the bottom of the screen on mobiles and tablets. */
export function MobileCallBar({ phone }: { phone: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-950/10 bg-white/95 p-2.5 backdrop-blur lg:hidden">
      <a href={telHref(phone)} className="flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-brand-600 text-base font-bold text-white shadow-md active:bg-brand-700">
        <Phone className="size-5" aria-hidden />
        CALL US: {phone}
      </a>
    </div>
  );
}
