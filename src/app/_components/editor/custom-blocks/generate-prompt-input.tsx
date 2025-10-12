import { createReactBlockSpec } from "@blocknote/react";
import { Button } from "../../ui/button";
import { ArrowUp, X, Check, CornerDownRight } from "lucide-react";
import { TableButton } from "./generate-suggestion-chip";
import React, { useRef, useEffect, useMemo, useCallback } from "react";
import { useGenerateStore, GenerateState } from "~/hooks/use-generate-store";
import { motion, AnimatePresence } from "framer-motion";

const PromptInputComponent = () => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const { submitPrompt, state, setState, prompts } = useGenerateStore();
  
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

  const handleReject = useCallback(() => {
    setState(GenerateState.RejectedResponse);
  }, [setState]);

  const handleAccept = useCallback(() => {
    setState(GenerateState.AcceptedResponse);
  }, [setState]);

  // Render the history of prompts
  // Show n-1 prompts when generating (exclude the current prompt being processed)
  // Show all prompts when in GeneratedResponse state (including the last one that just got a response)
  const promptHistory = useMemo(() => {
    if (prompts.length === 0) {
      return null;
    }
    
    // Determine which prompts to show based on state
    const promptsToShow = state === GenerateState.Generating 
      ? prompts.slice(0, -1)  // Show all except the last one while generating
      : prompts;              // Show all prompts otherwise (including GeneratedResponse)
    
    if (promptsToShow.length === 0) {
      return null;
    }
    
    return (
      <AnimatePresence initial={false}>
        {promptsToShow.map((prompt, index) => {
          const isLastPrompt = index === promptsToShow.length - 1;
          const showActions = isLastPrompt && state === GenerateState.GeneratedResponse;
          const isFollowUp = index > 0;
          
          return (
            <motion.div
              key={index}
              initial={{ height: 0, opacity: 0, y: 20 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="flex gap-y-2 px-3 py-1 border-b border-input justify-between gap-x-2 items-center">
                <div className={`flex items-center flex-1 min-w-0 ${isFollowUp ? '' : 'gap-x-2'}`}>
                  {isFollowUp ? (
                    <div className="inline-flex items-center justify-center h-8 w-8 rounded-md">
                      <CornerDownRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="h-8" />
                  )}
                  <p className={`text-sm text-muted-foreground truncate ${isFollowUp ? 'italic' : ''}`}>{prompt}</p>
                </div>
                {showActions && (
                  <div className="flex gap-2">
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
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    );
  }, [state, prompts, handleReject, handleAccept]);

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
      {promptHistory}
      <div className="flex flex-col gap-y-2 px-3 pt-3 pb-2">
        <textarea
          ref={setTextareaRef}
          placeholder={prompts.length > 0 ? "Follow-up..." : "Enter your prompt here..."}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          disabled={state === GenerateState.Generating}
          className="flex min-h-[2rem] w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden"
          style={{ resize: 'none' }}
          rows={1}
        />
        {/* <div className="flex gap-x-3 overflow-x-auto w-full text-nowrap scrollbar-hide">
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
        </div> */}
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
    propSchema: {},
    content: "inline",
  },
  {
    render: () => <PromptInputComponent />,
  }
);
