"use client"

import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/shadcn";
import { ThemeToggle } from "../theme-toggle";
import "./style.css";
import { useTheme } from "next-themes";
import { useEffect, useState, useCallback, useRef } from "react";
import { type Block, type BlockNoteEditor, BlockNoteSchema, type PartialBlock, defaultBlockSpecs, filterSuggestionItems, } from "@blocknote/core";
import { type DefaultReactSuggestionItem, SuggestionMenuController, useCreateBlockNote } from "@blocknote/react";
import { api } from "~/trpc/react";
import { atActions, atActionsConfig } from "~/app/ai/prompt/at-actions";
import { Alert } from "./custom-blocks/Alert";


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

const schema = BlockNoteSchema.create({
    blockSpecs: {
        ...defaultBlockSpecs,
        alert: Alert,
    },
});

export default function Editor({ initialContent: propInitialContent, documentId }: EditorProps) {
    const { theme } = useTheme();
    const [currentTheme, setCurrentTheme] = useState<Theme>(theme as Theme);
    const saveDocument = api.document.saveDocument.useMutation();
    const generate = api.atActions.generate.useMutation();
    const timeoutRef = useRef<NodeJS.Timeout>();

    const insertParsedMarkdownBlocks = async (
        editor: typeof schema.BlockNoteEditor,
        markdown: string,
        insertBlockId: string
    ) => {
        const blocks = await editor.tryParseMarkdownToBlocks(markdown);
        if (blocks.length > 0) {
            editor.insertBlocks(blocks, insertBlockId);
        }
    }

    const streamMarkdownToEditor = async (
        result: AsyncIterable<string>,
        editor: typeof schema.BlockNoteEditor,
        insertBlockId: string,
        insertBlocksFn: (editor: typeof schema.BlockNoteEditor, markdown: string, insertBlockId: string) => Promise<void>
    ) => {
        const markdownBuffer = { current: "" }; // Stores accumulated markdown chunks
        let isInCodeBlock = false;
        let isInNumberedList = false;
        let isInNonNumberedList = false;

        return new ReadableStream({
            async start(controller) {
                try {
                    for await (const text of result) {
                        controller.enqueue(text);

                        if (text.includes('<table-tag>')) {
                            markdownBuffer.current += text.replace('<table-tag>', '');
                            continue;
                        }

                        isInNonNumberedList = /^\s*[*-]/.test(text);
                        if (isInNonNumberedList) {
                            markdownBuffer.current += text;
                            continue;
                        }

                        const codeBlockMarkerCount = (text.match(/```/g) ?? []).length;
                        const numberedListMarkerCount = (text.match(/<numbered-list-tag>/g) ?? []).length;

                        if (numberedListMarkerCount === 1) {
                            isInNumberedList = !isInNumberedList;
                        }

                        if (codeBlockMarkerCount === 1) {
                            isInCodeBlock = !isInCodeBlock;
                        }

                        markdownBuffer.current += text
                            .replace('<numbered-list-tag>', '')
                            .replace(/^\s{2,}(?=\d+\.)/, ' ')
                            .replace('bash', 'text');

                        if (isInCodeBlock || isInNumberedList) continue;

                        await insertBlocksFn(editor, markdownBuffer.current, insertBlockId);
                        markdownBuffer.current = "";
                    }

                    controller.close();

                    if (markdownBuffer.current) {
                        await insertBlocksFn(editor, markdownBuffer.current, insertBlockId);
                    }

                } catch (error) {

                    // TODO: Add option for buttons with callbacks - add callback to retry
                    editor.insertBlocks([{
                        type: "alert",
                        props: {
                            type: "error",
                            text: "Something went wrong while generating the content.",
                        },
                    }], insertBlockId);

                    if (error instanceof Error) {
                        // TODO: log error once we have analytics
                        console.error("Error processing stream:", error.message);
                    }

                }
            },
        });
    };


    const getAtActionMenuItems = (): DefaultReactSuggestionItem[] => {
        return atActions.map((action) => {
            const config = atActionsConfig[action]
            return {
                ...config,
                onItemClick: async () => {
                    const insertBlockId = editor.getTextCursorPosition().block.id;

                    const blocks = editor.document;
                    const contentUpToBlock = blocks.slice(0, blocks.findIndex(block => block.id === insertBlockId) + 1);
                    const contentToProcess = await editor.blocksToMarkdownLossy(contentUpToBlock);

                    const result = await generate.mutateAsync({
                        action,
                        content: contentToProcess
                    });

                    await streamMarkdownToEditor(result, editor, insertBlockId, insertParsedMarkdownBlocks);
                },
            }
        });
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

    const editor = useCreateBlockNote({
        schema,
        initialContent: propInitialContent,
    });

    const handleChange = useCallback(() => {
        const content = editor.document as Block[];
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
            {/* <ThemeToggle /> */}
        </div >
    );
}