"use client";

import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/shadcn";
import "./style.css";
import { useTheme } from "next-themes";
import { useEffect, useState, useCallback, useRef } from "react";
import {
BlockNoteSchema,
defaultBlockSpecs,
} from "@blocknote/core";
import {
SuggestionMenuController,
useCreateBlockNote,
} from "@blocknote/react";

import { Alert } from "./custom-blocks/Alert";
import type * as Y from "yjs";
import type { WebrtcProvider } from "y-webrtc";
import { createHighlighter } from "shiki";

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
    },
});

export default function CollaborativeEditor({ userName, userColor, ydoc, provider }: EditorProps) {
const { theme } = useTheme();
const [currentTheme, setCurrentTheme] = useState<Theme>(theme as Theme);

// --- Setup BlockNote with collaboration ---
const editorRef = useRef<ReturnType<typeof useCreateBlockNote> | null>(null);

const editor = useCreateBlockNote(
  (() => {
    if (editorRef.current) return {};

    editorRef.current = {} as ReturnType<typeof useCreateBlockNote>;

    return {
      schema,
      collaboration: {
        provider: provider,
        fragment: ydoc.getXmlFragment("document-store"),
        user: {
          name: userName,
          color: userColor,
        },
        showCursorLabels: "always",
      },
      codeBlock: {
        indentLineWithTab: true,
        defaultLanguage: "typescript",
        supportedLanguages: {
            javascript: { name: "JavaScript", aliases: ["js"] },
            typescript: { name: "TypeScript", aliases: ["ts"] },
            python: { name: "Python", aliases: ["py"] },
            java: { name: "Java" },
            c: { name: "C" },
            cpp: { name: "C++" },
            go: { name: "Go" },
            ruby: { name: "Ruby" },
            php: { name: "PHP" },
            rust: { name: "Rust" },
            kotlin: { name: "Kotlin" },
            swift: { name: "Swift" },
            csharp: { name: "C#", aliases: ["cs"] },
            scala: { name: "Scala" },
            html: { name: "HTML" },
            css: { name: "CSS" },
            json: { name: "JSON" },
            yaml: { name: "YAML", aliases: ["yml"] },
            markdown: { name: "Markdown", aliases: ["md"] },
            sql: { name: "SQL" },
            bash: { name: "Bash", aliases: ["sh"] },
            powershell: { name: "PowerShell", aliases: ["ps"] },
            dart: { name: "Dart" },
            "objective-c": { name: "Objective-C", aliases: ["objc"] },
        },
        createHighlighter: () => 
            createHighlighter({
            themes: ["github-dark"],
            langs: ["javascript", "typescript", "python", "html", "css", "json", "yaml", "markdown", "sql", "bash", "powershell", "dart", "objective-c"],
        })
    },
      ...(currentTheme && { theme: currentTheme }),
    };
  })(),
  [currentTheme, userName, userColor, provider, ydoc]
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

const handleChange = useCallback(() => {
    // Optional: can save content locally or send to server
}, []);

return (
    <BlockNoteView
        editor={editor}
        theme={currentTheme as "light" | "dark"}
        onChange={handleChange}
    >
        <SuggestionMenuController
            triggerCharacter="@"
            getItems={async () => []} // placeholder
        />
    </BlockNoteView>
);
}
