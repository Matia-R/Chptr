import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PromptEntry {
  prompt: string;
  timestamp: number;
}

interface PromptStore {
  prompts: Record<string, PromptEntry[]>;
  streamTokens: Record<string, string[]>; // storeId -> array of tokens
  addPrompt: (storeId: string, prompt: string) => void;
  clearPrompts: (storeId: string) => void;
  addStreamToken: (storeId: string, token: string) => void;
  clearStreamTokens: (storeId: string) => void;
}

export const usePromptStore = create<PromptStore>()(
  persist(
    (set) => ({
      prompts: {},
      streamTokens: {},
      addPrompt: (storeId: string, prompt: string) => {
        set((state) => {
          const existingPrompts = state.prompts[storeId] ?? [];
          return {
            prompts: {
              ...state.prompts,
              [storeId]: [
                ...existingPrompts,
                {
                  prompt,
                  timestamp: Date.now(),
                },
              ],
            },
          };
        });
      },
      clearPrompts: (storeId: string) => {
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [storeId]: _, ...rest } = state.prompts;
          return { prompts: rest };
        });
      },
      addStreamToken: (storeId: string, token: string) => {
        set((state) => {
          const currentTokens = state.streamTokens[storeId] ?? [];
          return {
            streamTokens: {
              ...state.streamTokens,
              [storeId]: [...currentTokens, token],
            },
          };
        });
      },
      clearStreamTokens: (storeId: string) => {
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [storeId]: _, ...rest } = state.streamTokens;
          return { streamTokens: rest };
        });
      },
    }),
    {
      name: "prompt-store",
    }
  )
);

