import { TypstMathAdapterError } from "./math-adapter";
import { TypstRequestError } from "./request";
import type { TypstCompileErrorPayload } from "./types";

type ErrorLike = Error & {
  code?: string;
  sourceLine?: number;
  nodeType?: string;
  source?: string;
  details?: string[];
  stage?: TypstCompileErrorPayload["stage"];
};

export function typstErrorPayload(
  error: unknown,
  fallbackStage: TypstCompileErrorPayload["stage"] = "typst-generation",
): TypstCompileErrorPayload {
  const value: ErrorLike = error instanceof Error
    ? error as ErrorLike
    : new Error(String(error)) as ErrorLike;
  const stage = value.stage
    ?? (value instanceof TypstRequestError ? "request" : undefined)
    ?? (value instanceof TypstMathAdapterError ? "typst-generation" : undefined)
    ?? fallbackStage;
  return {
    stage,
    code: value.code ?? "TYPST_GENERATION_FAILED",
    message: value.message || "Typst PDFの生成に失敗しました。",
    sourceLine: value.sourceLine ?? (value instanceof TypstMathAdapterError ? value.sourceLine : undefined),
    nodeType: value.nodeType ?? (value instanceof TypstMathAdapterError ? "Math" : undefined),
    source: value.source ?? (value instanceof TypstMathAdapterError ? value.latexSource : undefined),
    details: value.details ?? (value instanceof TypstMathAdapterError ? value.details : undefined),
  };
}
