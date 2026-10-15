"use client";

import { useToast } from "~/hooks/use-toast";

import { PublishedCodeCopyButtonMarkup } from "./published-code-copy";

async function writeClipboard(text: string, anchor: HTMLElement) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Dialogs set pointer-events: none on body, which can reject the async
    // clipboard API. Copy from inside the open dialog instead.
  }

  const root = anchor.closest("[role='dialog']") ?? document.body;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.opacity = "0";
  const previouslyFocused =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  root.appendChild(area);
  area.focus();
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  previouslyFocused?.focus();
  if (!ok) throw new Error("copy failed");
}

/** Copy control shared by the published page and the editor preview. */
export function PublishedCodeCopyButton({ source }: { source: string }) {
  const { toast } = useToast();

  return (
    <PublishedCodeCopyButtonMarkup
      onClick={(event) => {
        void writeClipboard(source, event.currentTarget).then(
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
    />
  );
}
