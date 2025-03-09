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
// import { LangChainAdapter } from "ai";
import { unified } from "unified";
import remarkParse from "remark-parse";


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

// Checks if the markdown text represents a complete thought
const isCompleteBlock = (text: string) => {
    return /[\.\!\?\n]\s*$/.test(text); // Ends with punctuation or newline
};

// Function to check if markdown is complete
const isMarkdownComplete = (markdown: string) => {
    try {
        unified().use(remarkParse).parse(markdown);
        return true; // No errors = complete markdown
    } catch (error) {
        return false; // Parsing failed = incomplete markdown
    }
};

export default function Editor({ initialContent: propInitialContent, documentId }: EditorProps) {
    const { theme } = useTheme();
    const [currentTheme, setCurrentTheme] = useState<Theme>(theme as Theme);
    const saveDocument = api.document.saveDocument.useMutation();
    const summarize = api.atActions.summarize.useMutation();
    const [streamContent, setStreamContent] = useState("");
    const timeoutRef = useRef<NodeJS.Timeout>();
    const markdownBufferRef = useRef(""); // Stores accumulated markdown chunks
    const insertedBlockIdsRef = useRef<string[]>([]); // Tracks intermediate block IDs

    const hasEnoughWords = (text: string) => {
        return text.trim().split(/\s+/).length >= 3; // Enforce minimum word count
    };

    const getAtActionMenuItems = (content: string): DefaultReactSuggestionItem[] => {
        const actions = ["summarize"];

        return actions.map((action) => ({
            title: action,
            onItemClick: async () => {
                setStreamContent(""); // Reset streaming content
                markdownBufferRef.current = ""; // Clear markdown buffer
                insertedBlockIdsRef.current = []; // Reset inserted block tracking

                const result = await summarize.mutateAsync(content);

                const stream = new ReadableStream({
                    async start(controller) {
                        for await (const text of result) {

                            console.log(text.type)

                            if (text?.type === "finish") {

                                console.log(streamContent)

                                setTimeout(() => {
                                    void replaceFinalBlocks();
                                }, 1000); // Adjust delay if needed

                                controller.close();
                                break;
                            } else if (text?.type === "text-delta") {
                                markdownBufferRef.current += text.textDelta;
                                setStreamContent((prev) => prev + text.textDelta);

                                console.log(streamContent)

                                if (hasEnoughWords(markdownBufferRef.current)) {
                                    const blocks = await editor.tryParseMarkdownToBlocks(markdownBufferRef.current);
                                    if (blocks.length > 0) {
                                        const lastBlock = editor.document[editor.document.length - 1];
                                        const insertedBlocks = editor.insertBlocks(blocks, lastBlock ? lastBlock.id : "start");

                                        // Track inserted blocks so they can be replaced later
                                        insertedBlockIdsRef.current.push(...insertedBlocks.map((b) => b.id));

                                        // Reset buffer after inserting
                                        markdownBufferRef.current = "";
                                    }
                                }

                                controller.enqueue(text.textDelta);
                            }
                        }
                    },
                });

                // console.log("Final content:", streamContent);
            },
        }));
    };

    const replaceFinalBlocks = async () => {
        if (!streamContent) return;

        const finalBlocks = await editor.tryParseMarkdownToBlocks(streamContent);
        if (finalBlocks.length > 0) {
            console.log('here')
            if (insertedBlockIdsRef.current.length > 0) {
                editor.removeBlocks(insertedBlockIdsRef.current);
            }
            editor.insertBlocks(finalBlocks, editor.document[editor.document.length - 1]?.id ?? '');
        }
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