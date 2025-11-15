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
} from "@blocknote/core";
import {
    useCreateBlockNote,
} from "@blocknote/react";
import { api } from "~/trpc/react";
import { Alert } from "./custom-blocks/alert";
import { GeneratePromptInput } from "./custom-blocks/generate-prompt-input";

import { createHighlighter } from "shiki";
import { useGenerateStore, GenerateState } from "~/hooks/use-generate-store";

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

    const generateForPrompt = api.atActions.generateForPrompt.useMutation();
    const generateForFollowUp = api.atActions.generateForFollowUp.useMutation();
    const timeoutRef = useRef<NodeJS.Timeout>();
    const { prompts, state, generateBlockPosition } = useGenerateStore();
    const setState = useGenerateStore((state) => state.setState);
    const setGeneratedBlockIds = useGenerateStore((state) => state.setGeneratedBlockIds);
    const setGenerateBlockPosition = useGenerateStore((state) => state.setGenerateBlockPosition);
    // const setGenerateBlockPosition = useGenerateStore((state) => state.setGenerateBlockPosition);
    // const [generateBlockPosition, setGenerateBlockPosition] = useState<string>('');

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

    // Detect undo/redo operations involving generatePromptInput blocks
    useEffect(() => {
        if (!editor) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const handleEditorChange = (editor: typeof schema.BlockNoteEditor, { getChanges }: { getChanges: () => any[] }) => {
            const changes = getChanges();
            const storeState = useGenerateStore.getState();

            console.log('changes', changes);
            
            // Only process undo/redo operations
            const undoRedoChanges = changes.filter(change => 
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                change.source.type === "undo" || change.source.type === "redo" || change.source.type === "undo-redo"
            );
            
            if (undoRedoChanges.length === 0) return;
            
            // Check if undo/redo involves generatePromptInput blocks
            let hasGeneratePromptInput = false;
            let hasGeneratedBlocks = false;

            console.log('undoRedoChanges', undoRedoChanges);
            
            for (const change of undoRedoChanges) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (change.block.type === "generatePromptInput") {
                    hasGeneratePromptInput = true;
                }
                // Check if this is a previously generated block being restored
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
                if (storeState.generatedBlockIds.includes(change.block.id)) {
                    hasGeneratedBlocks = true;
                }
            }
            
            // If undo/redo involves our blocks and state is still accepted/rejected, reset to GeneratedResponse
            if ((hasGeneratePromptInput || hasGeneratedBlocks) && 
                (storeState.state === GenerateState.AcceptedResponse || storeState.state === GenerateState.RejectedResponse)) {
                // Reset state to GeneratedResponse to allow follow-ups
                useGenerateStore.getState().setState(GenerateState.GeneratedResponse);
            }
        };

        const unsubscribe = editor.onChange(handleEditorChange);
        return unsubscribe;
    }, [editor]);

    const prevPromptsLengthRef = useRef<number>(0);

    useEffect(() => {
        // Check if we have new prompts and are in generating state
        if (prompts.length === 0 || prevPromptsLengthRef.current === prompts.length || state !== GenerateState.Generating) return;
        
        prevPromptsLengthRef.current = prompts.length;
        const currentPrompt = prompts[prompts.length - 1]!; // Get the latest prompt
        const isFollowUp = prompts.length > 1;

        const handleGeneratePromptSubmitted = async (
            promptToUse: string,
            editor: typeof schema.BlockNoteEditor
        ) => {
            const insertBlockId = generateBlockPosition;

            let lastGeneratedContent = "";
            
            // If this is a follow-up, capture the last generated content before removing blocks
            if (isFollowUp) {
                const { generatedBlockIds } = useGenerateStore.getState();
                if (generatedBlockIds.length > 0) {
                    // Get the markdown content of the generated blocks before removing them
                    const generatedBlocks = generatedBlockIds
                        .map(id => editor.getBlock(id))
                        .filter((block): block is NonNullable<typeof block> => block !== null);
                    lastGeneratedContent = await editor.blocksToMarkdownLossy(generatedBlocks);
                    
                    editor.transact(() => {
                        editor.removeBlocks(generatedBlockIds);
                    });
                    useGenerateStore.getState().setGeneratedBlockIds([]);
                }
            }

            const blocks = editor.document;
            const contentUpToBlock = blocks.slice(
                0,
                blocks.findIndex((block) => block.id === insertBlockId) + 1
            );
            const contentToProcess = await editor.blocksToMarkdownLossy(contentUpToBlock);

            // Use the appropriate route based on whether it's a follow-up
            const result = isFollowUp 
                ? await generateForFollowUp.mutateAsync({
                    initialPrompt: prompts[0]!,
                    followUp: currentPrompt,
                    lastGeneratedContent,
                    content: contentToProcess,
                })
                : await generateForPrompt.mutateAsync({
                    prompt: promptToUse,
                    content: contentToProcess,
                });

            const streamMarkdownToEditor = async (
                result: AsyncIterable<string>,
                editor: typeof schema.BlockNoteEditor,
                insertBlockId: string
              ) => {
                const buffer = { current: "", prev: "" };
                let blocks: Awaited<ReturnType<typeof editor.tryParseMarkdownToBlocks>> = [];
                
                for await (const token of result) {
                  buffer.current += token;
              
                  const currentTrimmed = buffer.current.trim();
                  const prevTrimmed = buffer.prev.trim();
                  if (currentTrimmed === prevTrimmed) continue;
              
                  const blocksToAdd = (await editor.tryParseMarkdownToBlocks(buffer.current)).map(block => ({
                    ...block,
                    props: { ...block.props, textColor: "default" }
                  })) as Block[];
                  
                  editor.transact((transaction) => {
                    transaction.setMeta('addToHistory', false);
                    if (blocks.length === 0) {
                        editor.insertBlocks(blocksToAdd, insertBlockId, 'after');
                      } else {
                        editor.replaceBlocks(
                            blocks.map((block) => block.id),
                            blocksToAdd
                        );
                      }
                  });
              
                  blocks = blocksToAdd;
                  buffer.prev = buffer.current;
                }
                editor.transact((transaction) => {
                    transaction.setMeta('addToHistory', false);
                    editor.removeBlocks(blocks.map((block) => block.id));
                });
                
                editor.transact(() => {
                    editor.insertBlocks([], insertBlockId);
                    editor.insertBlocks(blocks, insertBlockId, 'after');

                    if (generateBlockPosition) {
                        const { insertedBlocks } = editor.replaceBlocks([generateBlockPosition], [{
                            type: "generatePromptInput",
                            props: {},
                        }]);
                        // set new generate block position here
                        setGenerateBlockPosition(insertedBlocks[0]!.id);
                    }
                });

                // Set the generated block IDs in the store
                const generatedBlockIds = blocks.map((block) => block.id);
                setGeneratedBlockIds(generatedBlockIds);
            };

            await streamMarkdownToEditor(result, editor, insertBlockId);
            setState(GenerateState.GeneratedResponse);
        };

        void handleGeneratePromptSubmitted(currentPrompt, editor);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prompts, editor, generateForPrompt, generateForFollowUp]);

    // Handle accept or reject response
    useEffect(() => {

        // const resetGenerateStore = () => {
        //     useGenerateStore.getState().setGeneratedBlockIds([]);
        //     useGenerateStore.getState().setState(GenerateState.AwaitingPrompt);
        //     useGenerateStore.getState().setPrompt(null);
        // }

        const unsub = useGenerateStore.subscribe((s) => {
          if (!editor) return;
      
          if (s.state === GenerateState.RejectedResponse && s.generatedBlockIds.length > 0) {
            editor.transact(() => {
              editor.removeBlocks([...s.generatedBlockIds, s.generateBlockPosition]);
              console.log('removing blocks')
            });
            // resetGenerateStore();
          }
      
          if (s.state === GenerateState.AcceptedResponse && s.generatedBlockIds.length > 0) {
            editor.removeBlocks([s.generateBlockPosition]);
            // resetGenerateStore();
          }
        });
      
        return () => unsub();
      }, [editor]);
      

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

                const resetGenerateStore = () => {
                    useGenerateStore.getState().setGeneratedBlockIds([]);
                    useGenerateStore.getState().setState(GenerateState.AwaitingPrompt);
                    useGenerateStore.getState().setPrompts([]);
                }
                
                // Check if a generatePromptInput block already exists
                const existingPromptBlocks = editor.document.filter(block => 
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
                    (block as any).type === "generatePromptInput"
                );
                if (existingPromptBlocks.length > 0) {
                    // Don't add another one if one already exists
                    return;
                }

                // Get current cursor position
                const cursorPosition = editor.getTextCursorPosition();
                const currentBlockId = cursorPosition.block.id;
                
                // Insert generatePromptInput block after current block
                const generatePromptInputBlock = editor.insertBlocks(
                    [
                        {
                            type: "generatePromptInput",
                            props: {},
                        },
                    ],
                    currentBlockId
                );

                resetGenerateStore();

                setGenerateBlockPosition(generatePromptInputBlock[0]!.id);
            }
        };

        // Add event listener to the document
        document.addEventListener("keydown", handleKeyDown);
        
        // Cleanup
        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [editor, setGenerateBlockPosition]);

    return (
        <BlockNoteView
            editor={editor}
            shadCNComponents={{}}
            theme={currentTheme as 'light' | 'dark'}
            onChange={handleChange}
        >
        </BlockNoteView>
    );
}
