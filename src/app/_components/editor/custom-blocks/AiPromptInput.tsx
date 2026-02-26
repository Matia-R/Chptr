"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { ArrowUp, CornerDownRight } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "~/app/_components/ui/button";

// Minimal editor interface so we can pass paragraph to replaceBlocks (full schema has paragraph)
interface EditorWithSchema {
  updateBlock(
    block: { id: string },
    update: { props: { value?: string; historyJson?: string } },
  ): void;
  replaceBlocks(
    blocksToRemove: string[],
    blocksToInsert: Array<{ type: string }>,
  ): { insertedBlocks: { id: string }[] };
  setTextCursorPosition(
    block: { id: string },
    placement: "start" | "end",
  ): void;
  focus(): void;
}

/**
 * Auto-resize textarea: set height to auto then to scrollHeight so it grows with content (ai-integration-v4 pattern).
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
 * Inner component: multi-line auto-expanding textarea like ai-integration-v4 AIGenerateInput.
 */
function AiPromptInputContent(props: {
  block: { id: string; props: { value: string; historyJson?: string } };
  editor: EditorWithSchema;
}) {
  const { block, editor } = props;
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const history = parseHistory(block.props.historyJson);

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

  const submitCurrent = () => {
    const text = block.props.value?.trim() ?? "";
    if (!text) return;
    const nextHistory = [...history, text];
    editor.updateBlock(block, {
      props: {
        value: "",
        historyJson: JSON.stringify(nextHistory),
      },
    });
    textareaRef.current?.focus();
    setTimeout(() => adjustTextareaHeight(textareaRef.current), 0);
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
          className="min-h-[2rem] w-full resize-none overflow-hidden bg-transparent py-3 text-sm text-popover-foreground outline-none placeholder:text-muted-foreground focus:outline-none focus:ring-0"
          style={{ resize: "none" }}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Move up"
            onClick={submitCurrent}
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
