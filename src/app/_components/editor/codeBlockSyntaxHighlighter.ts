import { createHighlighter } from "shiki";

// Code block language configuration
// Add or remove languages here - changes will be applied to both BlockNote and Shiki
const codeBlockLanguages = {
  javascript: { name: "JavaScript", aliases: ["js"] },
  typescript: { name: "TypeScript", aliases: ["ts"] },
  python: { name: "Python", aliases: ["py"] },
  java: { name: "Java" },
  c: { name: "C" },
  cpp: { name: "C++" },
  go: { name: "Go" },
  ruby: { name: "Ruby" },
  php: { name: "PHP" },
  rust: { name: "Rust" },
  kotlin: { name: "Kotlin" },
  swift: { name: "Swift" },
  csharp: { name: "C#", aliases: ["cs"] },
  scala: { name: "Scala" },
  html: { name: "HTML" },
  css: { name: "CSS" },
  json: { name: "JSON" },
  yaml: { name: "YAML", aliases: ["yml"] },
  markdown: { name: "Markdown", aliases: ["md"] },
  sql: { name: "SQL" },
  bash: { name: "Bash", aliases: ["sh"] },
  powershell: { name: "PowerShell", aliases: ["ps"] },
  dart: { name: "Dart" },
  "objective-c": { name: "Objective-C", aliases: ["objc"] },
} as const;

// Derive the supported languages object for BlockNote
export const supportedLanguages = Object.fromEntries(
  Object.entries(codeBlockLanguages).map(([key, value]) => {
    const langConfig =
      "aliases" in value && value.aliases
        ? { name: value.name, aliases: [...value.aliases] } // Convert readonly array to mutable
        : { name: value.name };
    return [key, langConfig];
  }),
) as Record<string, { name: string; aliases?: string[] }>;

// Extract language IDs for Shiki highlighter
const shikiLanguageIds = Object.keys(codeBlockLanguages);

// Create the highlighter factory function for BlockNote
// Type mismatch between shiki and @blocknote/core shiki types - both use different versions of @shikijs/types
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */
export const createCodeBlockHighlighter = () =>
  createHighlighter({
    themes: ["github-dark"],
    langs: shikiLanguageIds,
  }) as any;
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return */

