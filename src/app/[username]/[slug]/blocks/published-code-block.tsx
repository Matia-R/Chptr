"use client";

import { Button } from "~/app/_components/button";
import { useToast } from "~/hooks/use-toast";

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
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="absolute right-1.5 top-1.5 z-10 size-7 text-[hsl(var(--code-block-foreground))] opacity-40 hover:bg-transparent hover:opacity-80"
      aria-label="Copy"
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
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-3.5"
        aria-hidden
      >
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
      </svg>
    </Button>
  );
}
