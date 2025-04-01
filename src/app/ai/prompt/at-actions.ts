export enum AtAction {
    Summarize = "Summarize",
    AddTable = "Add Table",
}

export const atActions = Object.values(AtAction);

export const atActionPrompts: Record<AtAction, string> = {
    [AtAction.Summarize]: "Summarize this text thoroughly. Include a table, numbered list, bulleted list, nested list and a codeblock:",
    [AtAction.AddTable]: "Organize this text into a table. The table should have a header row and at least 3 rows of data. ONLY PROVIDE A TABLE. Do not include anything else.:"
}