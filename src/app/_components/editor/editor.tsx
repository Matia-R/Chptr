"use client"

import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/shadcn";
import { ThemeToggle } from "../theme-toggle";
import "./style.css";
import { useTheme } from "next-themes";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { type Block, BlockNoteEditor, type PartialBlock, filterSuggestionItems, } from "@blocknote/core";
import { type DefaultReactSuggestionItem, SuggestionMenuController } from "@blocknote/react";
import { api } from "~/trpc/react";
import { LangChainAdapter } from "ai";

// Define a type for the theme
type Theme = 'light' | 'dark' | 'system';

async function saveToStorage(jsonBlocks: Block[]) {
    try {
        localStorage.setItem("editorContent", JSON.stringify(jsonBlocks));
    } catch (e) {
        if (e instanceof Error) {
            console.error("Failed to save to localStorage:", e.message);
        }
    }
}

interface EditorProps {
    initialContent: PartialBlock[];
    documentId: string;
}

export default function Editor({ initialContent: propInitialContent, documentId }: EditorProps) {
    const { theme } = useTheme();
    const [currentTheme, setCurrentTheme] = useState<Theme>(theme as Theme);
    const saveDocument = api.document.saveDocument.useMutation();
    const summarize = api.atActions.summarize.useMutation();
    const [streamContent, setStreamContent] = useState("");
    const timeoutRef = useRef<NodeJS.Timeout>();

    useEffect(() => {
        if (streamContent) {
            console.log('Current content:', streamContent);
        }
    }, [streamContent]);

    const getAtActionMenuItems = (content: string): DefaultReactSuggestionItem[] => {
        const actions = ['summarize']

        return actions.map((action) => ({
            title: action,
            onItemClick: async () => {
                setStreamContent(""); // Reset content
                const result = await summarize.mutateAsync(content);

                const stream = new ReadableStream({
                    async start(controller) {
                        for await (const text of result) {
                            if (text?.type === "finish") {
                                controller.close();
                                break;
                            } else if (text?.type === "text-delta") {
                                setStreamContent(prev => prev + text.textDelta);
                                editor.insertInlineContent([{
                                    type: "text" as const,
                                    text: text.textDelta,
                                    styles: {}
                                }]);
                                controller.enqueue(text.textDelta);
                            }
                        }
                    },
                });

                console.log('Final content:', streamContent);
            },
        }));
    };

    const debouncedSave = useCallback((content: Block[]) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            void saveDocument.mutate({
                id: documentId,
                name: "Untitled",
                content: content,
                lastUpdated: new Date(),
            });
        }, 1000);
    }, [documentId, saveDocument]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (theme === "system") {
            const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
            setCurrentTheme(mediaQuery.matches ? "dark" : "light");
            const handleChange = (e: MediaQueryListEvent) => {
                setCurrentTheme(e.matches ? "dark" : "light");
            };
            mediaQuery.addEventListener("change", handleChange);
            return () => {
                mediaQuery.removeEventListener("change", handleChange);
            };
        } else {
            setCurrentTheme(theme as Theme);
        }
    }, [theme]);

    // TODO: Change this to the useBlockNoteEdtitor hook
    const editor = useMemo(() => {
        return BlockNoteEditor.create({ initialContent: propInitialContent });
    }, [propInitialContent]);

    const handleChange = useCallback(() => {
        const content = editor.document;
        void saveToStorage(content);
        debouncedSave(content);
    }, [editor, debouncedSave]);

    return (
        <div>
            <BlockNoteView
                editor={editor}
                shadCNComponents={{}}
                theme={currentTheme as 'light' | 'dark'}
                onChange={handleChange}
            >
                <SuggestionMenuController
                    triggerCharacter={"@"}
                    getItems={async (query) =>
                        // Gets the mentions menu items
                        filterSuggestionItems(getAtActionMenuItems(await editor.blocksToMarkdownLossy(editor.document)), query)
                    }
                />
            </BlockNoteView>
            <ThemeToggle />
        </div >
    );
}