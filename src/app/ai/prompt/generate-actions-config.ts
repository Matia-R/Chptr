import { createElement } from "react";
import { LucideBookDown, LucideTable } from "lucide-react";

export enum GenerateAction {
    Summarize = "Summarize",
    AddTable = "Add Table",
}

export type GenerateActionConfig = {
    title: string;
    subtext: string;
    group: string;
    icon: JSX.Element;
    prompt: string;
};

export const generateActionsConfig: Record<GenerateAction, GenerateActionConfig> = {
    [GenerateAction.Summarize]: {
        title: "Summarize",
        subtext: "Summarize content",
        group: "Generate",
        icon: createElement(LucideBookDown, { className: "w-4 h-4" }),
        prompt:
            "Summarize this text thoroughly. Include a table, numbered list, bulleted list, nested list and a codeblock:",
    },
    [GenerateAction.AddTable]: {
        title: "Add Table",
        subtext: "Organize content into a table",
        group: "Generate",
        icon: createElement(LucideTable, { className: "w-4 h-4" }),
        prompt:
            "Organize this text into a table. The table should have a header row and at least 3 rows of data. ONLY PROVIDE A TABLE. Do not include anything else.",
    },
};

// Optional helpers for convenience
export const atActions = Object.values(GenerateAction);
