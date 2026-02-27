import { create } from "zustand";

interface AiPromptSessionState {
  prompts: string[];
  lastResponse: string;
  isStreaming: boolean;
}

interface AiPromptSessionStore extends AiPromptSessionState {
  setPrompts: (prompts: string[]) => void;
  startStreaming: () => void;
  appendResponse: (chunk: string) => void;
  finishStreaming: () => void;
  reset: () => void;
}

const initialState: AiPromptSessionState = {
  prompts: [],
  lastResponse: "",
  isStreaming: false,
};

export const useAiPromptSession = create<AiPromptSessionStore>((set) => ({
  ...initialState,
  setPrompts: (prompts) => set((state) => ({ ...state, prompts })),
  startStreaming: () =>
    set((state) => ({
      ...state,
      isStreaming: true,
      lastResponse: "",
    })),
  appendResponse: (chunk) =>
    set((state) => ({
      ...state,
      lastResponse: state.lastResponse + chunk,
    })),
  finishStreaming: () =>
    set((state) => ({
      ...state,
      isStreaming: false,
    })),
  reset: () => set(() => initialState),
}));

