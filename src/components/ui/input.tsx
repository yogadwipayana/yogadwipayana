import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        "h-11 w-full rounded-md border border-white/[0.08] bg-[#1c1c1c] px-3 text-[14px] text-white placeholder:text-white/30 transition-colors focus:border-[#3ecf8e]/60 focus:outline-none focus:ring-2 focus:ring-[#3ecf8e]/20 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
