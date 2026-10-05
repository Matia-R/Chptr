"use client";

import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/shadcn";
import "~/app/_components/article/article.css";
import "./style.css";
import "~/app/_components/article/editor-article.css";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef } from "react";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { en } from "@blocknote/core/locales";
import { SuggestionMenuController, useCreateBlockNote } from "@blocknote/react";

import { Alert } from "./custom-blocks/Alert";
import { AiPromptInput } from "./custom-blocks/AiPromptInput";
import type * as Y from "yjs";
import { renderCursor } from "./cursor-renderer";
import {
  supportedLanguages,
  createCodeBlockHighlighter,
} from "./codeBlockSyntaxHighlighter";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "~/app/_components/popover";
import { DocumentEditorTitle } from "./document-editor-title";
import { useDocumentEditorStore } from "./document-editor-store";

interface CollaborationProvider {
  awareness: unknown;
  destroy?: () => void;
}

interface EditorProps {
  userName: string;
  userColor: string;
  ydoc: Y.Doc;
  provider: CollaborationProvider;
  editable?: boolean;
}

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    alert: Alert,
    aiPromptInput: AiPromptInput,
  },
});

/**
 * Resolve BlockNote's theme on the first paint.
 *
 * next-themes' `theme` can be `"system"`, and `resolvedTheme` can be briefly
 * undefined while the provider hydrates. Delaying the dark value until a
 * useEffect caused `.bn-editor` to paint with its default white background.
 * This editor is client-only (`dynamic(..., { ssr: false })`), so reading the
 * `dark` class next-themes already put on `<html>` is safe and keeps doc
 * switches from flashing light.
 */
function useEditorColorScheme(): "light" | "dark" {
  const { resolvedTheme } = useTheme();

  if (resolvedTheme === "dark" || resolvedTheme === "light") {
    return resolvedTheme;
  }

  if (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  ) {
    return "dark";
  }

  return "light";
}

export default function Editor({
  userName,
  userColor,
  ydoc,
  provider,
  editable = true,
}: EditorProps) {
  const editorTheme = useEditorColorScheme();

  const setDocumentEditor = useDocumentEditorStore((s) => s.setEditor);

  const editor = useCreateBlockNote(
    {
      schema,
      dictionary: {
        ...en,
        placeholders: {
          ...en.placeholders,
          default: "Type '/' for commands or ⌘ + '/' to generate something",
        },
      },
      collaboration: {
        provider: provider,
        fragment: ydoc.getXmlFragment("document-store"),
        user: {
          name: userName,
          color: userColor,
        },
        showCursorLabels: "always",
        renderCursor: renderCursor,
      },
      codeBlock: {
        indentLineWithTab: true,
        defaultLanguage: "typescript",
        supportedLanguages,
        createHighlighter: createCodeBlockHighlighter,
      },
    },
    [userName, userColor, provider, ydoc],
  );

  useEffect(() => {
    setDocumentEditor(editor);
    return () => {
      setDocumentEditor(null);
    };
  }, [editor, setDocumentEditor]);

  // --- Cmd+/ (Mac) or Ctrl+/ (Windows/Linux): insert AiPromptInput block ---
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!editable) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        const container = editorContainerRef.current;
        if (!container?.contains(document.activeElement)) return;
        e.preventDefault();

        // Only one AI prompt input block at a time: if one exists, do nothing
        const hasAiPromptInput = editor.document.some(
          (b) => (b as { type?: string }).type === "aiPromptInput",
        );
        if (hasAiPromptInput) return;

        const currentBlock = editor.getTextCursorPosition().block;
        const isEmptyParagraph =
          currentBlock.type === "paragraph" &&
          (!currentBlock.content ||
            (Array.isArray(currentBlock.content) &&
              (currentBlock.content.length === 0 ||
                (
                  currentBlock.content as { type: string; text?: string }[]
                ).every((x) => x.type === "text" && !x.text?.trim()))));

        if (isEmptyParagraph) {
          editor.insertBlocks(
            [{ type: "aiPromptInput", props: { value: "" } }],
            currentBlock,
            "before",
          );
          editor.removeBlocks([currentBlock]);
        } else {
          editor.insertBlocks(
            [{ type: "aiPromptInput", props: { value: "" } }],
            currentBlock,
            "after",
          );
        }
        // Close formatting toolbar so it doesn’t render above the new command input (floating-ui wrapper at z-index 3000)
        editor.formattingToolbar.closeMenu();
      }
    },
    [editor, editable],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // --- Custom shadcn components for BlockNote ---
  const shadCNComponents = {
    Popover: {
      Popover,
      PopoverTrigger,
      PopoverContent,
    },
  };

  return (
    <>
      <div
        className="box-border w-full"
        style={{
          paddingInline: "var(--document-content-inline-padding, 44px)",
        }}
      >
        <DocumentEditorTitle editable={editable} />
      </div>
      <div ref={editorContainerRef} className="contents">
        <BlockNoteView
          editor={editor}
          editable={editable}
          theme={editorTheme}
          shadCNComponents={shadCNComponents}
        >
          <SuggestionMenuController
            triggerCharacter="@"
            getItems={async () => []} // placeholder
          />
        </BlockNoteView>
      </div>
    </>
  );
}
