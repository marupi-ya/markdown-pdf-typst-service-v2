import {
  extensionRegistry,
  object,
  string,
  array,
  id,
  boolean,
  type ExtensionDefinition,
  type ExtensionRenderContext,
  type ValidationContext,
} from "./registry";
import { referenceKey, referenceLabel, anchorMarkup } from "./document";
import type { Mapping } from "../math-c/syntax";

const index = {
  type: "integer" as const,
  minimum: 0,
  maximum: 12000,
  required: true,
};
const annotations = array(
  object({
    id: id(),
    start: index,
    end: index,
    role: string({
      enum: [
        "S",
        "V",
        "O",
        "C",
        "M",
        "phrase",
        "clause",
        "modifier",
        "relative",
        "conjunction",
        "ellipsis",
        "apposition",
      ],
      default: "M",
    }),
    label: string({ default: "", maxLength: 100 }),
    parent: id(false),
    relation: id(false),
    note: string({ default: "", maxLength: 2000 }),
    style: string({
      enum: ["underline", "overline", "bracket", "none"],
      default: "underline",
    }),
  }),
  { default: [], maxItems: 120 }
);
const functionGroups = array(
  object({
    id: id(),
    start: index,
    end: index,
    function: string({ required: true, enum: ["noun", "adjective", "adverb"] }),
  }),
  { default: [], maxItems: 120 }
);
const functionGlyphs: Record<string, readonly [string, string]> = {
  noun: ["〈", "〉"], adjective: ["〔", "〕"], adverb: ["(", ")"],
};
export function validateFunctionGroups(text: string, groups: Mapping[], context: ValidationContext) {
  const length = Array.from(text).length;
  const ids = new Set<string>();
  groups.forEach((group, i) => {
    if (ids.has(String(group.id))) context.issue(`functionGroups[${i}].id`, "DUPLICATE_ID", "functionGroups のIDは文内で一意にしてください。");
    ids.add(String(group.id));
    if (Number(group.start) >= Number(group.end) || Number(group.end) > length)
      context.issue(`functionGroups[${i}].end`, "INVALID_FUNCTION_GROUP_SPAN", `範囲はUnicodeコードポイントで 0 ≤ start < end ≤ ${length} にしてください。`);
    for (let j = 0; j < i; j++) {
      const other = groups[j], a = Number(group.start), b = Number(group.end), c = Number(other.start), d = Number(other.end);
      if (a === c && b === d) context.issue(`functionGroups[${i}]`, "DUPLICATE_FUNCTION_GROUP_RANGE", "同じ範囲に複数の機能を指定できません。");
      else if ((a < c && c < b && b < d) || (c < a && a < d && d < b))
        context.issue(`functionGroups[${i}]`, "CROSSING_FUNCTION_GROUPS", "機能の範囲は離すか、完全な入れ子にしてください。交差する範囲は指定できません。");
    }
  });
}
export type FunctionGroupSegment =
  | { kind: "source"; start: number; end: number; text: string }
  | { kind: "delimiter"; boundary: number; edge: "open" | "close"; id: string; function: string; text: string };
/** Separate source from generated glyphs; never strip literal source brackets. */
export function functionGroupSegments(text: string, groups: Mapping[]): FunctionGroupSegment[] {
  const chars = Array.from(text), length = chars.length;
  const points = [...new Set([0, length, ...groups.flatMap(group => [Number(group.start), Number(group.end)]).filter(point => point >= 0 && point <= length)])].sort((a, b) => a - b);
  const result: FunctionGroupSegment[] = [];
  for (let i = 0; i < points.length; i++) {
    const boundary = points[i];
    const closing = groups.filter(group => Number(group.end) === boundary).sort((a, b) => Number(b.start) - Number(a.start));
    const opening = groups.filter(group => Number(group.start) === boundary).sort((a, b) => Number(b.end) - Number(a.end));
    for (const [edge, matches] of [["close", closing], ["open", opening]] as const)
      for (const group of matches) result.push({ kind: "delimiter", boundary, edge, id: String(group.id), function: String(group.function), text: functionGlyphs[String(group.function)][edge === "open" ? 0 : 1] });
    const end = points[i + 1];
    if (end !== undefined && end > boundary) result.push({ kind: "source", start: boundary, end, text: chars.slice(boundary, end).join("") });
  }
  return result;
}
const levels = object({
  complete: string({
    enum: ["plain", "minimal", "detailed"],
    default: "minimal",
  }),
  questions: string({
    enum: ["plain", "minimal", "detailed"],
    default: "plain",
  }),
  answers: string({
    enum: ["plain", "minimal", "detailed"],
    default: "detailed",
  }),
});
const target = object({
  passageId: id(),
  paragraphId: id(false),
  sentenceId: id(false),
  spanId: id(false),
});
const vocabulary = object({
  word: string({ required: true, maxLength: 200 }),
  meaning: string({ required: true, maxLength: 2000 }),
  note: string({ default: "", maxLength: 2000 }),
  target,
});
const sentence = object({
  id: id(),
  originalText: string({ required: true, minLength: 1 }),
  annotations,
});
const list = (value: unknown) => value as Mapping[];
export const englishTargetKey = (value: Mapping) =>
  referenceKey(
    "passage",
    String(value.passageId),
    ...["paragraphId", "sentenceId", "spanId"].flatMap((key) =>
      value[key] ? [String(value[key])] : []
    )
  );
const spanText = (text: string, span: Mapping) =>
  Array.from(text).slice(Number(span.start), Number(span.end)).join("");
export function validateEnglishSpans(
  text: string,
  spans: Mapping[],
  context: ValidationContext,
  path = "annotations"
) {
  const length = Array.from(text).length,
    ids = new Map<string, Mapping>();
  spans.forEach((span, i) => {
    const key = String(span.id);
    if (ids.has(key))
      context.issue(
        `${path}[${i}].id`,
        "DUPLICATE_ID",
        `注釈ID ${key} は文内で一意にしてください。`
      );
    ids.set(key, span);
    if (Number(span.start) >= Number(span.end) || Number(span.end) > length)
      context.issue(
        `${path}[${i}].end`,
        "INVALID_SPAN",
        `範囲はUnicodeコードポイントで 0 ≤ start < end ≤ ${length} にしてください。`
      );
  });
  spans.forEach((span, i) => {
    if (span.relation && !ids.has(String(span.relation)))
      context.issue(
        `${path}[${i}].relation`,
        "INVALID_REFERENCE",
        "relation は同じ文の注釈IDを指定してください。"
      );
    if (span.parent) {
      const parent = ids.get(String(span.parent));
      if (
        !parent ||
        span.parent === span.id ||
        Number(parent.start) > Number(span.start) ||
        Number(parent.end) < Number(span.end)
      )
        context.issue(
          `${path}[${i}].parent`,
          "INVALID_REFERENCE",
          "parent は対象範囲を含む別の注釈IDにしてください。"
        );
      const seen = new Set([String(span.id)]);
      let cursor = parent;
      for (let step = 0; cursor?.parent && step <= spans.length; step++) {
        const next = String(cursor.parent);
        if (seen.has(next)) {
          context.issue(
            `${path}[${i}].parent`,
            "ANNOTATION_CYCLE",
            "parent に循環があります。"
          );
          break;
        }
        seen.add(next);
        cursor = ids.get(next);
      }
    }
  });
}
function validateTarget(
  value: Mapping,
  context: ValidationContext,
  path: string
) {
  if (value.sentenceId && !value.paragraphId)
    context.issue(
      path,
      "INVALID_REFERENCE",
      "sentenceId には paragraphId が必要です。"
    );
  if (value.spanId && !value.sentenceId)
    context.issue(
      path,
      "INVALID_REFERENCE",
      "spanId には sentenceId が必要です。"
    );
}
const safeAnchor = (context: ExtensionRenderContext, key: string) =>
  context.references?.[key] ? anchorMarkup(key, context.sourceLine) : "";
function level(
  config: Mapping,
  context: Pick<ExtensionRenderContext, "outputMode">
) {
  return String((config.levels as Mapping)[context.outputMode]);
}
/** Accept color data, never executable Typst; absent/invalid colors stay monochrome. */
function annotationFill(color?: string) {
  return color && /^#[0-9a-f]{6}$/iu.test(color) ? `rgb(${JSON.stringify(color)})` : undefined;
}
/** The sentence is segmented only for decoration; concatenation is invariant. */
export function renderAnnotatedSentence(
  text: string,
  spans: Mapping[],
  display: string,
  context: ExtensionRenderContext,
  key?: string[],
  annotationAccent?: string,
  groups: Mapping[] = []
) {
  // Plain must keep the legacy segmentation and output, including metadata.
  const visibleGroups = display === "plain" ? [] : groups;
  if (!spans.length && !visibleGroups.length) return context.text(text);
  const groupEdges = functionGroupSegments(text, visibleGroups).filter((segment): segment is Extract<FunctionGroupSegment, { kind: "delimiter" }> => segment.kind === "delimiter");
  const groupFill = annotationFill(context.annotationAccent);
  const glyphs = (boundary: number, edge: "open" | "close") => groupEdges
    .filter(segment => segment.boundary === boundary && segment.edge === edge)
    .map(segment => `#text(overhang:false${groupFill ? `,fill:${groupFill}` : ""})[${context.text(segment.text)}]`).join("");
  const fill = annotationFill(annotationAccent);
  const stroke = fill ? `0.65pt + ${fill}` : "0.65pt";
  const points = [
    ...new Set([
      0,
      Array.from(text).length,
      ...spans.flatMap((span) => [Number(span.start), Number(span.end)]),
      ...groupEdges.map(segment => segment.boundary),
    ]),
  ].sort((a, b) => a - b);
  const chars = Array.from(text);
  return points
    .slice(0, -1)
    .map((start, i) => {
      const end = points[i + 1],
        active = spans.filter(
          (span) => Number(span.start) <= start && Number(span.end) >= end
        );
      let body = context.text(chars.slice(start, end).join(""));
      if (
        display !== "plain" &&
        active.some(
          (span) => span.style === "underline" || span.style === "bracket"
        )
      )
        body = `#underline(stroke:${stroke},offset:2pt)[${body}]`;
      if (
        display === "detailed" &&
        active.some((span) => span.style === "overline")
      )
        body = `#overline(stroke:${stroke})[${body}]`;
      const brackets = active.filter((span) => span.style === "bracket");
      const tick =
        `#box(width:0pt)[#line(start:(0pt,-0.8em),end:(0pt,0.2em),stroke:${stroke})]`;
      if (
        display === "detailed" &&
        brackets.some((span) => Number(span.start) === start)
      )
        body = tick + body;
      if (
        display === "detailed" &&
        brackets.some((span) => Number(span.end) === end)
      )
        body += tick;
      const anchors = key
        ? spans
            .filter((span) => Number(span.start) === start)
            .map((span) =>
              safeAnchor(context, referenceKey(...key, String(span.id)))
            )
            .join("")
        : "";
      return anchors + glyphs(start, "open") + body + glyphs(end, "close");
    })
    .join("");
}
function annotationLegend(
  text: string,
  spans: Mapping[],
  display: string,
  context: ExtensionRenderContext
) {
  if (display === "plain" || !spans.length) return "";
  const items = spans
    .filter(
      (span) =>
        display === "detailed" ||
        ["S", "V", "O", "C", "M"].includes(String(span.role))
    )
    .map((span) => {
      const description = `${span.label || span.role} [${span.id}]: “${spanText(
        text,
        span
      )}”`;
      const details =
        display === "detailed"
          ? `${span.parent ? ` / parent: ${span.parent}` : ""}${
              span.relation ? ` → ${span.relation}` : ""
            }${span.note ? ` / ${span.note}` : ""}`
          : "";
      return `#par[${context.text(description + details)}]`;
    });
  return items.length
    ? `#v(5pt,weak:false)
#block(breakable:true,above:3pt,below:5pt)[#set text(size:9pt)\n${items.join(
        "\n"
      )}]#v(5pt,weak:false)`
    : "";
}
/** Interlinear is opt-in. Complex ranges keep the proven, breakable renderer. */
export function interlinearFallbackReason(text: string, spans: Mapping[]) {
  const sorted = [...spans].sort((a, b) => Number(a.start) - Number(b.start));
  if (sorted.some((span, i) => i > 0 && Number(span.start) < Number(sorted[i - 1].end)))
    return "overlap";
  if (spans.some((span) => /[\r\n\t]/u.test(spanText(text, span))))
    return "annotation-line-break";
  return undefined;
}

/** Every source code point occurs exactly once, including inter-span whitespace. */
export function interlinearSegments(text: string, spans: Mapping[]) {
  const chars = Array.from(text);
  const result: Array<{ text: string; span?: Mapping }> = [];
  let cursor = 0;
  for (const span of [...spans].sort((a, b) => Number(a.start) - Number(b.start))) {
    const start = Number(span.start), end = Number(span.end);
    if (start > cursor) result.push({ text: chars.slice(cursor, start).join("") });
    result.push({ text: chars.slice(start, end).join(""), span });
    cursor = end;
  }
  if (cursor < chars.length) result.push({ text: chars.slice(cursor).join("") });
  return result;
}

function interlinearDetails(
  text: string,
  spans: Mapping[],
  display: string,
  context: ExtensionRenderContext,
  all = false
) {
  const fill = annotationFill(context.annotationAccent);
  const describe = (span: Mapping) => `${span.role} “${spanText(text, span)}”`;
  const reference = (id: unknown) => {
    const target = spans.find((span) => span.id === id);
    return target ? describe(target) : String(id);
  };
  const visible = spans.filter((span) => display === "detailed" || ["S", "V", "O", "C", "M"].includes(String(span.role)));
  const items = visible.filter((span) => all || (span.label && span.label !== span.role) || (display === "detailed" && (span.parent || span.relation || span.note)))
    .map((span) => {
      const label = span.label && span.label !== span.role ? ` / ${span.label}` : "";
      const details = display === "detailed"
        ? `${span.parent ? ` / parent: ${reference(span.parent)}` : ""}${span.relation ? ` → ${reference(span.relation)}` : ""}${span.note ? ` / ${span.note}` : ""}`
        : "";
      return `#par[${context.text(`${describe(span)}${all ? ` [${span.id}]` : ""}${label}${details}`)}]`;
    });
  return items.length ? `#block(breakable:true,above:4pt,below:2pt)[#set text(size:9pt${fill ? `,fill:${fill}` : ""})\n#set par(spacing:3pt)\n${items.join("\n")}]` : "";
}

function interlinearDiagnostic(id: string, used: string, reason?: string) {
  return `#metadata((kind:"syntax-annotation-layout",id:${JSON.stringify(id)},requested:"interlinear",used:${JSON.stringify(used)},reason:${reason ? JSON.stringify(reason) : "none"}))`;
}

function renderInterlinear(
  id: string,
  text: string,
  spans: Mapping[],
  display: string,
  context: ExtensionRenderContext,
  groups: Mapping[] = []
) {
  const fill = annotationFill(context.annotationAccent);
  const fallback = (reason: string) => `${interlinearDiagnostic(id, "legend", reason)}\n#par[${renderAnnotatedSentence(text, spans, display, context, undefined, context.annotationAccent, groups)}]\n${interlinearDetails(text, spans, display, context, true)}`;
  const reason = interlinearFallbackReason(text, spans);
  if (reason) return fallback(reason);
  const units: string[] = [];
  let sourceOffset = 0;
  const content = interlinearSegments(text, spans).map((segment) => {
    const start = sourceOffset, end = start + Array.from(segment.text).length;
    sourceOffset = end;
    const localGroups = groups.filter(group => Number(group.start) < end && Number(group.end) > start)
      .map(group => ({ ...group, start: Number(group.start) - start, end: Number(group.end) - start }));
    if (!segment.span) return localGroups.length
      ? renderAnnotatedSentence(segment.text, [], display, context, undefined, context.annotationAccent, localGroups)
      : context.text(segment.text);
    const span: Mapping = { ...segment.span, start: 0, end: Array.from(segment.text).length };
    const body = renderAnnotatedSentence(segment.text, [span], display, context, undefined, context.annotationAccent, localGroups);
    const caption = display === "detailed" || ["S", "V", "O", "C", "M"].includes(String(span.role))
      ? String(span.role) : "";
    const index = units.length;
    units.push(`([${body}], [${context.text(caption)}])`);
    return `#syntax-unit(..syntax-units.at(${index}))`;
  }).join("");
  // Never guess a font's baseline or fit by character count. Typst measures the
  // actual text at the active font/size. The first row ends at its baseline;
  // the explicit box baseline keeps unannotated punctuation on that same row.
  return `#layout(size => context {
  let syntax-units = (${units.join(",")} ,)
  let syntax-label(body) = text(size:8pt,weight:"bold",${fill ? `fill:${fill},` : ""}body)
  let syntax-unit(body,caption) = {
    let main = text(bottom-edge:"baseline",body)
    box(baseline:(at:top,shift:-measure(main).height),stack(dir:ttb,spacing:5pt,main,align(center,syntax-label(caption))))
  }
  if syntax-units.any(unit => calc.max(measure(unit.at(0)).width,measure(syntax-label(unit.at(1))).width) > size.width) {
    [${fallback("unit-exceeds-line-width")}]
  } else {
    [${interlinearDiagnostic(id, "interlinear")}\n#set par(leading:0.65em)\n#par[${content}]\n${interlinearDetails(text, spans, display, context)}]
  }
})`;
}
/** B: native vector soft highlights. Source and functional delimiters stay separate. */
function renderSoftHighlight(
  id: string, text: string, spans: Mapping[], display: string,
  context: ExtensionRenderContext, groups: Mapping[] = []
) {
  const accent = annotationFill(context.annotationAccent) || 'rgb("#8d4b5c")';
  const diag = (used: string, reason?: string) => `#metadata((kind:"syntax-annotation-layout",id:${JSON.stringify(id)},requested:"interlinear",used:${JSON.stringify(used)},reason:${reason ? JSON.stringify(reason) : "none"},visualStyle:"soft-highlight"))`;
  const reason = interlinearFallbackReason(text, spans);
  if (reason) return `${diag("legend", reason)}\n#par[${renderAnnotatedSentence(text, [], display, context, undefined, context.annotationAccent, groups)}]\n${interlinearDetails(text, spans, display, context, true)}`;
  let offset = 0;
  const units: string[] = [];
  const content = interlinearSegments(text, spans).map(segment => {
    const start = offset, end = start + Array.from(segment.text).length;
    offset = end;
    const local = (a: number, b: number) => groups.filter(g => Number(g.start) < b && Number(g.end) > a)
      .map(g => ({...g, start:Number(g.start)-a, end:Number(g.end)-a}));
    if (!segment.span) return renderAnnotatedSentence(segment.text, [], display, context, undefined, context.annotationAccent, local(start, end));
    const span = segment.span;
    const caption = display === "detailed" || ["S","V","O","C","M"].includes(String(span.role)) ? String(!["S","V","O","C","M"].includes(String(span.role)) && span.label ? span.label : span.role) : "";
    const highlighted = groups.some(g => Number(g.start) < end && Number(g.end) > start);
    // Each token retains its exact source whitespace. Packing is measured by Typst,
    // not guessed from character counts. Functional edge glyphs occur once only.
    let tokenOffset = start;
    const tokens = (segment.text.match(/\S+\s*|\s+/gu) || []).map(token => {
      const a = tokenOffset, b = a + Array.from(token).length;
      tokenOffset = b;
      const body = renderAnnotatedSentence(token, [], display, context, undefined, context.annotationAccent, local(a,b));
      return `[${body}]`;
    });
    const n = units.length;
    units.push(`(tokens:(${tokens.join(",")},),caption:[${context.text(caption)}],highlight:${highlighted},verb:${span.role === "V" && span.style !== "none"})`);
    return `#soft-place(soft-units.at(${n}))`;
  }).join("");
  return `#layout(size => context {
    let soft-units = (${units.join(",")},)
    let soft-label(caption) = box(width:calc.min(measure(text(size:9pt,weight:"bold",caption)).width + 10pt,size.width - 5pt),fill:${accent},radius:4pt,inset:(x:5pt,y:1.5pt),text(size:9pt,weight:"bold",fill:white,caption))
    let soft-piece(body,caption,highlight,verb) = {
      let ink = if verb { underline(stroke:0.75pt + ${accent},offset:2pt,body) } else { body }
      let main = box(fill:if highlight { rgb("#f4dfe5") } else { none },radius:4pt,inset:(x:2.5pt,y:3pt),text(bottom-edge:"baseline",ink))
      box(baseline:(at:top,shift:-(measure(main).height - 3pt)),stack(dir:ttb,spacing:4pt,main,align(center,soft-label(caption))))
    }
    let soft-place(unit) = {
      let capacity = size.width - 7pt
      let chunks = ()
      let current = []
      for token in unit.tokens {
        if measure(token).width > capacity { panic("Soft highlight token exceeds panel width; split or redesign source annotation without shrinking text.") }
        if measure(current + token).width > capacity and current != [] {
          chunks.push(current)
          current = token
        } else { current += token }
      }
      if current != [] { chunks.push(current) }
      for (i,chunk) in chunks.enumerate() {
        if i > 0 { linebreak() }
        soft-piece(chunk,unit.caption,unit.highlight,unit.verb)
      }
    }
    [${diag("interlinear")}\n#set par(leading:0.9em)\n#par[${content}]\n${interlinearDetails(text, spans, display, context).replace("above:4pt", "above:8pt").replace("spacing:3pt", "spacing:5pt,leading:0.4em")}]
  })`;
}

const tests = [
  "english-extensions.test.ts",
  "english-interlinear.test.ts",
  "english-function-groups.test.ts",
  "pdf-regression:english-grammar",
  "pdf-regression:english-reading",
];
const syntax: ExtensionDefinition = {
  type: "syntax-annotation",
  kind: "content",
  version: 1,
  fallback: "source-visible",
  schema: object({
    id: id(),
    originalText: string({ required: true, minLength: 1 }),
    annotations,
    functionGroups,
    presentation: string({ enum: ["legend", "interlinear"], default: "legend" }),
    visualStyle: string({ enum: ["classic", "soft-highlight"], default: "classic" }),
    levels: { ...levels, default: {} },
  }),
  validate(config, context) {
    validateEnglishSpans(
      String(config.originalText),
      list(config.annotations),
      context
    );
    validateFunctionGroups(String(config.originalText), list(config.functionGroups), context);
    if (config.presentation === "interlinear") {
      const reason = interlinearFallbackReason(String(config.originalText), list(config.annotations));
      if (reason) context.issue("presentation", "INTERLINEAR_FALLBACK_" + reason.toUpperCase().replaceAll("-", "_"), "重複・入れ子または注釈内改行のため、原文と注釈を保持した凡例表示を使用します。", "warning");
    }
  },
  render(config, context) {
    const text = String(config.originalText),
      spans = list(config.annotations),
      groups = list(config.functionGroups),
      display = level(config, context);
    if (config.presentation === "interlinear" && config.visualStyle === "soft-highlight" && display !== "plain" && spans.length)
      return `#block(breakable:true,above:8pt,below:8pt,fill:rgb("#faf3f5"),radius:7pt,inset:9pt)[#set par(justify:false)\n${renderSoftHighlight(String(config.id), text, spans, display, context, groups)}]`;
    if (config.presentation === "interlinear" && display !== "plain" && spans.length)
      return `#block(breakable:true,above:6pt,below:6pt)[#set par(justify:false)\n${renderInterlinear(String(config.id), text, spans, display, context, groups)}]`;
    return `#block(breakable:true,above:6pt,below:6pt)[#set par(justify:false)\n#par[${renderAnnotatedSentence(
      text,
      spans,
      display,
      context,
      undefined,
      undefined,
      groups
    )}]\n${annotationLegend(text, spans, display, context)}]`;
  },
  textSamples: (config) => [String(config.originalText)],
  documentation: {
    summary:
      "原文とコードポイント範囲・役割・親子/修飾関係を分離した英文注釈。",
    restrictions: [
      "start/end は0始まり、Unicodeコードポイント、endは範囲に含まない。UTF-16の添字ではない。",
      "原文はplain text。装飾はannotationsに指定し、Markdownの記号を文字数へ混在させない。",
      "functionGroups は任意の独立した機能注釈。id/start/end/function（noun・adjective・adverb）を指定し、〈〉・〔〕・()を原文の範囲に対応して表示する。文法機能の推定はしない。",
      "functionGroups の範囲は離すか完全な入れ子にする。同一範囲・交差・不正範囲はエラー。plain では記号やIDを出力しない。未指定/空配列は従来出力と同一。",
      "S/V等は指定済みの情報のみ。minimal は下線と主要役割凡例、detailed は上線・括弧線・関係・noteも表示。",
      "重なる範囲は装飾を合成する。弧状の依存矢印ではなく、対象IDと範囲を併記した関係凡例を使う。",
      "visualStyle: soft-highlight はinterlinear専用のBデザイン。淡色背景・役割バッジ・機能括弧を使い、装飾縦線/上線は描かない。plainとclassicは従来同一。長い範囲は実測語境界で折り返す。",
      "presentation: interlinear は原文直下に役割を配置する任意表示。未指定/legend は従来表示のまま。plain に注釈は出さない。",
      "interlinear は重複・入れ子・注釈内改行、または実測で行幅を超える区間では全情報を保持した凡例へ切り替える。schema警告とTypst metadata(kind: syntax-annotation-layout)で検出可能。関係は指定済みの対象役割・対象語を表示し、推定しない。",
    ],
    errorExample:
      "id: bad\noriginalText: I run.\nannotations:\n  - id: V\n    start: 9\n    end: 20\n    role: V",
  },
  examples: [
    { name: "minimal", source: "id: greeting\noriginalText: Hello, world." },
    {
      name: "standard",
      source:
        "id: svo\noriginalText: Students read books.\nannotations:\n  - id: subject\n    start: 0\n    end: 8\n    role: S\n  - id: verb\n    start: 9\n    end: 13\n    role: V\n  - id: object\n    start: 14\n    end: 19\n    role: O",
    },
  ],
  tests,
};
const translation: ExtensionDefinition = {
  type: "translation-pair",
  kind: "content",
  version: 1,
  fallback: "source-visible",
  schema: object({
    pairs: array(
      object({
        id: id(),
        number: string({ default: "", maxLength: 80 }),
        originalText: string({ required: true, minLength: 1 }),
        translation: string({ required: true, minLength: 1 }),
        vocabulary: array(
          object({
            word: string({ required: true }),
            meaning: string({ required: true }),
            note: string({ default: "" }),
          }),
          { default: [], maxItems: 100 }
        ),
        note: string({ default: "" }),
      }),
      { required: true, minItems: 1, maxItems: 100 }
    ),
  }),
  validate(config, context) {
    const ids = new Set<string>();
    list(config.pairs).forEach((pair, i) => {
      if (ids.has(String(pair.id)))
        context.issue(
          `pairs[${i}].id`,
          "DUPLICATE_ID",
          "対訳IDが重複しています。"
        );
      ids.add(String(pair.id));
    });
  },
  render(config, context) {
    return list(config.pairs)
      .map(
        (pair, i) =>
          `#block(breakable:${String(
            String(pair.originalText).length + String(pair.translation).length >
              350
          )},above:6pt,below:8pt)[#set par(justify:false)\n#strong[${context.text(
            String(pair.number || `Pair ${i + 1}`)
          )}]\n#par[${context.inline(
            String(pair.originalText)
          )}]\n#par[${context.inline(String(pair.translation))}]\n${list(
            pair.vocabulary
          )
            .map(
              (word) =>
                `#par[${context.text(
                  `${word.word}: ${word.meaning}${
                    word.note ? ` / ${word.note}` : ""
                  }`
                )}]`
            )
            .join("\n")}\n${
            pair.note ? `#par[${context.inline(String(pair.note))}]` : ""
          }]`
      )
      .join("\n");
  },
  textSamples: (config) =>
    list(config.pairs)
      .flatMap((pair) => [
        String(pair.originalText),
        String(pair.translation),
        ...list(pair.vocabulary).map((word) => String(word.meaning)),
      ])
      .map((text) => text.replace(/\*{1,2}/gu, "")),
  documentation: {
    summary: "英文・和訳・語注・補足・番号を段落単位で近接させる対訳。",
    restrictions: [
      "2列の高さ合わせをしない。短文対は近接保持、長文対は自然に改ページ。",
      "pairs 内の原文は一度だけ保持。文法推定・翻訳生成はしない。",
    ],
    errorExample: "pairs:\n  - id: p1\n    originalText: Hello.",
  },
  examples: [
    {
      name: "minimal",
      source:
        "pairs:\n  - id: p1\n    originalText: I like music.\n    translation: 私は音楽が好きです。",
    },
    {
      name: "standard",
      source:
        'pairs:\n  - id: p1\n    number: Paragraph 1\n    originalText: A well-known student said, "Don\'t give up."\n    translation: よく知られた生徒は「諦めないで」と言った。\n    vocabulary:\n      - word: give up\n        meaning: 諦める\n    note: ハイフンと引用符を保つ。',
    },
  ],
  tests,
};
function targetReference(
  value: Mapping,
  context: ExtensionRenderContext,
  label: string
) {
  const key = englishTargetKey(value),
    anchor = context.references?.[key];
  return anchor
    ? `#link(label(${JSON.stringify(referenceLabel(key))}))[${context.text(
        label + ` (${anchor.label})`
      )}]`
    : context.text(`${label} [参照先未確認: ${key}]`);
}
function renderVocabulary(items: Mapping[], context: ExtensionRenderContext) {
  if (!items.length) return "";
  return `#block(breakable:true,above:5pt)[#set par.line(numbering:none)\n#strong[${context.text(
    "Vocabulary / 語注"
  )}]\n${items
    .map(
      (item) =>
        `#par[${
          item.target
            ? targetReference(
                item.target as Mapping,
                context,
                String(item.word)
              )
            : context.text(String(item.word))
        } ${context.text(
          `— ${item.meaning}${item.note ? ` / ${item.note}` : ""}`
        )}]`
    )
    .join("\n")}]`;
}
const reading: ExtensionDefinition = {
  type: "reading-passage",
  kind: "content",
  version: 1,
  fallback: "source-visible",
  schema: object({
    id: id(),
    title: string({ default: "" }),
    paragraphs: array(
      object({
        id: id(),
        sentences: array(sentence, {
          required: true,
          minItems: 1,
          maxItems: 100,
        }),
      }),
      { required: true, minItems: 1, maxItems: 100 }
    ),
    sentenceNumbers: boolean(true),
    lineNumbers: boolean(false),
    levels: { ...levels, default: {} },
    vocabulary: array(vocabulary, { default: [], maxItems: 300 }),
    vocabularyPlacement: string({
      enum: ["passage-end", "paragraph-end"],
      default: "passage-end",
    }),
    notes: array(object({ text: string({ required: true }), target }), {
      default: [],
      maxItems: 100,
    }),
  }),
  validate(config, context) {
    const paragraphs = new Set<string>();
    list(config.paragraphs).forEach((paragraph, p) => {
      if (paragraphs.has(String(paragraph.id)))
        context.issue(
          `paragraphs[${p}].id`,
          "DUPLICATE_ID",
          "段落IDが重複しています。"
        );
      paragraphs.add(String(paragraph.id));
      const sentences = new Set<string>();
      list(paragraph.sentences).forEach((s, i) => {
        if (sentences.has(String(s.id)))
          context.issue(
            `paragraphs[${p}].sentences[${i}].id`,
            "DUPLICATE_ID",
            "文IDは同じ段落内で一意にしてください。"
          );
        sentences.add(String(s.id));
        validateEnglishSpans(
          String(s.originalText),
          list(s.annotations),
          context,
          `paragraphs[${p}].sentences[${i}].annotations`
        );
      });
    });
    for (const key of ["vocabulary", "notes"])
      list(config[key]).forEach((item, i) => {
        if (item.target)
          validateTarget(
            item.target as Mapping,
            context,
            `${key}[${i}].target`
          );
      });
    if (
      config.vocabularyPlacement === "paragraph-end" &&
      list(config.vocabulary).some(
        (word) => !(word.target as Mapping | undefined)?.paragraphId
      )
    )
      context.issue(
        "vocabulary",
        "VOCABULARY_TARGET_REQUIRED",
        "段落末配置ではすべての語注に段落IDが必要です。"
      );
  },
  anchors(config) {
    const passage = String(config.id),
      result = [
        {
          key: referenceKey("passage", passage),
          label: String(config.title || passage),
        },
      ];
    list(config.paragraphs).forEach((paragraph, p) => {
      result.push({
        key: referenceKey("passage", passage, String(paragraph.id)),
        label: `Paragraph ${p + 1}`,
      });
      list(paragraph.sentences).forEach((s, i) => {
        const parts = ["passage", passage, String(paragraph.id), String(s.id)];
        result.push({
          key: referenceKey(...parts),
          label: `Paragraph ${p + 1} / Sentence ${i + 1}`,
        });
        for (const span of list(s.annotations))
          result.push({
            key: referenceKey(...parts, String(span.id)),
            label: String(span.label || span.id),
          });
      });
    });
    return result;
  },
  references: (config) =>
    [...list(config.vocabulary), ...list(config.notes)].flatMap((item, i) =>
      item.target
        ? [
            {
              key: englishTargetKey(item.target as Mapping),
              path: `notes/vocabulary[${i}].target`,
            },
          ]
        : []
    ),
  render(config, context) {
    const passage = String(config.id),
      display = level(config, context);
    let number = 0;
    const paragraphs = list(config.paragraphs).map((paragraph, p) => {
      const prefix = ["passage", passage, String(paragraph.id)],
        header = `${safeAnchor(
          context,
          referenceKey(...prefix)
        )}#block(breakable:false,sticky:true)[#strong[${context.text(
          `Paragraph ${p + 1}`
        )}]]`;
      const body = list(paragraph.sentences)
        .map((s) => {
          number++;
          const text = String(s.originalText),
            spans = list(s.annotations),
            parts = [...prefix, String(s.id)];
          const sentenceNumber = config.sentenceNumbers
            ? `#super[${context.text(`(${number})`)}] `
            : "";
          return `${safeAnchor(
            context,
            referenceKey(...parts)
          )}${sentenceNumber}${renderAnnotatedSentence(
            text,
            spans,
            display,
            context,
            parts
          )}`;
        })
        .join(context.text(" "));
      const legends = list(paragraph.sentences)
        .map((s) =>
          annotationLegend(
            String(s.originalText),
            list(s.annotations),
            display,
            context
          )
        )
        .join("\n");
      const words =
        config.vocabularyPlacement === "paragraph-end"
          ? renderVocabulary(
              list(config.vocabulary).filter(
                (item) => (item.target as Mapping)?.paragraphId === paragraph.id
              ),
              context
            )
          : "";
      const bodyRule = config.lineNumbers
        ? "#set par.line(numbering:n => text(size:8pt,fill:gray)[#n],number-clearance:7pt)"
        : "#set par.line(numbering:none)";
      return `${header}\n#block(breakable:true)[${bodyRule}\n#par[${body}]]\n${
        legends
          ? `#block(breakable:true)[#set par.line(numbering:none)\n${legends}]`
          : ""
      }\n${words}`;
    });
    const lineRule = config.lineNumbers
      ? "#counter(par.line).update(0)\n#set par.line(numbering:none)"
      : "#set par.line(numbering:none)";
    return `${safeAnchor(
      context,
      referenceKey("passage", passage)
    )}#block(breakable:true,above:8pt,below:8pt)[#set par(justify:false,leading:0.8em)\n${
      config.title ? `#strong[${context.text(String(config.title))}]` : ""
    }\n${lineRule}\n${paragraphs.join("\n")}\n${
      config.vocabularyPlacement === "passage-end"
        ? renderVocabulary(list(config.vocabulary), context)
        : ""
    }\n#block(breakable:true)[#set par.line(numbering:none)\n${list(
      config.notes
    )
      .map(
        (note) =>
          `#par[${
            note.target
              ? targetReference(
                  note.target as Mapping,
                  context,
                  String(note.text)
                )
              : context.text(String(note.text))
          }]`
      )
      .join("\n")}]]`;
  },
  textSamples: (config) =>
    [
      String(config.title),
      ...list(config.paragraphs).flatMap((p) =>
        list(p.sentences).map((s) => String(s.originalText))
      ),
      ...list(config.vocabulary).map((v) => String(v.meaning)),
      ...list(config.notes).map((n) => String(n.text)),
    ].filter(Boolean),
  documentation: {
    summary: "段落・文・範囲IDを持つ改ページ可能な読解長文。",
    restrictions: [
      "長文全体をatomicにしない。文番号は原文外、行番号はTypst par.lineの余白要素。",
      "文番号は長文内の通し番号、Sentenceの参照表示は段落内番号。",
      "行番号は印刷レイアウトで変動するため、設問の永続参照にはIDを使う。",
      "語注の対象はIDで指定。段落末または長文末へ配置する。",
    ],
    errorExample: "id: p\nparagraphs:\n  - id: first\n    sentences: []",
  },
  examples: [
    {
      name: "minimal",
      source:
        "id: passage1\nparagraphs:\n  - id: p1\n    sentences:\n      - id: s1\n        originalText: Learning takes time.",
    },
    {
      name: "standard",
      source:
        "id: passage1\ntitle: Learning Together\nlineNumbers: true\nparagraphs:\n  - id: p1\n    sentences:\n      - id: s1\n        originalText: Students read books.\n        annotations:\n          - id: A\n            start: 14\n            end: 19\n            role: O\n            label: 下線部A\nvocabulary:\n  - word: books\n    meaning: 本\n    target:\n      passageId: passage1\n      paragraphId: p1\n      sentenceId: s1\n      spanId: A",
    },
  ],
  tests,
};
const vocab: ExtensionDefinition = {
  type: "vocabulary-note",
  kind: "content",
  version: 1,
  fallback: "source-visible",
  schema: object({
    items: array(vocabulary, { required: true, minItems: 1, maxItems: 300 }),
  }),
  validate(config, context) {
    list(config.items).forEach((item, i) => {
      if (item.target)
        validateTarget(item.target as Mapping, context, `items[${i}].target`);
    });
  },
  references: (config) =>
    list(config.items).flatMap((item, i) =>
      item.target
        ? [
            {
              key: englishTargetKey(item.target as Mapping),
              path: `items[${i}].target`,
            },
          ]
        : []
    ),
  render: (config, context) => renderVocabulary(list(config.items), context),
  textSamples: (config) =>
    list(config.items).map((item) => String(item.meaning)),
  documentation: {
    summary: "明示IDで本文と対応する語注一覧。",
    restrictions: [
      "単語の文字列検索では参照しない。targetを省略すると独立語注。",
    ],
    errorExample: "items:\n  - word: read",
  },
  examples: [
    { name: "minimal", source: "items:\n  - word: read\n    meaning: 読む" },
    {
      name: "standard",
      source:
        "items:\n  - word: books\n    meaning: 本\n    target:\n      passageId: passage1\n      paragraphId: p1\n      sentenceId: s1\n      spanId: A",
    },
  ],
  tests,
};
const reference: ExtensionDefinition = {
  type: "question-reference",
  kind: "content",
  version: 1,
  fallback: "source-visible",
  schema: object({
    label: string({ required: true, maxLength: 2000 }),
    target: { ...target, required: true },
  }),
  validate(config, context) {
    validateTarget(config.target as Mapping, context, "target");
  },
  references: (config) => [
    { key: englishTargetKey(config.target as Mapping), path: "target" },
  ],
  render: (config, context) =>
    `#par[${targetReference(
      config.target as Mapping,
      context,
      String(config.label)
    )}]`,
  textSamples: (config) => [String(config.label)],
  documentation: {
    summary: "設問から長文・段落・文・下線範囲へIDで参照する。",
    restrictions: [
      "未解決/重複IDはQA warningとPDFの明示的な未確認表示。",
      "解答編は必要な原文ブロックを同じASTから再利用する。",
    ],
    errorExample: "label: 下線部A\ntarget:\n  passageId: passage1\n  spanId: A",
  },
  examples: [
    {
      name: "minimal",
      source:
        "label: 第1段落を参照\ntarget:\n  passageId: passage1\n  paragraphId: p1",
    },
    {
      name: "standard",
      source:
        "label: 下線部Aの内容を説明する\ntarget:\n  passageId: passage1\n  paragraphId: p1\n  sentenceId: s1\n  spanId: A",
    },
  ],
  tests,
};
for (const definition of [syntax, translation, reading, vocab, reference])
  extensionRegistry.register(definition);
