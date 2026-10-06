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
/** The sentence is segmented only for decoration; concatenation is invariant. */
export function renderAnnotatedSentence(
  text: string,
  spans: Mapping[],
  display: string,
  context: ExtensionRenderContext,
  key?: string[]
) {
  if (!spans.length) return context.text(text);
  const points = [
    ...new Set([
      0,
      Array.from(text).length,
      ...spans.flatMap((span) => [Number(span.start), Number(span.end)]),
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
        body = `#underline(stroke:0.65pt,offset:2pt)[${body}]`;
      if (
        display === "detailed" &&
        active.some((span) => span.style === "overline")
      )
        body = `#overline(stroke:0.65pt)[${body}]`;
      const brackets = active.filter((span) => span.style === "bracket");
      const tick =
        "#box(width:0pt)[#line(start:(0pt,-0.8em),end:(0pt,0.2em),stroke:0.65pt)]";
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
      return anchors + body;
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
    ? `#block(breakable:true,above:3pt,below:5pt)[#set text(size:9pt)\n${items.join(
        "\n"
      )}]`
    : "";
}
const tests = [
  "english-extensions.test.ts",
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
    levels: { ...levels, default: {} },
  }),
  validate(config, context) {
    validateEnglishSpans(
      String(config.originalText),
      list(config.annotations),
      context
    );
  },
  render(config, context) {
    const text = String(config.originalText),
      spans = list(config.annotations),
      display = level(config, context);
    return `#block(breakable:true,above:6pt,below:6pt)[#set par(justify:false)\n#par[${renderAnnotatedSentence(
      text,
      spans,
      display,
      context
    )}]\n${annotationLegend(text, spans, display, context)}]`;
  },
  textSamples: (config) => [String(config.originalText)],
  documentation: {
    summary:
      "原文とコードポイント範囲・役割・親子/修飾関係を分離した英文注釈。",
    restrictions: [
      "start/end は0始まり、Unicodeコードポイント、endは範囲に含まない。UTF-16の添字ではない。",
      "原文はplain text。装飾はannotationsに指定し、Markdownの記号を文字数へ混在させない。",
      "S/V等は指定済みの情報のみ。minimal は下線と主要役割凡例、detailed は上線・括弧線・関係・noteも表示。",
      "重なる範囲は装飾を合成する。弧状の依存矢印ではなく、対象IDと範囲を併記した関係凡例を使う。",
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
