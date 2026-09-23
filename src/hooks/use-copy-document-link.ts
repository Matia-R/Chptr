"use client";

import { useCallback } from "react";

import { useToast } from "~/hooks/use-toast";

export function useCopyDocumentLink() {
  const { toast } = useToast();

  return useCallback(
    async (documentId: string) => {
      const url = new URL(
        `/documents/${documentId}`,
        window.location.origin,
      ).href;
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: "Copied to clipboard" });
      } catch {
        toast({
          variant: "destructive",
          title: "Could not copy",
          description: "Try again or copy the link manually.",
        });
      }
    },
    [toast],
  );
}
