"use client";

import type { ReactNode } from "react";

import { useToast } from "~/hooks/use-toast";

/** Copy control for published code blocks. The blocks themselves stay server markup. */
export function PublishedCodeCopy({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  return (
    <div
      onClick={(event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const button = target.closest("[data-copy-code]");
        if (!(button instanceof HTMLElement)) return;
        const code = button.parentElement?.querySelector("code");
        const source = code?.textContent ?? "";
        void navigator.clipboard.writeText(source).then(
          () => {
            toast({ title: "Copied to clipboard" });
          },
          () => {
            toast({
              variant: "destructive",
              title: "Could not copy",
              description: "Try again or copy the code manually.",
            });
          },
        );
      }}
    >
      {children}
    </div>
  );
}
