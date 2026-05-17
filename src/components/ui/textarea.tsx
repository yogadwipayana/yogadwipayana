import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[100px] w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 py-2 text-[14px] leading-relaxed text-white placeholder:text-white/30 transition-colors focus:border-[#3ecf8e]/60 focus:outline-none focus:ring-2 focus:ring-[#3ecf8e]/20 disabled:cursor-not-allowed disabled:opacity-60",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
