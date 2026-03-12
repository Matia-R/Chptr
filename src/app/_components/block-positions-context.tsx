"use client";

import * as React from "react";

export type PositionEntry = {
  index: number;
  blockId: string;
  /** Markdown of the block (for AI summary). Filled async by the editor. */
  markdown?: string;
};

type BlockPositionsContextValue = {
  /** All blocks: index, block id, and markdown (for review feedback and cursor move). */
  positions: PositionEntry[];
  setPositions: (positions: PositionEntry[]) => void;
  /** Request to move the editor cursor to the block; no-op if editor not mounted. */
  requestCursorMove: (blockId: string) => void;
  /** Register the handler that performs the cursor move (called by Editor). Returns unregister. */
  registerCursorMoveHandler: (handler: (blockId: string) => void) => () => void;
};

const BlockPositionsContext =
  React.createContext<BlockPositionsContextValue | null>(null);

export function useBlockPositions(): BlockPositionsContextValue {
  const ctx = React.useContext(BlockPositionsContext);
  if (!ctx) {
    throw new Error(
      "useBlockPositions must be used within a BlockPositionsProvider",
    );
  }
  return ctx;
}

export function BlockPositionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [positions, setPositions] = React.useState<PositionEntry[]>([]);
  const cursorMoveHandlerRef = React.useRef<((blockId: string) => void) | null>(
    null,
  );

  const requestCursorMove = React.useCallback((blockId: string) => {
    cursorMoveHandlerRef.current?.(blockId);
  }, []);

  const registerCursorMoveHandler = React.useCallback(
    (handler: (blockId: string) => void) => {
      cursorMoveHandlerRef.current = handler;
      return () => {
        cursorMoveHandlerRef.current = null;
      };
    },
    [],
  );

  const value = React.useMemo<BlockPositionsContextValue>(
    () => ({
      positions,
      setPositions,
      requestCursorMove,
      registerCursorMoveHandler,
    }),
    [positions, requestCursorMove, registerCursorMoveHandler],
  );

  return (
    <BlockPositionsContext.Provider value={value}>
      {children}
    </BlockPositionsContext.Provider>
  );
}
