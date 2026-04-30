import type { BlockNoteEditor } from "@blocknote/core";

/** Custom schema (alert, aiPromptInput, …); loose typing for store + publish export. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches BlockNote custom schema
export type AppBlockNoteEditor = BlockNoteEditor<any, any, any>;
