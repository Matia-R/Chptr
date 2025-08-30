import { defaultProps } from "@blocknote/core";
import { createReactBlockSpec } from "@blocknote/react";
import { Button } from "../../ui/button"
import { ArrowUp } from "lucide-react"
import { TableButton } from "./generate-suggestion-chip"
import { type GenerateActionConfig } from "~/app/ai/prompt/generate-actions-config";

// Separate React component for the prompt input
const PromptInputComponent = ({ generateActionSuggestionItems }: { generateActionSuggestionItems: GenerateActionConfig[] }) => {
    const handleGenerate = () => {
        // TODO: Implement actual generation logic here
        // This would typically call your AI generation API
        console.log("Generate button clicked");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleGenerate();
        }
    };

    // Auto-focus using a callback ref that only runs once
    const setTextareaRef = (element: HTMLTextAreaElement | null) => {
        if (element && !element.dataset.focused) {
            element.dataset.focused = "true";
            // Use a small delay to ensure the DOM is fully rendered
            setTimeout(() => element.focus(), 0);
        }
    };

    return (
        <div contentEditable={false} className="flex shadow-md border border-accent-foreground h-full w-full flex-col rounded-md bg-background text-popover-foreground my-3">
            <div className="flex flex-col gap-y-2 p-3">
                <textarea
                    ref={setTextareaRef}
                    placeholder='Enter your prompt here...'                    
                    onKeyDown={handleKeyDown}
                    className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 resize-none"
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
            
            <div className="flex bg-sidebar items-center justify-between px-3 py-2 rounded-b-md">
                <div className="text-xs">
                    Cancel
                </div>
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs text-foreground hover:text-foreground transition-colors focus-visible:ring-1 focus-visible:ring-ring"
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
            generateActionSuggestionItems: {
                
            }
        },
        content: "inline",
    },
    {
        render: (props) => <PromptInputComponent {...props.block.props} />
    }
);
