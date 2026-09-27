export type HighlightedToken = {
  text: string;
  lightClass?: string;
  darkClass?: string;
  italic: boolean;
  bold: boolean;
  underline: boolean;
};

export type HighlightedCode = {
  lines: HighlightedToken[][];
};
