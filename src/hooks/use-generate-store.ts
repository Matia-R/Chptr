import { create } from "zustand";
import { persist } from "zustand/middleware";

export enum GenerateState {
  AwaitingPrompt = "awaitingPrompt",
  Generating = "generating", 
  GeneratedResponse = "generatedResponse",
  AcceptedResponse = "acceptedResponse",
  RejectedResponse = "rejectedResponse",
}

interface GenerateStore {
  prompts: string[];
  state: GenerateState;
  generatedBlockIds: string[];
  generateBlockPosition: string;

  submitPrompt: (prompt: string) => void;
  setState: (state: GenerateState) => void;
  setGeneratedBlockIds: (blockIds: string[]) => void;
  setGenerateBlockPosition: (position: string) => void;
  setPrompts: (prompts: string[]) => void;
}

export const useGenerateStore = create<GenerateStore>()(
  persist(
    (set) => ({
      prompts: [],
      state: GenerateState.AwaitingPrompt,
      generatedBlockIds: [],
      generateBlockPosition: "",

      submitPrompt: (prompt) => set((state) => ({ prompts: [...state.prompts, prompt] })),
      setState: (state) => set({ state }),
      setPrompts: (prompts) => set({ prompts }),
      setGeneratedBlockIds: (generatedBlockIds) => set({ generatedBlockIds }),
      setGenerateBlockPosition: (generateBlockPosition) => set({ generateBlockPosition }),
    }),
    {
      name: "generate-store",
    }
  )
);
