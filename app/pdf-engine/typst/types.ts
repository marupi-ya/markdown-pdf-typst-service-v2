import type { Metadata, OutputMode } from "../../studio-core";
import type { StudioSettings } from "../../theme-settings";
import type { Mapping } from "../../math-c/syntax";
import type { MaterialAsset } from "../../extensions/registry";

export type TypstThemeId =
  | "prep-school-blue"
  | "prep-school-green"
  | "prep-school-burgundy"
  | "prep-school-purple"
  | "prep-school-brown"
  | "standard-blue"
  | "standard-green"
  | "modern-navy"
  | "soft-beige"
  | "academic-red"
  | "editorial-terracotta"
  | "editorial-navy"
  | "editorial-forest"
  | "editorial-plum"
  | "editorial-ochre";

export type TypstInlineNode =
  | { type:"InlineExtension"; extensionType:string; config:Mapping; sourceLine:number }
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
  semantic?: { exerciseId?: string; solutionFor?: string };
};

export type TypstBlockNode =
  | (TypstNodeBase & { type:"Extension"; extensionType:string; config:Mapping; raw:string; outputMode:"complete"|"questions"|"answers" })
  | (TypstNodeBase & { type:"Fallback"; extensionType:string; raw:string; message:string })
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
  materialAssets?:Record<string,MaterialAsset>;
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
  mediaType: MaterialAsset["mimeType"];
  encoding?:"base64";
};

export type GeneratedTypstProject = {
  ast: TypstDocumentAst;
  source: string;
  sourceMap: TypstSourceMapEntry[];
  assets: TypstProjectAsset[];
  expectedText: string[];
  warnings:TypstGenerationWarning[];
};
export type TypstGenerationWarning={code:string;message:string;sourceLine:number;nodeType:string};

export type TypstCompileErrorPayload = {
  stage: "request" | "markdown" | "typst-generation" | "compiler" | "validation";
  code: string;
  message: string;
  sourceLine?: number;
  nodeType?: string;
  source?: string;
  details?: string[];
};
