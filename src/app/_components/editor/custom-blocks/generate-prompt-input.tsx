import { createReactBlockSpec } from "@blocknote/react";
import { Button } from "../../ui/button";
import { ArrowUp, X, Check } from "lucide-react";
import { TableButton } from "./generate-suggestion-chip";
import React, { useRef, useEffect } from "react";
import { useGenerateStore, GenerateState } from "~/hooks/use-generate-store";

const PromptInputComponent = ({ prevPrompt }: { prevPrompt: string | undefined }) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { submitPrompt, state, setState } = useGenerateStore();

  // Auto-resize function to adjust textarea height based on content
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set height to scrollHeight to fit content
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const handleGenerate = () => {
    const value = textareaRef.current?.value.trim();
    if (!value) return;

    submitPrompt(value);
    setState(GenerateState.Generating);

    // Optional: clear textarea after submit
    // textareaRef.current.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleInput = () => {
    adjustTextareaHeight();
  };

  const handleReject = () => {
    setState(GenerateState.RejectedResponse);
  };

  const handleAccept = () => {
    setState(GenerateState.AcceptedResponse);
  };

  // Clear textarea when state becomes GeneratedResponse
  useEffect(() => {
    if (state === GenerateState.GeneratedResponse && textareaRef.current) {
      textareaRef.current.value = "";
      adjustTextareaHeight();
    }
  }, [state]);

  // Auto-focus using a callback ref that only runs once
  const setTextareaRef = (element: HTMLTextAreaElement | null) => {
    if (element && !element.dataset.focused) {
      element.dataset.focused = "true";
      textareaRef.current = element;
      setTimeout(() => {
        element.focus();
        adjustTextareaHeight();
      }, 0);
    }
  };

  return (
    <div
      contentEditable={false}
      className="flex shadow-md border border-accent-foreground h-full w-full flex-col rounded-md bg-background text-popover-foreground my-3"
    >
      {prevPrompt && (
        <div className="flex gap-y-2 px-3 py-1 border-b border-input justify-between gap-x-2 items-center">
          <p className="text-sm text-muted-foreground truncate">{prevPrompt}</p>
           <div className="flex gap-2">
           {/* <Button
               variant="ghost"
               size="sm"
               className="text-xs text-popover-foreground hover:text-foreground transition-colors focus-visible:ring-1 focus-visible:ring-ring"
             >
               <RotateCcw className="h-4 w-4" />
             </Button> */}
             <Button
               variant="ghost"
               size="sm"
               className="text-xs text-popover-foreground hover:text-foreground transition-colors focus-visible:ring-1 focus-visible:ring-ring"
               onClick={handleReject}
             >
               <X className="h-4 w-4" />
             </Button>
             <Button
               variant="ghost"
               size="sm"
               className="text-xs text-popover-foreground hover:text-foreground transition-colors focus-visible:ring-1 focus-visible:ring-ring"
               onClick={handleAccept}
             >
               <Check className="h-4 w-4" />
             </Button>
           </div>
        </div>
      )}
      <div className="flex flex-col gap-y-2 px-3 pt-3 pb-2">
        <textarea
          ref={setTextareaRef}
          placeholder={prevPrompt ? "Follow-up..." : "Enter your prompt here..."}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={state === GenerateState.Generating}
          className="flex min-h-[2rem] w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden"
          style={{ resize: 'none' }}
          rows={1}
        />
        <div className="flex gap-x-3 overflow-x-auto w-full text-nowrap scrollbar-hide">
          <TableButton label="Add Table" />
          <TableButton label="Add Table" />
          <TableButton label="Add Table" />
          <TableButton label="Add Table" />
          <TableButton label="Add Table" />
          <TableButton label="Add Table" />
          <TableButton label="Add Table" />
          <TableButton label="Add Table" />
          <TableButton label="Add Table" />
          <TableButton label="Add Table" />
        </div>
      </div>

      <div className="flex bg-sidebar border-t border-input items-center justify-between px-3 py-2 rounded-b-md">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-popover-foreground hover:text-foreground transition-colors focus-visible:ring-1 focus-visible:ring-ring"
          disabled={state === GenerateState.Generating}
          // You could also reset the textarea here
        >
          Cancel
        </Button>
        <Button
            variant="ghost"
            size="sm"
            disabled={state === GenerateState.Generating}
            className="text-xs text-popover-foreground hover:text-foreground transition-colors focus-visible:ring-1 focus-visible:ring-ring"
            onClick={handleGenerate}
          >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

// The GeneratePromptInput block.
export const GeneratePromptInput = createReactBlockSpec(
  {
    type: "generatePromptInput",
    propSchema: {
      prevPrompt: {
        default: undefined,
        type: "string",
      }
    },
    content: "inline",
  },
  {
    render: (props) => <PromptInputComponent {...props.block.props} />,
  }
);
