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
  prompt: string | null;
  state: GenerateState;
  generatedBlockIds: string[];
  generateBlockPosition: string;

  submitPrompt: (prompt: string) => void;
  setState: (state: GenerateState) => void;
  setGeneratedBlockIds: (blockIds: string[]) => void;
  setGenerateBlockPosition: (position: string) => void;
}

export const useGenerateStore = create<GenerateStore>()(
  persist(
    (set) => ({
      prompt: null,
      state: GenerateState.AwaitingPrompt,
      generatedBlockIds: [],
      generateBlockPosition: "",

      submitPrompt: (prompt) => set({ prompt }),
      setState: (state) => set({ state }),
    //   setPrompt: (prompt: string | null) => set({ prompt }),
      setGeneratedBlockIds: (generatedBlockIds) => set({ generatedBlockIds }),
      setGenerateBlockPosition: (generateBlockPosition) => set({ generateBlockPosition }),
    }),
    {
      name: "generate-store",
    }
  )
);
