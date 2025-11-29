"use client";

import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/shadcn";
import "./style.css";
import { useTheme } from "next-themes";
import { useEffect, useState, useCallback } from "react";
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
        },
        ...(currentTheme && { theme: currentTheme }),
    },
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
