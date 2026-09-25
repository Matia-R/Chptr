import "server-only";

import {
  createHighlighter,
  type BundledLanguage,
  type Highlighter,
} from "shiki";

import { supportedLanguages } from "~/app/_components/editor/codeBlockSyntaxHighlighter";

import { inlineToPlainText, type PublishedBlock } from "./parse";

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

const shikiLanguageIds = Object.keys(supportedLanguages);

const aliasToLanguage = new Map<string, string>();
for (const [id, config] of Object.entries(supportedLanguages)) {
  aliasToLanguage.set(id, id);
  for (const alias of config.aliases ?? []) {
    aliasToLanguage.set(alias, id);
  }
}

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    themes: ["github-light", "github-dark"],
    langs: shikiLanguageIds,
  });
  return highlighterPromise;
}

function normalizeHex(color: string | undefined): string | undefined {
  if (!color) return undefined;
  const raw = color.trim().toLowerCase();
  if (!raw.startsWith("#")) return undefined;
  const body = raw.slice(1);
  if (!/^[0-9a-f]+$/.test(body)) return undefined;
  if (body.length === 3 || body.length === 4) {
    return body
      .split("")
      .map((char) => char + char)
      .join("");
  }
  if (body.length === 6 || body.length === 8) return body;
  return undefined;
}

function tokenClass(
  prefix: "l" | "d",
  color: string | undefined,
): string | undefined {
  const hex = normalizeHex(color);
  if (!hex) return undefined;
  return `tok-${prefix}-${hex}`;
}

type TokenStyle = {
  color?: string;
  fontStyle?: number;
};

function tokenColor(
  token: {
    color?: string;
    htmlStyle?: Record<string, string> | string;
    variants?: Record<string, TokenStyle>;
  },
  theme: "light" | "dark",
): string | undefined {
  const htmlStyle =
    token.htmlStyle && typeof token.htmlStyle === "object"
      ? token.htmlStyle
      : undefined;
  if (theme === "dark" && htmlStyle?.["--shiki-dark"]) {
    return htmlStyle["--shiki-dark"];
  }
  if (theme === "light" && htmlStyle?.color) return htmlStyle.color;

  const variant = token.variants?.[theme]?.color;
  if (variant) return variant;
  if (theme === "light") return token.color;
  return undefined;
}

function toHighlightedToken(token: {
  content: string;
  color?: string;
  fontStyle?: number;
  htmlStyle?: Record<string, string> | string;
  variants?: Record<string, TokenStyle>;
}): HighlightedToken {
  return {
    text: token.content,
    lightClass: tokenClass("l", tokenColor(token, "light")),
    darkClass: tokenClass("d", tokenColor(token, "dark")),
    italic: ((token.fontStyle ?? 0) & 1) === 1,
    bold: ((token.fontStyle ?? 0) & 2) === 2,
    underline: ((token.fontStyle ?? 0) & 4) === 4,
  };
}

async function highlightSource(
  source: string,
  language: string,
): Promise<HighlightedCode | undefined> {
  const lang = aliasToLanguage.get(language);
  if (!lang) return undefined;

  try {
    const highlighter = await getHighlighter();
    const result = highlighter.codeToTokens(source, {
      lang: lang as BundledLanguage,
      themes: {
        light: "github-light",
        dark: "github-dark",
      },
    });
    return {
      lines: result.tokens.map((line) => line.map(toHighlightedToken)),
    };
  } catch {
    return undefined;
  }
}

export async function highlightPublishedCode(
  blocks: PublishedBlock[],
): Promise<Map<string, HighlightedCode>> {
  const highlighted = new Map<string, HighlightedCode>();

  async function walk(list: PublishedBlock[]) {
    for (const block of list) {
      if (block.type === "codeBlock") {
        const language =
          typeof block.props.language === "string" ? block.props.language : "";
        const source = inlineToPlainText(block.content);
        if (source.length > 0 && language && language !== "text") {
          const code = await highlightSource(source, language);
          if (code) highlighted.set(block.id, code);
        }
      }
      if (block.children.length > 0) await walk(block.children);
    }
  }

  await walk(blocks);
  return highlighted;
}
