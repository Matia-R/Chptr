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
        insertBlocksFn: (
            editor: typeof schema.BlockNoteEditor,
            markdown: string,
            insertBlockId: string
        ) => Promise<void>
    ) => {
        const buffer = { current: "" };
        let currentListType: "bullet" | "numbered" | null = null;

        const flushLineAsBlock = async (line: string) => {
            if (!line.trim()) return;

            // Check for tool call inline (assuming tool calls are serialized JSON prefixed with [[tool:)
            if (line.startsWith("[[tool:")) {
                console.log("tool call", line);
                const jsonStart = line.indexOf("{");
                const jsonEnd = line.lastIndexOf("}");
                if (jsonStart !== -1 && jsonEnd !== -1) {
                    const json = line.slice(jsonStart, jsonEnd + 1);
                    console.log("json", json);
                    const tool = JSON.parse(json);
                    console.log("tool", tool);
                    if (tool.tool_call === "addTableBlock") {
                        // INSERT_YOUR_CODE
                        // Convert the 2d array of rows into a markdown table string
                        const rows = tool.args.rows;
                        if (Array.isArray(rows) && rows.length > 0) {
                            // Build header row
                            const header = rows[0].map(cell => String(cell)).join(" | ");
                            // Build separator row
                            const separator = rows[0].map(() => "---").join(" | ");
                            // Build data rows
                            const dataRows = rows.slice(1).map(row => row.map(cell => String(cell)).join(" | "));
                            // Combine all parts
                            const markdownTable = [
                                `| ${header} |`,
                                `| ${separator} |`,
                                ...dataRows.map(row => `| ${row} |`)
                            ].join("\n");
                            // Insert as markdown block(s)
                            await insertBlocksFn(editor, markdownTable, insertBlockId);
                        }

                        // const tableBlock = {
                        //     type: "table",
                        //     id: insertBlockId + "-table",
                        //     content: {
                        //         type: "tableContent",
                        //         rows: {
                        //             cells: tool.args.rows,
                        //         },
                        //     }
                        // };
                        // editor.insertBlocks([tableBlock], insertBlockId);
                    }
                    return;
                }
            }

            let blockMarkdown = "";

            // Headings
            if (/^#{1,6}\s/.test(line)) {
                blockMarkdown = line;
            }
            // Numbered list
            else if (/^\d+\.\s/.test(line)) {
                if (currentListType !== "numbered") {
                    currentListType = "numbered";
                }
                blockMarkdown = line;
            }
            // Bullet list
            else if (/^[-*+]\s/.test(line)) {
                if (currentListType !== "bullet") {
                    currentListType = "bullet";
                }
                blockMarkdown = line;
            }
            // Paragraph
            else {
                currentListType = null;
                blockMarkdown = line;
            }

            await insertBlocksFn(editor, blockMarkdown.trim(), insertBlockId);
        };

        const tryFlushBuffer = async () => {
            const lines = buffer.current.split("\n");

            for (let i = 0; i < lines.length - 1; i++) {
                const line = lines[i];
                await flushLineAsBlock(line!);
            }

            buffer.current = lines.at(-1) ?? "";
        };

        return new ReadableStream({
            async start(controller) {
                try {
                    for await (const token of result) {
                        controller.enqueue(token);
                        buffer.current += token;

                        if (token.includes("\n")) {
                            await tryFlushBuffer();
                        }
                    }

                    if (buffer.current.trim()) {
                        await flushLineAsBlock(buffer.current);
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