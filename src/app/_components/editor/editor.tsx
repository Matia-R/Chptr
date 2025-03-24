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
    const [streamContent, setStreamContent] = useState("");
    const timeoutRef = useRef<NodeJS.Timeout>();
    const markdownBufferRef = useRef(""); // Stores accumulated markdown chunks
    const insertedBlockIdsRef = useRef<string[]>([]); // Tracks intermediate block IDs

    const getAtActionMenuItems = (content: string): DefaultReactSuggestionItem[] => {
        const actions = ["summarize"];

        return actions.map((action) => ({
            title: action,
            onItemClick: async () => {
                setStreamContent(""); // Reset streaming content
                markdownBufferRef.current = ""; // Clear markdown buffer
                insertedBlockIdsRef.current = []; // Reset inserted block tracking
                let isInCodeBlock = false;

                const result = await summarize.mutateAsync(content);

                new ReadableStream({
                    async start(controller) {
                        try {
                            for await (const text of result) {

                                controller.enqueue(text);
                                setStreamContent(prev => prev + text);

                                if (text.includes('<table-tag>')) {
                                    markdownBufferRef.current += text.replace('<table-tag>', '');
                                    continue;
                                }

                                // Count occurrences of code block markers in the current text chunk
                                const codeBlockMarkerCount = (text.match(/```/g) ?? []).length;

                                // Handle code blocks
                                if (codeBlockMarkerCount === 1) {
                                    isInCodeBlock = !isInCodeBlock;
                                    markdownBufferRef.current += text;
                                    continue;
                                }

                                // If we're in a code block, accumulate text
                                if (isInCodeBlock) {
                                    markdownBufferRef.current += text;
                                    continue;
                                }

                                // Accumulate regular markdown in buffer
                                markdownBufferRef.current += text

                                // Only try to parse if we're not in a code block
                                if (!isInCodeBlock) {

                                    let blocks = []

                                    if (markdownBufferRef.current.includes('```')) {
                                        blocks.push(manuallyParseCodeMarkdownToBlocks(markdownBufferRef.current));
                                    }
                                    else blocks = await editor.tryParseMarkdownToBlocks(markdownBufferRef.current);

                                    // const blocks = await editor.tryParseMarkdownToBlocks(markdownBufferRef.current);
                                    if (blocks.length > 0) {
                                        const insertAfterBlockId = editor.document[editor.document.length - 1]?.id ?? '';
                                        editor.insertBlocks(blocks, insertAfterBlockId);
                                        insertedBlockIdsRef.current.push(...blocks.map(b => b.id));
                                        markdownBufferRef.current = "";
                                    }
                                }
                            }

                            controller.close();

                            // Parse any remaining content in the buffer
                            if (markdownBufferRef.current) {
                                const finalBlocks = await editor.tryParseMarkdownToBlocks(markdownBufferRef.current);
                                if (finalBlocks.length > 0) {
                                    const insertAfterBlockId = editor.document[editor.document.length - 1]?.id ?? '';
                                    editor.insertBlocks(finalBlocks, insertAfterBlockId);
                                    markdownBufferRef.current = "";
                                }
                            }
                        } catch (error) {
                            if (error instanceof Error) {
                                console.log(error.stack);
                                console.log(markdownBufferRef.current)
                                console.error("Error processing stream:", error.message);
                            }
                        }
                    },
                });

                console.log("Final content:", streamContent);
            },
        }));
    };

    const manuallyParseCodeMarkdownToBlocks = (markdownText: string): Block => {
        const language = markdownText.split('\n')[0]?.replace('```', '').trim() ?? 'default';
        const code = markdownText.replaceAll('```', '').split('\n').slice(1).join('\n').trim();

        return {
            id: crypto.randomUUID(),
            type: "codeBlock",
            props: {
                language
            },
            content: [{
                type: "text",
                text: code,
                styles: {}
            }],
            children: []
        };
    };

    // const replaceFinalBlocks = async () => {
    //     if (!streamContent) return;

    //     const finalBlocks = await editor.tryParseMarkdownToBlocks(streamContent);
    //     if (finalBlocks.length > 0) {
    //         console.log('here')
    //         if (insertedBlockIdsRef.current.length > 0) {
    //             editor.removeBlocks(insertedBlockIdsRef.current);
    //         }
    //         editor.insertBlocks(finalBlocks, editor.document[editor.document.length - 1]?.id ?? '');
    //     }
    // };

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