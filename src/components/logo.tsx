/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

/** App logo. To use your own, replace public/logo.svg (or change the src to /logo.png). */
export function Logo({ className }: { className?: string }) {
  return <img src="/logo.svg" alt="" width={32} height={32} className={cn("size-8 shrink-0 rounded-lg", className)} />;
}
