"use client";

import { useEffect, useRef } from "react";
import type { BlockNoteEditor } from "@blocknote/core";
import { usePromptStore, STREAM_END_MARKER } from "~/hooks/use-prompt-store";

interface StreamingState {
    blockIds: string[];
    buffer: string;
    prevBuffer: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useStreamToEditor(editor: BlockNoteEditor<any> | null) {
    const streamTokens = usePromptStore((state) => state.streamTokens);
    const streamTokensRef = useRef<Record<string, string[]>>({});
    const wasStreamingRef = useRef<Record<string, boolean>>({});
    const streamingBlocksRef = useRef<Record<string, StreamingState>>({});
    const completedStreamsRef = useRef<Record<string, number>>({}); // Track token count when stream completed

    useEffect(() => {
        if (!editor) return;

        // Process each storeId for new tokens
        void (async () => {
            for (const storeId of Object.keys(streamTokens)) {
                const currentTokens = streamTokens[storeId] ?? [];
                const previousTokens = streamTokensRef.current[storeId] ?? [];
                const hasNewTokens = currentTokens.length > previousTokens.length;
                
                // Detect when stream is done: check if the last token is the end marker
                if (hasNewTokens && currentTokens.length > 0) {
                    const lastToken = currentTokens[currentTokens.length - 1];
                    const completedTokenCount = completedStreamsRef.current[storeId];
                    
                    // Only process completion if we haven't already processed it for this token count
                    if (lastToken === STREAM_END_MARKER && completedTokenCount !== currentTokens.length) {
                        console.log("Stream Done!");
                        delete wasStreamingRef.current[storeId];
                        // Mark that we've processed completion for this token count
                        completedStreamsRef.current[storeId] = currentTokens.length;
                        // Update ref to exclude the marker token
                        const tokensWithoutMarker = currentTokens.slice(0, -1);
                        streamTokensRef.current[storeId] = [...tokensWithoutMarker];
                        continue;
                    }
                }

                // If there are new tokens, process them
                if (hasNewTokens) {
                    // Mark that we're streaming
                    wasStreamingRef.current[storeId] = true;
                    
                    // Find the aiPromptInput block with this promptStoreId
                    const promptBlock = editor.document.find(
                        (block) => 
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
                            (block as any).type === "aiPromptInput" && 
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
                            (block as any).props?.promptStoreId === storeId
                    );

                    if (!promptBlock) {
                        // Update ref even if block not found to avoid reprocessing
                        streamTokensRef.current[storeId] = [...currentTokens];
                        continue;
                    }

                    // Get the accumulated markdown from all tokens (excluding the marker if present)
                    const tokensForMarkdown = currentTokens.filter(token => token !== STREAM_END_MARKER);
                    const accumulatedMarkdown = tokensForMarkdown.join("");
                    
                    // Get or initialize streaming state for this storeId
                    let streamingState = streamingBlocksRef.current[storeId];
                    if (!streamingState) {
                        streamingState = {
                            blockIds: [],
                            buffer: "",
                            prevBuffer: "",
                        };
                        streamingBlocksRef.current[storeId] = streamingState;
                    }

                    // Update buffer
                    streamingState.buffer = accumulatedMarkdown;

                    // Skip if current buffer (whitespace removed) is the same as previous
                    const currentTrimmed = streamingState.buffer.trim();
                    const prevTrimmed = streamingState.prevBuffer.trim();
                    if (currentTrimmed === prevTrimmed) {
                        // Update ref to track what we've seen
                        streamTokensRef.current[storeId] = [...currentTokens];
                        continue;
                    }

                    try {
                        // Parse markdown to blocks
                        const blocksToAdd = await editor.tryParseMarkdownToBlocks(streamingState.buffer);
                        
                        if (blocksToAdd.length > 0) {
                            if (streamingState.blockIds.length === 0) {
                                // First time: insert blocks after the prompt block
                                editor.insertBlocks(blocksToAdd, promptBlock.id);
                                streamingState.blockIds = blocksToAdd.map(block => block.id);
                            } else {
                                // Update existing blocks
                                editor.replaceBlocks(streamingState.blockIds, blocksToAdd);
                                streamingState.blockIds = blocksToAdd.map(block => block.id);
                            }
                        }
                        
                        streamingState.prevBuffer = streamingState.buffer;
                    } catch (error) {
                        if (error instanceof Error) {
                            console.error("Error parsing markdown to blocks:", error.message);
                        }
                    }
                }
                
                // Update ref to track what we've seen (store a copy of the array)
                streamTokensRef.current[storeId] = [...currentTokens];
            }
        })();
    }, [streamTokens, editor]);
    
    // Clean up completed streams tracking when tokens are cleared (new generation starts)
    useEffect(() => {
        for (const storeId of Object.keys(streamTokens)) {
            const currentTokens = streamTokens[storeId] ?? [];
            // If tokens were cleared (went from having tokens to empty), reset completion tracking
            if (currentTokens.length === 0 && completedStreamsRef.current[storeId] !== undefined) {
                delete completedStreamsRef.current[storeId];
            }
        }
    }, [streamTokens]);
}

