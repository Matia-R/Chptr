"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

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

function supportsContentFieldSizing() {
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("field-sizing", "content")
  );
}

/**
 * Inline document heading. Same typeface as the editor, without the author row.
 * Height comes from `field-sizing: content` where the browser supports it.
 * Otherwise a hidden copy of the field is measured before paint, so a wrapped
 * title never shows as one line and then pushes the editor down.
 */
export function DocumentEditorTitle({ editable }: { editable: boolean }) {
  const [nativeFieldSizing] = useState(() => supportsContentFieldSizing());
  const { isNew } = useNewDocumentFlag();
  const editor = useDocumentEditorStore((state) => state.editor);
  const { name, isLoading, isOffline, commitTitle, cancelTitle, previewTitle } =
    useDocumentTitle();
  const canEdit = editable && !isOffline;
  const frameRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLTextAreaElement>(null);
  const focusedRef = useRef(false);
  const didFocusNewTitle = useRef(false);
  const wasEditableRef = useRef(canEdit);

  const measureFallbackHeight = useCallback(() => {
    if (nativeFieldSizing) return;
    const field = fieldRef.current;
    const mirror = mirrorRef.current;
    if (!field || !mirror) return;
    if (mirror.value !== field.value) mirror.value = field.value;
    // Height 0 makes scrollHeight the wrapped content. A one-row box reports
    // its own height instead, which is what caused the shift.
    const width = field.clientWidth;
    if (width <= 0) return;
    mirror.style.width = `${width}px`;
    mirror.style.height = "0px";
    const height = mirror.scrollHeight;
    if (height <= 0) return;
    const nextHeight = `${height}px`;
    if (field.style.height !== nextHeight) field.style.height = nextHeight;
  }, [nativeFieldSizing]);

  useLayoutEffect(() => {
    if (focusedRef.current) return;
    const field = fieldRef.current;
    if (!field || name === undefined) return;
    const nextValue = titleFieldValue(name);
    if (field.value !== nextValue) field.value = nextValue;
    measureFallbackHeight();
  }, [measureFallbackHeight, name]);

  useLayoutEffect(() => {
    if (nativeFieldSizing || isLoading) return;
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === "undefined") return;

    measureFallbackHeight();

    let width = Math.round(frame.getBoundingClientRect().width);
    const observer = new ResizeObserver(() => {
      const nextWidth = Math.round(frame.getBoundingClientRect().width);
      if (nextWidth === width) return;
      width = nextWidth;
      measureFallbackHeight();
    });
    observer.observe(frame);

    let cancelled = false;
    const remeasure = () => {
      if (!cancelled) measureFallbackHeight();
    };
    const fonts = document.fonts;
    fonts?.addEventListener("loadingdone", remeasure);
    if (fonts) void fonts.ready.then(remeasure);
    // text-3xl / md:text-4xl. Column width can stay the same across this breakpoint.
    const titleSize = window.matchMedia("(min-width: 768px)");
    titleSize.addEventListener("change", remeasure);

    return () => {
      cancelled = true;
      observer.disconnect();
      fonts?.removeEventListener("loadingdone", remeasure);
      titleSize.removeEventListener("change", remeasure);
    };
  }, [isLoading, measureFallbackHeight, nativeFieldSizing]);

  useLayoutEffect(() => {
    if (wasEditableRef.current && !canEdit) {
      const baseline = cancelTitle();
      focusedRef.current = false;
      const field = fieldRef.current;
      if (field) field.value = titleFieldValue(baseline);
      measureFallbackHeight();
    }
    wasEditableRef.current = canEdit;
  }, [canEdit, cancelTitle, measureFallbackHeight]);

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
      <div ref={frameRef} className="relative w-full">
        {nativeFieldSizing ? null : (
          <textarea
            ref={mirrorRef}
            aria-hidden
            readOnly
            tabIndex={-1}
            rows={1}
            defaultValue={titleFieldValue(name)}
            className={cn(
              TITLE_CLASS,
              "pointer-events-none invisible absolute left-0 top-0 h-0 min-h-0",
            )}
          />
        )}
        <textarea
          ref={fieldRef}
          rows={1}
          defaultValue={titleFieldValue(name)}
          disabled={!canEdit}
          aria-label="Document title"
          placeholder="Untitled"
          className={cn(
            TITLE_CLASS,
            nativeFieldSizing && "document-editor-title",
            !canEdit && "cursor-default",
          )}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onInput={(event) => {
            if (!canEdit) return;
            const field = event.currentTarget;
            if (!field.value.trim()) field.value = "";
            measureFallbackHeight();
            previewTitle(field.value);
          }}
          onBlur={(event) => {
            focusedRef.current = false;
            if (!canEdit) return;
            const committed = commitTitle(event.currentTarget.value);
            event.currentTarget.value = titleFieldValue(committed);
            measureFallbackHeight();
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
    </div>
  );
}
