"use client";

import { useEffect, useRef } from "react";

import { useDocumentTitle } from "~/hooks/use-document-title";
import { cn } from "~/lib/utils";

const TITLE_CLASS =
  "w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-serif text-3xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/70 md:text-4xl";

/** Inline document heading. Matches the published title, without the author row. */
export function DocumentEditorTitle() {
  const { name, isLoading, isOffline, commitTitle, previewTitle } =
    useDocumentTitle();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const focusedRef = useRef(false);

  const resize = () => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${field.scrollHeight}px`;
  };

  useEffect(() => {
    if (focusedRef.current) return;
    const field = fieldRef.current;
    if (!field || name === undefined) return;
    field.value = name;
    resize();
  }, [name]);

  if (isLoading) {
    return (
      <div className="mb-8 border-b border-border/60 pb-6">
        <div className="h-10 w-2/3 animate-pulse rounded-md bg-accent md:h-12" />
      </div>
    );
  }

  return (
    <div className="mb-8 border-b border-border/60 pb-6">
      <textarea
        ref={fieldRef}
        rows={1}
        defaultValue={name ?? "Untitled"}
        disabled={isOffline}
        aria-label="Document title"
        placeholder="Untitled"
        className={cn(TITLE_CLASS, isOffline && "cursor-default")}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onInput={(event) => {
          resize();
          previewTitle(event.currentTarget.value);
        }}
        onBlur={(event) => {
          focusedRef.current = false;
          const committed = commitTitle(event.currentTarget.value);
          event.currentTarget.value = committed;
          resize();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          event.currentTarget.blur();
        }}
      />
    </div>
  );
}
