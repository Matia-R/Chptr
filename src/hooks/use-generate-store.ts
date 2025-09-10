import { create } from "zustand";

interface GenerateState {
  prompt: string | null;
  isGenerating: boolean;

  submitPrompt: (prompt: string) => void;
  setGenerating: (generating: boolean) => void;
}

export const useGenerateStore = create<GenerateState>((set) => ({
  prompt: null,
  isGenerating: false,

  submitPrompt: (prompt) => set({ prompt }),
  setGenerating: (generating) => set({ isGenerating: generating }),
}));
