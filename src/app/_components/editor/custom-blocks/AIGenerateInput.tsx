import { createReactBlockSpec } from "@blocknote/react";
import { Button } from "../../ui/button";
import { ArrowUp, CornerDownRight } from "lucide-react";
import React, { useRef, useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { usePromptStore } from "~/hooks/use-prompt-store";
import { motion, AnimatePresence } from "framer-motion";

const AiPromptInput = ({ context, promptStoreId }: { context: string, promptStoreId: string }) => {

  console.log(context);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);
  const addPrompt = usePromptStore((state) => state.addPrompt);
  const allPrompts = usePromptStore((state) => state.prompts);
  const addStreamToken = usePromptStore((state) => state.addStreamToken);
  const clearStreamTokens = usePromptStore((state) => state.clearStreamTokens);
  
  // Get prompts for this specific store ID
  const prompts = useMemo(() => {
    if (!promptStoreId) return [];
    return allPrompts[promptStoreId] ?? [];
  }, [promptStoreId, allPrompts]);

  // Auto-resize function to adjust textarea height based on content
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set height to scrollHeight to fit content
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

//   const generate = api.aiGenerate.generate.useMutation();
  const generateForPrompt = api.aiGenerate.generateForPrompt.useMutation();
  const handleGenerate = async () => {
    if (isGeneratingResponse || generateForPrompt.isPending) return;
    
    const prompt = textareaRef.current?.value.trim();
    if (!prompt || !promptStoreId) return;

    // Save prompt to store
    addPrompt(promptStoreId, prompt);

    setIsGeneratingResponse(true);
    clearStreamTokens(promptStoreId);

    try {
      const result = await generateForPrompt.mutateAsync({
          prompt: prompt,
          context: context,
      });

      for await (const token of result) {
        console.log(token);
        addStreamToken(promptStoreId, token);
      }
    } finally {
        setIsGeneratingResponse(false);
    }

    // Clear textarea after submission
    if (textareaRef.current) {
      textareaRef.current.value = "";
      adjustTextareaHeight();
    }
  }

  // Render the history of prompts
  const promptHistory = useMemo(() => {
    if (prompts.length === 0) {
      return null;
    }

    // Show all prompts except the last one while generating, show all when not generating
    const promptsToShow = isGeneratingResponse 
      ? prompts.slice(0, -1)  // Show all except the last one while generating
      : prompts;              // Show all prompts otherwise

    if (promptsToShow.length === 0) {
      return null;
    }

    return (
      <AnimatePresence initial={false}>
        {promptsToShow.map((promptEntry, index) => {
          const isFollowUp = index > 0;

          return (
            <motion.div
              key={`${promptEntry.timestamp}-${index}`}
              initial={{ height: 0, opacity: 0, y: 20 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="flex gap-y-2 px-3 py-1 border-b border-input justify-between items-center">
                <div className="flex items-center flex-1 min-w-0">
                  {isFollowUp && (
                    <div className="inline-flex items-center h-8 w-6 flex-shrink-0">
                      <CornerDownRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex items-center h-8 min-w-0 flex-1">
                    <p className={`text-sm text-muted-foreground truncate ${isFollowUp ? 'italic !pr-1' : ''}`}>{promptEntry.prompt}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    );
  }, [prompts, isGeneratingResponse]);

  // Clear textarea when state becomes GeneratedResponse
//   useEffect(() => {
//     if (state === GenerateState.GeneratedResponse && textareaRef.current) {
//       textareaRef.current.value = "";
//       adjustTextareaHeight();
//     }
//   }, [state]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isGeneratingResponse) {
      e.preventDefault();
      void handleGenerate();
    }
  };

  const handleInput = () => {
    adjustTextareaHeight();
  };

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
          disabled={isGeneratingResponse}
          className="flex min-h-[2rem] w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden"
          style={{ resize: 'none' }}
          rows={1}
        />
      </div>

      <div className="flex bg-sidebar border-t border-input items-center justify-between px-3 py-2 rounded-b-md">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-popover-foreground hover:text-foreground transition-colors focus-visible:ring-1 focus-visible:ring-ring"
          disabled={isGeneratingResponse}
        >
          Cancel
        </Button>
        <Button
            variant="ghost"
            size="sm"
            disabled={isGeneratingResponse}
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
export const AiPromptInputBlock = createReactBlockSpec(
  {
    type: "aiPromptInput",
    propSchema: { context: { default: "" }, promptStoreId: { default: "" }  },
    content: "inline",
  },
  {
    render: ({ block }) => <AiPromptInput context={block.props.context} promptStoreId={block.props.promptStoreId} />,
  }
);