"use client";

import { Copy } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "~/app/_components/button";
import { useToast } from "~/hooks/use-toast";

export function PublishedCodeBlock({
  source,
  children,
}: {
  source: string;
  children: ReactNode;
}) {
  const { toast } = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(source);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({
        variant: "destructive",
        title: "Could not copy",
        description: "Try again or copy the code manually.",
      });
    }
  }

  return (
    <div className="published-code relative my-3 rounded-md">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-1.5 top-1.5 size-7 text-[hsl(var(--code-block-foreground))] opacity-40 hover:bg-transparent hover:opacity-80"
        onClick={() => void copy()}
        aria-label="Copy"
      >
        <Copy className="size-3.5" />
      </Button>
      <pre className="overflow-x-auto p-4 pr-10 font-mono text-sm leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
}
