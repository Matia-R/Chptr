"use client";

import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/shadcn";
import "./style.css";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { en } from "@blocknote/core/locales";
import { SuggestionMenuController, useCreateBlockNote } from "@blocknote/react";

import { Alert } from "./custom-blocks/Alert";
import { AiPromptInput } from "./custom-blocks/AiPromptInput";
import type * as Y from "yjs";
import type { WebrtcProvider } from "y-webrtc";
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
import { DocumentPublishBar } from "./document-publish-bar";

type Theme = "light" | "dark" | "system";

interface EditorProps {
  documentId: string;
  userName: string;
  userColor: string;
  ydoc: Y.Doc;
  provider: WebrtcProvider;
}

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    alert: Alert,
    aiPromptInput: AiPromptInput,
  },
});

export default function Editor({
  documentId,
  userName,
  userColor,
  ydoc,
  provider,
}: EditorProps) {
  const { theme } = useTheme();
  const [currentTheme, setCurrentTheme] = useState<Theme>(theme as Theme);

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

  // --- Theme handling ---
  useEffect(() => {
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const newTheme = mediaQuery.matches ? "dark" : "light";
      setCurrentTheme(newTheme);
      const handleChange = (e: MediaQueryListEvent) => {
        setCurrentTheme(e.matches ? "dark" : "light");
      };
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      setCurrentTheme(theme as Theme);
    }
  }, [theme]);

  // --- Cmd+/ (Mac) or Ctrl+/ (Windows/Linux): insert AiPromptInput block ---
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
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
    [editor],
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
    <div ref={editorContainerRef} className="contents">
      <DocumentPublishBar documentId={documentId} editor={editor} />
      <BlockNoteView
        editor={editor}
        theme={currentTheme as "light" | "dark"}
        shadCNComponents={shadCNComponents}
      >
        <SuggestionMenuController
          triggerCharacter="@"
          getItems={async () => []} // placeholder
        />
      </BlockNoteView>
    </div>
  );
}
