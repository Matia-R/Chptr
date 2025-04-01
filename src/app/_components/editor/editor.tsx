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
    const timeoutRef = useRef<NodeJS.Timeout>();
    const markdownBufferRef = useRef(""); // Stores accumulated markdown chunks
    const insertedBlockIdsRef = useRef<string[]>([]); // Tracks intermediate block IDs

    const getAtActionMenuItems = (): DefaultReactSuggestionItem[] => {
        const actions = ["summarize"];

        return actions.map((action) => ({
            title: action,
            onItemClick: async () => {

                const insertBlockId = editor.getTextCursorPosition().block.id;

                markdownBufferRef.current = ""; // Clear markdown buffer
                insertedBlockIdsRef.current = []; // Reset inserted block tracking
                let isInCodeBlock = false;
                let isInNumberedList = false;
                let isInNonNumberedList = false;

                const blocks = editor.document;
                const contentUpToBlock = blocks.slice(0, blocks.findIndex(block => block.id === insertBlockId) + 1);
                const contentToSummarize = await editor.blocksToMarkdownLossy(contentUpToBlock);

                const result = await summarize.mutateAsync(contentToSummarize);

                new ReadableStream({
                    async start(controller) {
                        try {
                            for await (const text of result) {

                                controller.enqueue(text);

                                if (text.includes('<table-tag>')) {
                                    markdownBufferRef.current += text.replace('<table-tag>', '');
                                    continue;
                                }

                                isInNonNumberedList = /^\s*[*-]/.test(text);

                                if (isInNonNumberedList) {
                                    markdownBufferRef.current += text
                                    continue;
                                }

                                // Count occurrences of code block markers in the current text chunk
                                const codeBlockMarkerCount = (text.match(/```/g) ?? []).length;
                                const numberedListMarkerCount = (text.match(/<numbered-list-tag>/g) ?? []).length;

                                if (numberedListMarkerCount === 1) {
                                    isInNumberedList = !isInNumberedList;
                                }

                                // Handle code blocks
                                if (codeBlockMarkerCount === 1) {
                                    isInCodeBlock = !isInCodeBlock;
                                }

                                markdownBufferRef.current += text.replace('<numbered-list-tag>', '').replace(/^\s{2,}(?=\d+\.)/, ' ').replace('bash', 'text');

                                if (isInCodeBlock || isInNumberedList) {
                                    continue;
                                }

                                // Only try to parse if we're not in a code block
                                if (!isInCodeBlock && !isInNumberedList) {

                                    const blocks = await editor.tryParseMarkdownToBlocks(markdownBufferRef.current);

                                    // const blocks = await editor.tryParseMarkdownToBlocks(markdownBufferRef.current);
                                    if (blocks.length > 0) {

                                        // TODO: Manually parse / add checkboxes

                                        // const insertAfterBlockId = editor.document[editor.document.length - 1]?.id ?? '';
                                        // editor.insertBlocks(blocks, insertAfterBlockId);
                                        editor.insertBlocks(blocks, insertBlockId);
                                        insertedBlockIdsRef.current.push(...blocks.map(b => b.id));
                                        markdownBufferRef.current = "";
                                    }
                                }
                            }

                            controller.close();

                            // TODO: check if this is needed
                            // Extract into function with above logic if it is
                            // Parse any remaining content in the buffer
                            if (markdownBufferRef.current) {
                                const finalBlocks = await editor.tryParseMarkdownToBlocks(markdownBufferRef.current);
                                if (finalBlocks.length > 0) {
                                    // const insertAfterBlockId = editor.document[editor.document.length - 1]?.id ?? '';
                                    // editor.insertBlocks(finalBlocks, insertAfterBlockId);
                                    editor.insertBlocks(finalBlocks, insertBlockId);
                                    markdownBufferRef.current = "";
                                }
                            }
                        } catch (error) {

                            // TODO: add a custom error block here if stream fails
                            if (error instanceof Error) {
                                console.log(error.stack);
                                console.log(markdownBufferRef.current)
                                console.error("Error processing stream:", error.message);
                            }
                        }
                    },
                });
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
                        filterSuggestionItems(getAtActionMenuItems(), query)
                    }
                />
            </BlockNoteView>
            <ThemeToggle />
        </div >
    );
}