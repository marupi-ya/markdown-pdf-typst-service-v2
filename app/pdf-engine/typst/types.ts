import type { Metadata, OutputMode } from "../../studio-core";
import type { StudioSettings } from "../../theme-settings";

export type TypstThemeId =
  | "standard-blue"
  | "standard-green"
  | "modern-navy"
  | "soft-beige"
  | "academic-red";

export type TypstInlineNode =
  | { type: "InlineText"; value: string }
  | { type: "Strong"; children: TypstInlineNode[] }
  | { type: "Emphasis"; children: TypstInlineNode[] }
  | { type: "InlineMath"; latex: string; sourceLine: number };

export type TypstBreakPolicy = {
  keepTogether: boolean;
  keepWithNext: boolean;
  allowBreak: boolean;
};

export type TypstBoxVariant =
  | "learning-goals"
  | "explanation"
  | "definition"
  | "key-point"
  | "example"
  | "exercise"
  | "answer-question"
  | "solution"
  | "caution"
  | "summary";

type TypstNodeBase = {
  id: string;
  sourceLine: number;
  policy: TypstBreakPolicy;
};

export type TypstBlockNode =
  | (TypstNodeBase & { type: "Heading"; level: number; children: TypstInlineNode[] })
  | (TypstNodeBase & { type: "Paragraph"; children: TypstInlineNode[] })
  | (TypstNodeBase & { type: "DisplayMath"; latex: string })
  | (TypstNodeBase & { type: "List"; ordered: boolean; items: TypstInlineNode[][] })
  | (TypstNodeBase & { type: "Table"; header: TypstInlineNode[][]; rows: TypstInlineNode[][][] })
  | (TypstNodeBase & {
      type: "Problem" | "Answer" | "Explanation" | "Point" | "Example" | "Warning";
      variant: TypstBoxVariant;
      title: TypstInlineNode[];
      children: TypstBlockNode[];
    })
  | (TypstNodeBase & {
      type: "Figure";
      figureType: string;
      raw: string;
      params: Record<string, string>;
      caption: TypstInlineNode[];
      assetPath: string;
    })
  | (TypstNodeBase & { type: "PageBreak" })
  | (TypstNodeBase & { type: "Code"; language: string; value: string })
  | (TypstNodeBase & { type: "Divider" });

export type TypstDocumentAst = {
  type: "Document";
  metadata: Metadata;
  children: TypstBlockNode[];
};

export type TypstCompileRequest = {
  markdown: string;
  outputMode: Exclude<OutputMode, "split">;
  includeQuestionInAnswer: boolean;
  settings: StudioSettings;
  theme: TypstThemeId;
  mermaidAssets?: Record<string, string>;
};

export type TypstSourceMapEntry = {
  generatedStartLine: number;
  generatedEndLine: number;
  sourceLine: number;
  nodeType: TypstBlockNode["type"] | "Document";
};

export type TypstProjectAsset = {
  path: string;
  contents: string;
  mediaType: "image/svg+xml";
};

export type GeneratedTypstProject = {
  ast: TypstDocumentAst;
  source: string;
  sourceMap: TypstSourceMapEntry[];
  assets: TypstProjectAsset[];
  expectedText: string[];
};

export type TypstCompileErrorPayload = {
  stage: "request" | "markdown" | "typst-generation" | "compiler" | "validation";
  code: string;
  message: string;
  sourceLine?: number;
  nodeType?: string;
  source?: string;
  details?: string[];
};
