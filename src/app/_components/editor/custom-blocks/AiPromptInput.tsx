"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { ArrowUp, CornerDownRight } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/app/_components/ui/button";
import { useAiPromptSession } from "~/hooks/use-ai-prompt-session";

// Minimal editor interface: matches the subset of BlockNote editor APIs we actually use here.
interface EditorWithSchema {
  updateBlock(
    block: { id: string } | string,
    update: { props?: { value?: string; historyJson?: string }; content?: string },
  ): void;
  replaceBlocks(
    blocksToRemove: string[],
    blocksToInsert: Array<{ type: string; props?: Record<string, unknown>; content?: string }>,
  ): { insertedBlocks: { id: string }[] };
  insertBlocks(
    blocksToInsert: Array<{ type: string; props?: Record<string, unknown>; content?: string }>,
    referenceBlock: { id: string } | string,
    placement: "before" | "after",
  ): { id: string }[];
  setTextCursorPosition(
    block: { id: string },
    placement: "start" | "end",
  ): void;
  focus(): void;
}

/**
 * Auto-resize textarea: set height to auto then to scrollHeight so it grows with content.
 */
function adjustTextareaHeight(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return;
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function parseHistory(historyJson: string | undefined): string[] {
  if (!historyJson) return [];
  try {
    const parsed = JSON.parse(historyJson) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * Inner component: multi-line auto-expanding textarea with prompt history and streamed response.
 */
function AiPromptInputContent(props: {
  block: { id: string; props: { value: string; historyJson?: string } };
  editor: EditorWithSchema;
}) {
  const { block, editor } = props;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const history = parseHistory(block.props.historyJson);
  const generateForPrompt = api.aiPrompt.generateForPrompt.useMutation();

  const { lastResponse, isStreaming, setPrompts, startStreaming, appendResponse, finishStreaming, reset } =
    useAiPromptSession();

  const setTextareaRef = (element: HTMLTextAreaElement | null) => {
    if (element && !element.dataset.focused) {
      element.dataset.focused = "true";
      textareaRef.current = element;
      setTimeout(() => {
        element.focus();
        adjustTextareaHeight(element);
      }, 0);
    }
  };

  const runGeneration = useCallback(
    async (prompt: string, previousResponse: string | null, followUp: string | null) => {
      startStreaming();
      try {
        const result = followUp
          ? await generateForPrompt.mutateAsync({
              prompt,
              previousResponse: previousResponse ?? "",
              followUp,
            })
          : await generateForPrompt.mutateAsync({ prompt });

        let full = "";
        // Track the block ids we insert for the streamed response so we can replace them as the markdown grows
        let generatedBlockIds: string[] = [];
        // We need access to the full BlockNote editor API for markdown → blocks
        const bnEditor = editor as unknown as {
          insertBlocks: (
            blocksToInsert: Array<{ type: string; props?: Record<string, unknown>; content?: unknown }>,
            referenceBlock: { id: string } | string,
            placement: "before" | "after",
          ) => { id: string }[];
          replaceBlocks: (
            blocksToRemove: Array<{ id: string } | string>,
            blocksToInsert: Array<{ type: string; props?: Record<string, unknown>; content?: unknown }>,
          ) => { insertedBlocks: { id: string }[] };
          tryParseMarkdownToBlocks: (
            markdown: string,
          ) => Promise<Array<{ type: string; props?: Record<string, unknown>; content?: unknown }>>;
        };

        for await (const token of result) {
          full += token;
          appendResponse(token);

          // Convert the current markdown to BlockNote blocks and render them after the AiPromptInput
          const blocksToAdd = await bnEditor.tryParseMarkdownToBlocks(full);

          if (generatedBlockIds.length === 0) {
            // First chunk: insert the blocks once after this AiPromptInput
            const inserted = bnEditor.insertBlocks(blocksToAdd, block.id, "after");
            generatedBlockIds = inserted.map((b) => b.id);
          } else {
            // Subsequent chunks: replace previously inserted blocks with the new parsed blocks
            const { insertedBlocks } = bnEditor.replaceBlocks(generatedBlockIds, blocksToAdd);
            generatedBlockIds = insertedBlocks.map((b) => b.id);
          }
        }
      } catch (err) {
        console.error("[generateForPrompt]", err);
        reset();
      } finally {
        finishStreaming();
      }
    },
    [appendResponse, block.id, editor, finishStreaming, generateForPrompt, reset, startStreaming],
  );

  const submitCurrent = () => {
    const text = block.props.value?.trim() ?? "";
    if (!text || isStreaming) return;

    const nextHistory = [...history, text];
    editor.updateBlock(block, {
      props: {
        value: "",
        historyJson: JSON.stringify(nextHistory),
      },
    });
    setPrompts(nextHistory);

    textareaRef.current?.focus();
    setTimeout(() => adjustTextareaHeight(textareaRef.current), 0);

    const isFollowUp = nextHistory.length > 1;
    if (isFollowUp) {
      const initialPrompt = nextHistory[0]!;
      void runGeneration(initialPrompt, lastResponse || null, text);
    } else {
      void runGeneration(text, null, null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    editor.updateBlock(block, {
      props: { value: e.target.value },
    });
  };

  const handleInput = () => {
    adjustTextareaHeight(textareaRef.current);
  };

  // Re-run height adjustment when value changes (e.g. paste, undo)
  useEffect(() => {
    adjustTextareaHeight(textareaRef.current);
  }, [block.props.value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "/") {
      e.stopPropagation();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitCurrent();
      return;
    }
    if (e.key === "Backspace" && !block.props.value) {
      e.preventDefault();
      const { insertedBlocks } = editor.replaceBlocks(
        [block.id],
        [{ type: "paragraph" }],
      );
      const newBlock = insertedBlocks[0];
      if (newBlock) {
        editor.setTextCursorPosition(newBlock, "start");
        setTimeout(() => editor.focus(), 0);
      }
    }
  };

  const placeholder = history.length > 0 ? "Follow up" : "Type something…";

  return (
    <div
      contentEditable={false}
      className="bn-animate-in bn-fade-in-0 bn-zoom-in-95 flex w-full flex-col rounded-lg bg-sidebar shadow-sm"
      data-content-type="aiPromptInput"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="flex flex-col gap-y-2 rounded-lg border border-border px-3 pb-2 pt-3"
        data-ai-prompt-input-field
      >
        {history.length > 0 && (
          <div className="flex max-h-32 flex-col overflow-y-auto border-b border-border pb-2">
            {history.map((entry, i) => (
              <div
                key={`${i}-${entry.slice(0, 20)}`}
                className="ai-prompt-input-history-entry flex items-start gap-2 text-sm text-muted-foreground"
              >
                {i > 0 && (
                  <CornerDownRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span>{entry}</span>
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={setTextareaRef}
          placeholder={placeholder}
          value={block.props.value}
          onChange={handleChange}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isStreaming}
          className="min-h-[2rem] w-full resize-none overflow-hidden bg-transparent py-3 text-sm text-popover-foreground outline-none placeholder:text-muted-foreground focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ resize: "none" }}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Move up"
            onClick={submitCurrent}
            disabled={isStreaming}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Custom block that renders an AI prompt input. Inserted when the user presses Cmd+/ (Mac) or Ctrl+/ (Windows/Linux).
 * Auto-focus pattern from ai-integration-v4: callback ref that only runs once so the user can immediately type.
 */
export const AiPromptInput = createReactBlockSpec(
  {
    type: "aiPromptInput",
    content: "none",
    propSchema: {
      value: {
        default: "",
      },
      historyJson: {
        default: "[]",
      },
    },
  },
  {
    render: (props) => (
      <AiPromptInputContent
        block={props.block}
        editor={props.editor as unknown as EditorWithSchema}
      />
    ),
  },
);
