"use client"

import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/shadcn";
import { ThemeToggle } from "./theme-toggle";
import "./style.css";
import { useTheme } from "next-themes";
import { useEffect, useState, useCallback, useRef } from "react";
import { type Block, type PartialBlock } from "@blocknote/core";
import { useCreateBlockNote } from "@blocknote/react";
import type { WebrtcProvider } from "y-webrtc";
import type { XmlFragment } from "yjs";
import { api } from "~/trpc/react";

// Define a type for the theme
type Theme = 'light' | 'dark' | 'system';

async function saveToStorage(documentId: string, jsonBlocks: Block[]) {
    try {
        sessionStorage.setItem(`doc-${documentId}`, JSON.stringify(jsonBlocks));
    } catch (e) {
        if (e instanceof Error) {
            console.error("Failed to save to sessionStorage:", e.message);
        }
    }
}

interface EditorProps {
    initialContent: PartialBlock[];
    documentId: string;
    provider: WebrtcProvider;
    fragment: XmlFragment;
}

export default function Editor({
    initialContent: propInitialContent,
    documentId,
    provider,
    fragment,
}: EditorProps) {
    const { theme } = useTheme();
    const [currentTheme, setCurrentTheme] = useState<Theme>(theme as Theme);
    const saveDocument = api.document.saveDocument.useMutation();
    const timeoutRef = useRef<NodeJS.Timeout>();
    const hasInitialized = useRef(false);
    const [isConnected, setIsConnected] = useState(false);

    const editor = useCreateBlockNote({
        collaboration: {
            provider,
            fragment,
            user: {
                name: "My Username",
                color: "#ff0000",
            },
        },
    });

    // Wait for provider to connect before initializing content
    useEffect(() => {
        const onSync = () => {
            setIsConnected(true);
        };

        provider.on('synced', onSync);

        // If we're already connected, set connected immediately
        if (provider.connected) {
            setIsConnected(true);
        }

        return () => {
            provider.off('synced', onSync);
        };
    }, [provider]);

    // Initialize content only after connection and if document is empty
    useEffect(() => {
        if (isConnected && !hasInitialized.current && propInitialContent.length > 0) {
            // Check if the document is empty
            const currentContent = editor.document;
            const isEmptyBlock = (block: Block) =>
                'content' in block &&
                (!block.content || block.content.length === 0);

            const isEmpty = currentContent.length === 0 ||
                (currentContent.length === 1 && isEmptyBlock(currentContent[0]));

            if (isEmpty) {
                editor.replaceBlocks(editor.document, propInitialContent);
                hasInitialized.current = true;
            }
        }
    }, [editor, propInitialContent, isConnected]);

    const debouncedSave = useCallback((content: Block[]) => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            // Only save if there's actual content
            if (content.length > 0) {
                void saveDocument.mutate({
                    id: documentId,
                    name: "Untitled",
                    content: content,
                    lastUpdated: new Date(),
                });
            }
        }, 1000);
    }, [documentId, saveDocument]);

    // Cleanup timeout
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

    const handleChange = useCallback(() => {
        const content = editor.document;
        void saveToStorage(documentId, content);
        debouncedSave(content);
    }, [editor, debouncedSave, documentId]);

    return (
        <div>
            <BlockNoteView
                editor={editor}
                theme={currentTheme as 'light' | 'dark'}
                onChange={handleChange}
            />
            <ThemeToggle />
        </div>
    );
}