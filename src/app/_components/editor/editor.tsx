"use client"

import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/shadcn";
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
    const utils = api.useUtils();
    const saveDocument = api.document.saveDocument.useMutation({
        onSuccess: () => {
            // Invalidate both the document and the document list queries
            void Promise.all([
                utils.document.getDocumentById.invalidate(documentId),
                utils.document.getDocumentIdsForAuthenticatedUser.invalidate()
            ]);
        }
    });
    const generate = api.atActions.generate.useMutation();
    const timeoutRef = useRef<NodeJS.Timeout>();

    const streamMarkdownToEditor = async (
        result: AsyncIterable<string>,
        editor: typeof schema.BlockNoteEditor,
        insertBlockId: string,
    ) => {
        return new ReadableStream({
            async start(controller) {
                try {
                    let buffer = { current: '', prev: '' };
                    let blocks: any[] = [];
                    for await (const token of result) {
                        controller.enqueue(token);
                        buffer.current += token;

                        // Skip if current buffer (whitespace removed) is the same as previous
                        const currentTrimmed = buffer.current.trim();
                        const prevTrimmed = buffer.prev.trim();
                        if (currentTrimmed === prevTrimmed) {
                            continue;
                        }

                        const blocksToAdd = await editor.tryParseMarkdownToBlocks(buffer.current);
                        if (blocks.length === 0) {
                            editor.insertBlocks(blocksToAdd, insertBlockId);
                        }
                        else {
                            editor.replaceBlocks(blocks.map(block => block.id!), blocksToAdd);
                        }
                        blocks = blocksToAdd;
                        buffer.prev = buffer.current;
                    }

                    controller.close();
                } catch (error) {
                    editor.insertBlocks(
                        [
                            {
                                type: "alert",
                                props: {
                                    type: "error",
                                    text: "Something went wrong while generating the content.",
                                },
                            },
                        ],
                        insertBlockId
                    );

                    if (error instanceof Error) {
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

                    await streamMarkdownToEditor(result, editor, insertBlockId);
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
                content: content,
                lastUpdated: new Date(Date.now()),
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
        ...(propInitialContent?.length ? { initialContent: propInitialContent } : {}),
    });

    const handleChange = useCallback(() => {
        const content = editor.document as Block[];
        void saveToStorage(content);
        debouncedSave(content);
    }, [editor, debouncedSave]);

    return (
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
    );
}