"use client";

import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/shadcn";
import "./style.css";
import { useTheme } from "next-themes";
import { useEffect, useState, useCallback, useRef } from "react";
import {
    type Block,
    BlockNoteSchema,
    type PartialBlock,
    defaultBlockSpecs,
    filterSuggestionItems,
} from "@blocknote/core";
import {
    type DefaultReactSuggestionItem,
    SuggestionMenuController,
    useCreateBlockNote,
} from "@blocknote/react";
import { api } from "~/trpc/react";
import { atActions, generateActionsConfig, type GenerateActionConfig } from "~/app/ai/prompt/generate-actions-config";
import { Alert } from "./custom-blocks/alert";
import { GeneratePromptInput } from "./custom-blocks/generate-prompt-input";

import { createHighlighter } from "shiki";

type Theme = "light" | "dark" | "system";

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
        generatePromptInput: GeneratePromptInput,
    },
});

export default function Editor({ initialContent: propInitialContent, documentId }: EditorProps) {
    const { theme } = useTheme();
    const [currentTheme, setCurrentTheme] = useState<Theme>(theme as Theme);
    const utils = api.useUtils();
    const saveDocument = api.document.saveDocument.useMutation({
        onSuccess: () => {
            void Promise.all([
                utils.document.getDocumentById.invalidate(documentId),
                utils.document.getDocumentIdsForAuthenticatedUser.invalidate(),
            ]);
        },
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
                    const buffer = { current: "", prev: "" };
                    let blocks: Awaited<ReturnType<typeof editor.tryParseMarkdownToBlocks>> = [];

                    for await (const token of result) {
                        console.log(token);
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
                        } else {
                            editor.replaceBlocks(blocks.map(block => block.id), blocksToAdd);
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

    const getGenerateActionSuggestions = (): GenerateActionConfig[] => {
        return atActions.map((action) => {
            const config = generateActionsConfig[action];
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
            };
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
            const newTheme = mediaQuery.matches ? "dark" : "light";
            setCurrentTheme(newTheme);
            console.log("Theme changed to:", newTheme);
            const handleChange = (e: MediaQueryListEvent) => {
                const newTheme = e.matches ? "dark" : "light";
                setCurrentTheme(newTheme);
                console.log("Theme changed to:", newTheme);
            };
            mediaQuery.addEventListener("change", handleChange);
            return () => {
                mediaQuery.removeEventListener("change", handleChange);
            };
        } else {
            setCurrentTheme(theme as Theme);
            console.log("Theme changed to:", theme);
        }
    }, [theme]);

    const editor = useCreateBlockNote({
        schema,
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
        ...(propInitialContent?.length ? { initialContent: propInitialContent } : {}),
    }, [currentTheme]);

    const handleChange = useCallback(() => {
        const content = editor.document as Block[];
        void saveToStorage(content);
        debouncedSave(content);
    }, [editor, debouncedSave]);

    // Add keyboard shortcut handler for Cmd/Ctrl + /
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Check if Cmd (Mac) or Ctrl (Windows/Linux) + / is pressed
            if ((event.metaKey || event.ctrlKey) && event.key === "/") {
                event.preventDefault();
                
                // Get current cursor position
                const cursorPosition = editor.getTextCursorPosition();
                const currentBlockId = cursorPosition.block.id;
                
                // Insert error block after current block
                editor.insertBlocks(
                    [
                        {
                            type: "generatePromptInput",
                            props: {
                                    placeholder: "Enter your prompt here...",
                                    buttonText: "Generate",
                                    getGenerateActionSuggestions: getGenerateActionSuggestions(),
                            },
                        },
                    ],
                    currentBlockId
                );
            }
        };

        // Add event listener to the document
        document.addEventListener("keydown", handleKeyDown);
        
        // Cleanup
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [editor]);

    return (
        <BlockNoteView
            editor={editor}
            shadCNComponents={{}}
            theme={currentTheme as 'light' | 'dark'}
            onChange={handleChange}
        >
            {/* <SuggestionMenuController
                triggerCharacter={"@"}
                getItems={async (query) =>
                    filterSuggestionItems(getGenerateActionSuggestions(), query)
                }
            /> */}
        </BlockNoteView>
    );
}
