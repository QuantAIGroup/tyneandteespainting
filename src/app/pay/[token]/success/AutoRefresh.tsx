"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-checks the payment status every 3 seconds for up to 2 minutes. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      if (count > 40) return clearInterval(timer);
      router.refresh();
    }, 3000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
