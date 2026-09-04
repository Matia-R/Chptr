"use client";

import { CloudOff } from "lucide-react";

import { formSpacing } from "~/lib/form-spacing";

export function OfflineProfileNotice() {
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <CloudOff className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      You’re offline. Profile changes are unavailable until you reconnect.
    </p>
  );
}

export function OfflinePasswordUnavailable() {
  return (
    <div className="flex min-h-[14rem] flex-col items-center justify-center px-4 text-center">
      <div className={formSpacing.tight}>
        <CloudOff
          className="mx-auto size-6 text-muted-foreground"
          aria-hidden
        />
        <h3 className="text-base font-semibold tracking-tight text-sidebar-foreground">
          Password changes are unavailable offline
        </h3>
        <p className="text-xs text-muted-foreground">
          Reconnect to the internet to change your password.
        </p>
      </div>
    </div>
  );
}
