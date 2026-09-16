"use client";

import { type ReactNode } from "react";
import { MotionFade } from "~/app/_components/motion-fade";
import { useDocumentUnavailableStore } from "~/hooks/use-document-unavailable";
import { formSpacing } from "~/lib/form-spacing";
import { cn } from "~/lib/utils";

export function DocumentsMain({ children }: { children: ReactNode }) {
  const isUnavailable = useDocumentUnavailableStore(
    (state) => state.isUnavailable,
  );

  return (
    <main
      data-app-scroll-root
      className="relative min-h-0 flex-1 touch-pan-y overflow-auto overscroll-y-contain max-md:pt-12"
    >
      {isUnavailable ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center px-4 max-md:top-12">
          <MotionFade>
            <div className={cn("max-w-xs text-center", formSpacing.tight)}>
              <h1 className="text-base font-semibold tracking-tight">
                Document not found
              </h1>
              <p className="text-sm text-muted-foreground">
                This document may have been deleted, or you may not have access
                to it.
              </p>
            </div>
          </MotionFade>
        </div>
      ) : null}
      <div
        className={cn(
          "pt-20 md:pl-8 md:pr-4 md:pt-28 lg:pl-12 lg:pr-4 lg:pt-28",
          isUnavailable && "hidden",
        )}
      >
        <div className="mx-auto min-w-0 max-w-[768px] px-4 md:px-0">
          {children}
        </div>
      </div>
    </main>
  );
}
