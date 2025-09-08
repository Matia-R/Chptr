import mitt from "mitt";

type Events = {
  GenerateActionPromptSubmitted: string;
};

export const emitter = mitt<Events>();