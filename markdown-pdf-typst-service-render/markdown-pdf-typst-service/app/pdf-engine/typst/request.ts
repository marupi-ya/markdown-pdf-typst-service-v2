import type { StudioSettings } from "../../theme-settings";
import type { TypstCompileRequest, TypstThemeId } from "./types";

const THEMES = new Set<TypstThemeId>([
  "standard-blue",
  "standard-green",
  "modern-navy",
  "soft-beige",
  "academic-red",
]);

const OUTPUT_MODES = new Set(["complete", "questions", "answers"]);
const MAX_MARKDOWN_BYTES = 1_500_000;
const MAX_MERMAID_ASSETS = 80;
const MAX_SVG_BYTES = 800_000;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isStudioSettings(value: unknown): value is StudioSettings {
  if (!value || typeof value !== "object") return false;
  const settings = value as Partial<StudioSettings>;
  return [
    settings.fontSize,
    settings.lineHeight,
    settings.marginTop,
    settings.marginRight,
    settings.marginBottom,
    settings.marginLeft,
    settings.headingSize,
  ].every(isFiniteNumber)
    && typeof settings.includeCover === "boolean"
    && typeof settings.showHeader === "boolean"
    && typeof settings.showFooter === "boolean"
    && typeof settings.copyright === "string";
}

export class TypstRequestError extends Error {
  code = "INVALID_TYPST_REQUEST";

  constructor(message: string) {
    super(message);
    this.name = "TypstRequestError";
  }
}

export function validateTypstCompileRequest(value: unknown): TypstCompileRequest {
  if (!value || typeof value !== "object") throw new TypstRequestError("PDF生成リクエストがJSONオブジェクトではありません。");
  const request = value as Partial<TypstCompileRequest>;
  if (typeof request.markdown !== "string" || !request.markdown.trim()) {
    throw new TypstRequestError("Markdown本文が空です。");
  }
  if (new TextEncoder().encode(request.markdown).byteLength > MAX_MARKDOWN_BYTES) {
    throw new TypstRequestError("Markdown本文が1.5MBの上限を超えています。");
  }
  if (!OUTPUT_MODES.has(request.outputMode ?? "")) throw new TypstRequestError("出力モードが正しくありません。");
  if (typeof request.includeQuestionInAnswer !== "boolean") throw new TypstRequestError("解答版の問題文設定が正しくありません。");
  if (!request.theme || !THEMES.has(request.theme)) throw new TypstRequestError("Typstテーマが正しくありません。");
  if (!isStudioSettings(request.settings)) throw new TypstRequestError("教材レイアウト設定が正しくありません。");

  const assets = request.mermaidAssets ?? {};
  const entries = Object.entries(assets);
  if (entries.length > MAX_MERMAID_ASSETS) throw new TypstRequestError("Mermaid図が80件の上限を超えています。");
  for (const [path, svg] of entries) {
    if (!/^assets\/figure-\d+-mermaid\.svg$/u.test(path)) {
      throw new TypstRequestError(`許可されていないMermaid資産パスです: ${path}`);
    }
    if (typeof svg !== "string" || new TextEncoder().encode(svg).byteLength > MAX_SVG_BYTES) {
      throw new TypstRequestError(`${path} のSVGが800KBの上限を超えています。`);
    }
  }

  return request as TypstCompileRequest;
}

