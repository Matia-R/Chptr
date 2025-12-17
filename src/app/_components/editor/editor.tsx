"use client";

import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/shadcn";
import "./style.css";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";
import { SuggestionMenuController, useCreateBlockNote } from "@blocknote/react";

import { Alert } from "./custom-blocks/Alert";
import type * as Y from "yjs";
import type { WebrtcProvider } from "y-webrtc";
import { renderCursor } from "./cursor-renderer";
import {
  supportedLanguages,
  createCodeBlockHighlighter,
} from "./codeBlockSyntaxHighlighter";

type Theme = "light" | "dark" | "system";

interface EditorProps {
  userName: string;
  userColor: string;
  ydoc: Y.Doc;
  provider: WebrtcProvider;
}

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    alert: Alert,
  },
});

export default function Editor({
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
      ...(currentTheme && { theme: currentTheme }),
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

  return (
    <BlockNoteView editor={editor} theme={currentTheme as "light" | "dark"}>
      <SuggestionMenuController
        triggerCharacter="@"
        getItems={async () => []} // placeholder
      />
    </BlockNoteView>
  );
}
