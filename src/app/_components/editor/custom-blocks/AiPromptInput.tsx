"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { ArrowUp, Check, CornerDownRight, X } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { api, type RouterInputs } from "~/trpc/react";
import { Button } from "~/app/_components/ui/button";
import { Spinner } from "~/app/_components/spinner";
import { useAiPromptSession } from "~/hooks/use-ai-prompt-session";

type GenerateForPromptInput = RouterInputs["aiPrompt"]["generateForPrompt"];

// Minimal editor interface: matches the subset of BlockNote editor APIs we actually use here.
interface EditorWithSchema {
  updateBlock(
    block: { id: string } | string,
    update: {
      props?: {
        value?: string;
        historyJson?: string;
        lastResponseMarkdown?: string;
        lastResponseBlockIds?: string;
      };
      content?: string;
    },
  ): void;
  removeBlocks(blocksToRemove: string[]): void;
  replaceBlocks(
    blocksToRemove: string[],
    blocksToInsert: Array<{
      type: string;
      props?: Record<string, unknown>;
      content?: string;
    }>,
  ): { insertedBlocks: { id: string }[] };
  insertBlocks(
    blocksToInsert: Array<{
      type: string;
      props?: Record<string, unknown>;
      content?: string;
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

/**
 * Inner component: multi-line auto-expanding textarea with prompt history and streamed response.
 */
function parseBlockIds(blockIdsJson: string | undefined): string[] {
  if (!blockIdsJson) return [];
  try {
    const parsed = JSON.parse(blockIdsJson) as unknown;
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
      lastResponseBlockIds?: string;
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

  // When the block is removed (e.g. user deletes it via side menu / keyboard), treat as reject: remove generated blocks.
  // Skip when user clicked Accept (keep response) or Reject (we already removed them).
  const removalIntentRef = useRef<"accept" | "reject" | null>(null);
  const blockAndEditorRef = useRef({ block, editor });
  blockAndEditorRef.current = { block, editor };
  useEffect(() => {
    return () => {
      if (removalIntentRef.current !== null) return;
      const { block: b, editor: ed } = blockAndEditorRef.current;
      const generatedIds = parseBlockIds(b.props.lastResponseBlockIds);
      if (generatedIds.length > 0 && b.props.lastResponseMarkdown) {
        ed.removeBlocks(generatedIds);
      }
    };
  }, []);

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
      // On follow-up, remove previously generated blocks before streaming the new response
      if (followUp != null) {
        const previousBlockIds = parseBlockIds(
          block.props.lastResponseBlockIds,
        );
        if (previousBlockIds.length > 0) {
          editor.removeBlocks(previousBlockIds);
        }
      }

      let generatedBlockIds: string[] = [];
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
          insertBlocks: (
            blocksToInsert: Array<{
              type: string;
              props?: Record<string, unknown>;
              content?: unknown;
            }>,
            referenceBlock: { id: string } | string,
            placement: "before" | "after",
          ) => { id: string }[];
          replaceBlocks: (
            blocksToRemove: Array<{ id: string } | string>,
            blocksToInsert: Array<{
              type: string;
              props?: Record<string, unknown>;
              content?: unknown;
            }>,
          ) => { insertedBlocks: { id: string }[] };
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

          if (generatedBlockIds.length === 0) {
            const inserted = bnEditor.insertBlocks(
              blocksToAdd,
              block.id,
              "after",
            );
            generatedBlockIds = inserted.map((b) => b.id);
          } else {
            const { insertedBlocks } = bnEditor.replaceBlocks(
              generatedBlockIds,
              blocksToAdd,
            );
            generatedBlockIds = insertedBlocks.map((b) => b.id);
          }
        }

        if (full) {
          editor.updateBlock(block.id, {
            props: {
              lastResponseMarkdown: full,
              lastResponseBlockIds: JSON.stringify(generatedBlockIds),
            },
          });
        }
      } catch (err) {
        console.error("[generateForPrompt]", err);
        if (generatedBlockIds.length > 0) {
          editor.removeBlocks(generatedBlockIds);
        }
        reset();
      } finally {
        finishStreaming();
      }
    },
    [
      appendResponse,
      block.id,
      block.props.lastResponseBlockIds,
      editor,
      finishStreaming,
      generateForPrompt,
      reset,
      startStreaming,
    ],
  );

  const submitCurrent = async () => {
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
      void submitCurrent();
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

  const placeholder = history.length > 0 ? "Follow up" : "Generate something…";

  const showAcceptReject =
    !isStreaming && history.length > 0 && block.props.lastResponseMarkdown;

  const handleAccept = useCallback(() => {
    removalIntentRef.current = "accept";
    editor.removeBlocks([block.id]);
  }, [block.id, editor]);

  const handleReject = useCallback(() => {
    removalIntentRef.current = "reject";
    const generatedIds = parseBlockIds(block.props.lastResponseBlockIds);
    editor.removeBlocks([block.id, ...generatedIds]);
  }, [block.id, block.props.lastResponseBlockIds, editor]);

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
        <div className="flex min-w-9 justify-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Move up"
            onClick={() => void submitCurrent()}
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
      lastResponseMarkdown: {
        default: "",
      },
      lastResponseBlockIds: {
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
