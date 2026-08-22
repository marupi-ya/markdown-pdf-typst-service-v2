import { buildTypstAst } from "./ast";
import { sanitizeMermaidSvg } from "./figure-svg";
import type {
  TypstBlockNode,
  TypstCompileErrorPayload,
  TypstCompileRequest,
} from "./types";

export type TypstGenerationPhase = "markdown" | "typst" | "pdf" | "complete";

export class TypstClientError extends Error {
  payload: TypstCompileErrorPayload;

  constructor(payload: TypstCompileErrorPayload) {
    super(payload.message);
    this.name = "TypstClientError";
    this.payload = payload;
  }
}

function mermaidFigures(nodes: TypstBlockNode[]) {
  const result: Extract<TypstBlockNode, { type: "Figure" }>[] = [];
  const visit = (node: TypstBlockNode) => {
    if (node.type === "Figure" && node.figureType === "mermaid") result.push(node);
    if (
      node.type === "Problem"
      || node.type === "Answer"
      || node.type === "Explanation"
      || node.type === "Point"
      || node.type === "Example"
      || node.type === "Warning"
    ) node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return result;
}

async function createMermaidAssets(request: TypstCompileRequest) {
  const ast = buildTypstAst(request.markdown, request.outputMode, request.includeQuestionInAnswer);
  const figures = mermaidFigures(ast.children);
  if (!figures.length) return {};
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    flowchart: { htmlLabels: false },
    theme: "base",
    themeVariables: {
      primaryColor: "#e7f4f2",
      primaryTextColor: "#173b39",
      primaryBorderColor: "#2d8a84",
      lineColor: "#317a76",
      secondaryColor: "#fff8e7",
      fontFamily: '"Noto Sans Japanese", "Noto Sans JP", sans-serif',
    },
  });
  const assets: Record<string, string> = {};
  for (const [index, figure] of figures.entries()) {
    try {
      const rendered = await mermaid.render(`typst-mermaid-${Date.now().toString(36)}-${index}`, figure.raw);
      assets[figure.assetPath] = sanitizeMermaidSvg(rendered.svg);
    } catch (error) {
      throw new TypstClientError({
        stage: "typst-generation",
        code: "MERMAID_SVG_GENERATION_FAILED",
        message: `Markdown ${figure.sourceLine}行目のMermaid図をSVGへ変換できません: ${error instanceof Error ? error.message : String(error)}`,
        sourceLine: figure.sourceLine,
        nodeType: "Figure",
        source: figure.raw,
      });
    }
  }
  return assets;
}

async function responseError(response: Response): Promise<TypstClientError> {
  try {
    const payload = await response.json() as TypstCompileErrorPayload;
    if (payload?.message && payload?.code && payload?.stage) return new TypstClientError(payload);
  } catch {}
  return new TypstClientError({
    stage: "compiler",
    code: "TYPST_HTTP_ERROR",
    message: `Typst PDF生成サービスがHTTP ${response.status}を返しました。`,
  });
}

export async function compileTypstPdf(
  request: TypstCompileRequest,
  onPhase: (phase: TypstGenerationPhase) => void = () => {},
) {
  onPhase("markdown");
  buildTypstAst(request.markdown, request.outputMode, request.includeQuestionInAnswer);
  onPhase("typst");
  const mermaidAssets = await createMermaidAssets(request);
  onPhase("pdf");
  const response = await fetch("/api/typst/compile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...request, mermaidAssets }),
  });
  if (!response.ok) throw await responseError(response);
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/pdf")) {
    throw new TypstClientError({ stage: "validation", code: "INVALID_PDF_RESPONSE", message: "Typstサービスの応答がPDFではありません。" });
  }
  const blob = await response.blob();
  if (blob.size < 1000) throw new TypstClientError({ stage: "validation", code: "EMPTY_PDF", message: "生成PDFが空です。" });
  onPhase("complete");
  return {
    blob,
    pageCount: Math.max(1, Number(response.headers.get("x-pdf-pages") ?? 1)),
    typstVersion: response.headers.get("x-typst-version") ?? "Typst",
    textValidation: response.headers.get("x-text-validation") ?? "unavailable",
  };
}

export async function getTypstStatus() {
  const response = await fetch("/api/typst/status", { cache: "no-store" });
  const body = await response.json() as { available?: boolean; version?: string; message?: string; code?: string };
  return {
    available: response.ok && body.available === true,
    version: body.version ?? "",
    message: body.message ?? (response.ok ? "Typst CLIを利用できます。" : "Typst CLIを利用できません。"),
    code: body.code ?? "",
  };
}
