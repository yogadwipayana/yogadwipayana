"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] error boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1c1c1c] p-6 text-white">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-lg border border-white/[0.08] bg-[#171717] px-6 py-16 text-center">
        <AlertCircle className="h-8 w-8 text-white/20" />
        <div className="space-y-1.5">
          <h3 className="text-[15px] font-medium text-white">Something went wrong</h3>
          <p className="text-[13px] text-white/50">
            This page didn&apos;t load. Please try again.
          </p>
        </div>
        {error.digest && (
          <p className="font-mono text-[10px] text-white/20">Ref: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-2 flex items-center gap-2 rounded-md bg-[#3ecf8e] px-4 py-2 text-[13px] font-medium text-[#171717] transition-colors hover:bg-[#24b47e]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
      </div>
    </div>
  );
}
