"use client"

import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/shadcn";
import { ThemeToggle } from "./theme-toggle";
import "./style.css";
import { useTheme } from "next-themes";
import { useEffect, useState, useMemo } from "react";
import { type Block, BlockNoteEditor, type PartialBlock } from "@blocknote/core";

// Define a type for the theme
type Theme = 'light' | 'dark' | 'system';

async function saveToStorage(jsonBlocks: Block[]) {
    // Save contents to local storage. You might want to debounce this or replace
    // with a call to your API / database.
    localStorage.setItem("editorContent", JSON.stringify(jsonBlocks));
}

async function loadFromStorage() {
    // Gets the previously stored editor contents.
    const storageString = localStorage.getItem("editorContent");
    return storageString
        ? (JSON.parse(storageString) as PartialBlock[])
        : undefined;
}

export default function Editor() {

    const { theme } = useTheme();
    const [currentTheme, setCurrentTheme] = useState<Theme>(theme as Theme);
    const [initialContent, setInitialContent] = useState<
        PartialBlock[] | undefined | "loading"
    >("loading");

    useEffect(() => {
        if (theme === "system") {
            const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

            // Set the initial theme based on the system preference
            setCurrentTheme(mediaQuery.matches ? "dark" : "light");

            // Listen for changes in the system theme
            const handleChange = (e: MediaQueryListEvent) => {
                setCurrentTheme(e.matches ? "dark" : "light");
            };

            mediaQuery.addEventListener("change", handleChange);

            // Cleanup listener on component unmount
            return () => {
                mediaQuery.removeEventListener("change", handleChange);
            };
        } else {
            setCurrentTheme(theme as Theme);
        }
        // Load initial content
        loadFromStorage().then(content => {
            setInitialContent(content);
        }).catch(error => {
            console.error("Failed to load editor content:", error);
            setInitialContent(undefined);
        });

    }, [theme]);

    // Creates a new editor instance.
    const editor = useMemo(() => {
        if (initialContent === "loading") {
            return undefined;
        }
        return BlockNoteEditor.create({ initialContent });
    }, [initialContent]);

    if (editor === undefined) {
        return "Loading content...";
    }

    // Renders the editor instance using a React component.
    return (
        <div>
            <BlockNoteView
                editor={editor}
                shadCNComponents={{
                    // Pass modified ShadCN components from your project here.
                    // Otherwise, the default ShadCN components will be used.
                }}
                theme={currentTheme as 'light' | 'dark'}
                onChange={() => {
                    void saveToStorage(editor.document).catch(error => {
                        console.error("Failed to save editor content:", error);
                    });
                }}
            />
            <ThemeToggle />
        </div>
    );
}