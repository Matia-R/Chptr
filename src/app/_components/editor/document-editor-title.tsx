"use client";

import { useEffect, useRef } from "react";

import { useDocumentEditorStore } from "~/app/_components/editor/document-editor-store";
import { useDocumentTitle } from "~/hooks/use-document-title";
import { useNewDocumentFlag } from "~/hooks/use-new-document-flag";
import { cn } from "~/lib/utils";

const TITLE_CLASS =
  "w-full resize-none overflow-hidden border-0 bg-transparent p-0 font-sans text-3xl font-semibold tracking-tight text-foreground outline-none placeholder:text-foreground/25 md:text-4xl";

/** Default name is a placeholder, not characters in the field. */
function titleFieldValue(name: string | undefined) {
  const trimmed = (name ?? "").trim();
  if (!trimmed || trimmed === "Untitled") return "";
  return name ?? "";
}

/** Inline document heading. Same typeface as the editor, without the author row. */
export function DocumentEditorTitle({ editable }: { editable: boolean }) {
  const { isNew } = useNewDocumentFlag();
  const editor = useDocumentEditorStore((state) => state.editor);
  const { name, isLoading, isOffline, commitTitle, previewTitle } =
    useDocumentTitle();
  const canEdit = editable && !isOffline;
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const focusedRef = useRef(false);
  const didFocusNewTitle = useRef(false);

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
    const nextValue = titleFieldValue(name);
    if (field.value !== nextValue) field.value = nextValue;
    resize();
  }, [name]);

  useEffect(() => {
    if (!isNew || didFocusNewTitle.current || isLoading || !canEdit) return;
    const field = fieldRef.current;
    if (!field) return;
    const id = window.setTimeout(() => {
      field.focus();
      didFocusNewTitle.current = true;
    }, 0);
    return () => window.clearTimeout(id);
  }, [isNew, isLoading, canEdit, editor]);

  if (isLoading) {
    return (
      <div className="mb-8">
        <div className="h-10 w-2/3 animate-pulse rounded-md bg-accent md:h-12" />
      </div>
    );
  }

  return (
    <div className="mb-8">
      <textarea
        ref={fieldRef}
        rows={1}
        defaultValue={titleFieldValue(name)}
        disabled={!canEdit}
        aria-label="Document title"
        placeholder="Untitled"
        className={cn(TITLE_CLASS, !canEdit && "cursor-default")}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onInput={(event) => {
          if (!canEdit) return;
          if (!event.currentTarget.value.trim()) {
            event.currentTarget.value = "";
          }
          resize();
          previewTitle(event.currentTarget.value);
        }}
        onBlur={(event) => {
          focusedRef.current = false;
          if (!canEdit) return;
          const committed = commitTitle(event.currentTarget.value);
          event.currentTarget.value = titleFieldValue(committed);
          resize();
        }}
        onKeyDown={(event) => {
          if (!canEdit || event.key !== "Enter") return;
          event.preventDefault();
          if (!event.currentTarget.value.trim()) return;
          event.currentTarget.blur();
          const block = editor?.document[0];
          if (!editor || !block) return;
          editor.setTextCursorPosition(block, "start");
          editor.focus();
        }}
      />
    </div>
  );
}
