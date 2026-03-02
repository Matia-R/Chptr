"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { ArrowUp, Check, CornerDownRight, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { api, type RouterInputs } from "~/trpc/react";
import { Button } from "~/app/_components/ui/button";
import { Spinner } from "~/app/_components/spinner";
import { useAiPromptSession } from "~/hooks/use-ai-prompt-session";
import { MAX_PROMPT_LENGTH } from "~/app/ai/prompt/constants";

type GenerateForPromptInput = RouterInputs["aiPrompt"]["generateForPrompt"];

// Block with optional children (generated content lives as children of the prompt block).
interface BlockWithChildren {
  id: string;
  children: Array<{ id: string; type: string; props?: Record<string, unknown>; content?: unknown; children?: unknown[] }>;
}

// Minimal editor interface: matches the subset of BlockNote editor APIs we actually use here.
interface EditorWithSchema {
  getBlock(block: { id: string } | string): BlockWithChildren | undefined;
  updateBlock(
    block: { id: string } | string,
    update: {
      props?: {
        value?: string;
        historyJson?: string;
        lastResponseMarkdown?: string;
      };
      content?: string;
      children?: Array<{
        type: string;
        props?: Record<string, unknown>;
        content?: unknown;
      }>;
    },
  ): void;
  removeBlocks(blocksToRemove: string[]): void;
  replaceBlocks(
    blocksToRemove: string[],
    blocksToInsert: Array<{
      type: string;
      props?: Record<string, unknown>;
      content?: unknown;
    }>,
  ): { insertedBlocks: { id: string }[] };
  insertBlocks(
    blocksToInsert: Array<{
      type: string;
      props?: Record<string, unknown>;
      content?: unknown;
      id?: string;
    }>,
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

function AiPromptInputContent(props: {
  block: {
    id: string;
    props: {
      value: string;
      historyJson?: string;
      lastResponseMarkdown?: string;
    };
  };
  editor: EditorWithSchema;
}) {
  const { block, editor } = props;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const history = parseHistory(block.props.historyJson);
  const generateForPrompt = (
    api.aiPrompt.generateForPrompt as {
      useMutation: () => {
        mutateAsync: (
          input: GenerateForPromptInput,
        ) => Promise<AsyncIterable<string>>;
      };
    }
  ).useMutation();

  const {
    lastResponse,
    isStreaming,
    setPrompts,
    startStreaming,
    appendResponse,
    finishStreaming,
    reset,
  } = useAiPromptSession();

  // When the block is removed (e.g. user deletes it via side menu / keyboard), generated blocks are
  // children of this block so they are removed with it. No cleanup needed.
  const removalIntentRef = useRef<"accept" | "reject" | null>(null);

  const closeFormattingToolbar = useCallback(() => {
    const bn = editor as unknown as {
      formattingToolbar?: { closeMenu: () => void };
    };
    bn.formattingToolbar?.closeMenu?.();
  }, [editor]);

  /** Close toolbar now and on next tick/rAF so we run after BlockNote opens it */
  const closeFormattingToolbarDeferred = useCallback(() => {
    closeFormattingToolbar();
    setTimeout(closeFormattingToolbar, 0);
    requestAnimationFrame(closeFormattingToolbar);
  }, [closeFormattingToolbar]);

  const setTextareaRef = (element: HTMLTextAreaElement | null) => {
    if (element && !element.dataset.focused) {
      element.dataset.focused = "true";
      textareaRef.current = element;
      setTimeout(() => {
        element.focus();
        adjustTextareaHeight(element);
        closeFormattingToolbar();
      }, 0);
    }
  };

  const runGeneration = useCallback(
    async (
      prompt: string,
      previousResponse: string | null,
      followUp: string | null,
      documentContext: string,
    ) => {
      startStreaming();
      // On follow-up, clear previous generated content (children) before streaming the new response
      if (followUp != null) {
        const promptBlock = editor.getBlock(block.id);
        const childIds = promptBlock?.children?.map((c) => c.id) ?? [];
        if (childIds.length > 0) {
          editor.removeBlocks(childIds);
        }
      }

      try {
        const input: GenerateForPromptInput = followUp
          ? {
              prompt,
              documentContext,
              previousResponse: previousResponse ?? "",
              followUp,
            }
          : { prompt, documentContext };
        const result: AsyncIterable<string> =
          await generateForPrompt.mutateAsync(input);

        let full = "";
        const bnEditor = editor as unknown as {
          tryParseMarkdownToBlocks: (markdown: string) => Promise<
            Array<{
              type: string;
              props?: Record<string, unknown>;
              content?: unknown;
            }>
          >;
        };

        for await (const token of result) {
          full += token;
          appendResponse(token);

          const blocksToAdd = await bnEditor.tryParseMarkdownToBlocks(full);
          editor.updateBlock(block.id, { children: blocksToAdd });
        }

        if (full) {
          editor.updateBlock(block.id, {
            props: { lastResponseMarkdown: full },
          });
        }
      } catch (err) {
        console.error("[generateForPrompt]", err);
        const promptBlock = editor.getBlock(block.id);
        const childIds = promptBlock?.children?.map((c) => c.id) ?? [];
        if (childIds.length > 0) {
          editor.removeBlocks(childIds);
        }
        reset();
      } finally {
        finishStreaming();
      }
    },
    [
      appendResponse,
      block.id,
      editor,
      finishStreaming,
      generateForPrompt,
      reset,
      startStreaming,
    ],
  );

  const submitCurrent = async () => {
    const text = block.props.value?.trim() ?? "";
    if (!text || isStreaming || text.length > MAX_PROMPT_LENGTH) return;

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

    const bnEditor = editor as unknown as {
      document: Array<{ id: string }>;
      blocksToMarkdownLossy: (
        blocks?: Array<{ id: string }>,
      ) => Promise<string>;
    };
    const blocksExcludingInput = bnEditor.document.filter(
      (b) => b.id !== block.id,
    );
    const documentContext =
      await bnEditor.blocksToMarkdownLossy(blocksExcludingInput);

    const isFollowUp = nextHistory.length > 1;
    const previousResponse =
      (block.props.lastResponseMarkdown ?? lastResponse) || null;
    if (isFollowUp) {
      const initialPrompt = nextHistory[0]!;
      void runGeneration(
        initialPrompt,
        previousResponse,
        text,
        documentContext,
      );
    } else {
      void runGeneration(text, null, null, documentContext);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    editor.updateBlock(block, {
      props: { value: e.target.value },
    });
    closeFormattingToolbarDeferred();
  };

  const handleInput = () => {
    adjustTextareaHeight(textareaRef.current);
  };

  // Re-run height adjustment when value changes (e.g. paste, undo)
  useEffect(() => {
    adjustTextareaHeight(textareaRef.current);
  }, [block.props.value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    closeFormattingToolbarDeferred();
    if ((e.metaKey || e.ctrlKey) && e.key === "/") {
      e.stopPropagation();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const currentLength = (block.props.value?.trim() ?? "").length;
      if (currentLength <= MAX_PROMPT_LENGTH) void submitCurrent();
      return;
    }
    if (e.key === "Backspace" && !block.props.value) {
      e.preventDefault();
      const { insertedBlocks } = editor.replaceBlocks([block.id], [
        { type: "paragraph" },
      ]);
      const newBlock = insertedBlocks[0];
      if (newBlock) {
        editor.setTextCursorPosition(newBlock, "start");
        setTimeout(() => editor.focus(), 0);
      }
    }
  };

  const placeholder = history.length > 0 ? "Follow up" : "Generate something…";

  const promptLength = (block.props.value?.trim() ?? "").length;
  const isOverLimit = promptLength > MAX_PROMPT_LENGTH;

  const showAcceptReject =
    !isStreaming && history.length > 0 && block.props.lastResponseMarkdown;

  const handleAccept = useCallback(() => {
    removalIntentRef.current = "accept";
    const promptBlock = editor.getBlock(block.id);
    const children = promptBlock?.children ?? [];
    if (children.length > 0) {
      editor.insertBlocks(
        children.map((c) => ({ type: c.type, props: c.props, content: c.content })),
        block.id,
        "after",
      );
    }
    editor.removeBlocks([block.id]);
  }, [block.id, editor]);

  const handleReject = useCallback(() => {
    removalIntentRef.current = "reject";
    editor.removeBlocks([block.id]);
  }, [block.id, editor]);

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
          <div className="flex max-h-32 flex-col overflow-y-auto border-b border-border pb-2 [scrollbar-gutter:stable]">
            {history.map((entry, i) => {
              const isLast = i === history.length - 1;
              const showActions = isLast && showAcceptReject;
              return (
                <div
                  key={`${i}-${entry.slice(0, 20)}`}
                  className="ai-prompt-input-history-entry flex items-center justify-between gap-2 text-sm text-muted-foreground"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    {i > 0 && (
                      <CornerDownRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{entry}</span>
                  </div>
                  {(isStreaming && isLast) || showActions ? (
                    <div className="flex min-w-9 shrink-0 items-center justify-end gap-0.5">
                      {isStreaming && isLast ? (
                        <Spinner
                          className="m-2 h-4 w-4 text-muted-foreground"
                          aria-label="Generating"
                        />
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Accept response"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={handleAccept}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Reject response"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={handleReject}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        <textarea
          ref={setTextareaRef}
          placeholder={placeholder}
          value={block.props.value}
          onChange={handleChange}
          onInput={handleInput}
          onFocus={closeFormattingToolbarDeferred}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={isStreaming}
          className="min-h-[2rem] w-full resize-none overflow-hidden bg-transparent py-3 text-sm text-popover-foreground outline-none placeholder:text-muted-foreground focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ resize: "none" }}
        />
        <div className="flex min-w-9 items-center justify-between gap-2">
          {isOverLimit ? (
            <span className="text-sm text-destructive">
              Please shorten your prompt
            </span>
          ) : (
            <span className="min-w-0 flex-1" />
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Submit prompt"
            onClick={() => void submitCurrent()}
            disabled={isStreaming || isOverLimit}
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
      lastResponseMarkdown: {
        default: "",
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
