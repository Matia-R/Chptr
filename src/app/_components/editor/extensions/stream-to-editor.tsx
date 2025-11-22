"use client";

import { useEffect, useRef } from "react";
import type { BlockNoteEditor } from "@blocknote/core";
import { usePromptStore, STREAM_END_MARKER } from "~/hooks/use-prompt-store";

interface StreamingState {
  buffer: string;
  prevBuffer: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useStreamToEditor(editor: BlockNoteEditor<any> | null) {
  const streamTokensRef = useRef<Record<string, string[]>>({});
  const streamingStateRef = useRef<Record<string, StreamingState>>({});
  const pendingUpdatesRef = useRef<Record<string, { blockId: string; children: any[] }>>({});
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!editor) return;

    // Helper: apply pending editor updates in one RAF batch
    const scheduleApplyUpdates = () => {
      if (rafRef.current !== null) return;

      rafRef.current = requestAnimationFrame(() => {
        for (const update of Object.values(pendingUpdatesRef.current)) {
          try {
            editor.updateBlock(update.blockId, {
              children: update.children,
            });
          } catch (err) {
            console.error("Error updating block:", err);
          }
        }

        pendingUpdatesRef.current = {};
        rafRef.current = null;
      });
    };

    // Core processing logic
    const processStoreId = async (storeId: string, tokens: string[]) => {
      // Find the aiPromptInput block ONCE.
      const promptBlock = editor.document.find(
        (block) => (block as any).type === "aiPromptInput" &&
        (block as any).props?.promptStoreId === storeId
      );

      if (!promptBlock) {
        streamTokensRef.current[storeId] = tokens;
        return;
      }

      const prevTokens = streamTokensRef.current[storeId] ?? [];
      const isSameLength = tokens.length === prevTokens.length;

      // Handle clearing case
      if (tokens.length === 0 && prevTokens.length > 0) {
        editor.updateBlock(promptBlock.id, { children: [] });
        delete streamingStateRef.current[storeId];
        streamTokensRef.current[storeId] = [];
        return;
      }

      // Handle stream end marker
      const last = tokens[tokens.length - 1];
      const tokensWithoutMarker =
        last === STREAM_END_MARKER ? tokens.slice(0, -1) : tokens;

      // Skip if no length change (unless stream finished)
      if (isSameLength && last !== STREAM_END_MARKER) {
        return;
      }

      // Accumulate markdown
      const md = tokensWithoutMarker.join("");

      // Tracking previous markdown buffer
      let state = streamingStateRef.current[storeId];
      if (!state) {
        state = streamingStateRef.current[storeId] = {
          buffer: "",
          prevBuffer: "",
        };
      }

      if (md === state.prevBuffer) {
        streamTokensRef.current[storeId] = tokens;
        return;
      }

      state.buffer = md;

      // Parse → blocks
      const blocks = await editor.tryParseMarkdownToBlocks(md);

      // Queue editor update
      pendingUpdatesRef.current[storeId] = {
        blockId: promptBlock.id,
        children: blocks,
      };

      state.prevBuffer = state.buffer;
      streamTokensRef.current[storeId] = tokens;

      scheduleApplyUpdates();
    };

    // Subscribe to changes in *just* streamTokens[storeId]
    const unsub = usePromptStore.subscribe(
      (state) => state.streamTokens,
      (streamTokens, prevStreamTokens) => {
        // Determine which specific storeId changed
        for (const storeId of Object.keys(streamTokens)) {
          const curr = streamTokens[storeId];
          const prev = prevStreamTokens?.[storeId];

          if (!prev || curr?.length !== prev.length || curr?.includes(STREAM_END_MARKER)) {
            void processStoreId(storeId, curr ?? []);
          }
        }
      }
    );

    return () => {
      unsub();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [editor]);
}
