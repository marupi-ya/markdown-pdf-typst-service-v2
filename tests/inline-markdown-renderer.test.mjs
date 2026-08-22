import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  InlineMarkdownContent,
  MarkdownContent,
} from "../app/inline-markdown.ts";
import {
  paginateMeasuredDocument,
  parseDocument,
} from "../app/studio-core.ts";

const clientSource = await readFile(new URL("../app/studio-client.tsx", import.meta.url), "utf8");
const inlineSource = await readFile(new URL("../app/inline-markdown.ts", import.meta.url), "utf8");
const pdfSource = await readFile(new URL("../app/pdf-generation.ts", import.meta.url), "utf8");
const stylesheet = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

function renderInline(source, kind = "heading") {
  return renderToStaticMarkup(
    React.createElement(InlineMarkdownContent, { kind, source }),
  );
}

function renderProse(source) {
  return renderToStaticMarkup(React.createElement(MarkdownContent, { source }));
}

function assertInlineMath(html, latex) {
  assert.match(html, /class="katex(?:\s[^"]*)?"/u);
  assert.match(html, new RegExp(`<annotation encoding="application\\/x-tex">${latex}<\\/annotation>`, "u"));
}

function measurement(height, lineCount = 2) {
  return { height, width: 500, clientWidth: 500, lineCount };
}

test("Inline LaTeX 1: a mixed Japanese H2 renders only y=ax^2 as math", () => {
  const html = renderInline("二次関数 $y=ax^2$ の基本");
  assert.match(html, />二次関数 /u);
  assertInlineMath(html, "y=ax\\^2");
  assert.match(html, / の基本<\/span>$/u);
  assert.doesNotMatch(html, /<p>/u);
});

test("Inline LaTeX 2: transformed quadratic notation renders in a heading", () => {
  const html = renderInline("$y=a(x-p)^2+q$ のグラフ");
  assertInlineMath(html, "y=a\\(x-p\\)\\^2\\+q");
});

test("Inline LaTeX 3: fractions and the supported complex heading examples render", () => {
  const sources = [
    String.raw`関数 $f(x)=\frac{1}{x}$`,
    String.raw`数列 $\{a_n\}$ の基本`,
    String.raw`$\sin\theta$ と $\cos\theta$`,
    String.raw`ベクトル $\vec{a}$ の演算`,
  ];
  for (const source of sources) {
    const html = renderInline(source);
    assert.match(html, /class="katex(?:\s[^"]*)?"/u, source);
    assert.doesNotMatch(html, /katex-error/u, source);
  }
});

test("Inline LaTeX 4: every BOX title uses the shared inline renderer", () => {
  const box = parseDocument(String.raw`:::example title="二次関数 $y=ax^2$ の基本"
問題文です。
:::`).blocks[0];
  assert.equal(box.title, "二次関数 $y=ax^2$ の基本");
  assert.match(renderInline(box.title, "title"), /class="katex(?:\s[^"]*)?"/u);
  assert.match(
    clientSource,
    /callout-title[\s\S]*?<InlineMarkdownContent kind="title" source=\{label \?\? ""\}/u,
  );
});

test("Inline LaTeX 5: nested BOX titles preserve LaTeX and use the same renderer", () => {
  const outer = parseDocument(String.raw`:::solution title="解答 $x^2=1$"
:::explanation title="説明 $y=ax^2$"
本文です。
:::
:::`).blocks[0];
  const inner = outer.children?.[0];
  assert.equal(inner?.type, "callout");
  assert.equal(inner?.title, "説明 $y=ax^2$");
  assert.match(renderInline(inner?.title ?? "", "title"), /class="katex(?:\s[^"]*)?"/u);
  assert.match(clientSource, /block\.children\?\.length[\s\S]*?<RenderedStudioBlock/u);
});

test("Inline LaTeX 6: plain headings and mixed Markdown decoration remain valid", () => {
  const plain = renderInline("通常文章だけの見出し");
  assert.match(plain, /通常文章だけの見出し/u);
  assert.doesNotMatch(plain, /class="katex"/u);

  const decorated = renderInline("**重要**：$y=ax^2$ の *グラフ* と `式`");
  assert.match(decorated, /<strong>重要<\/strong>/u);
  assert.match(decorated, /<em>グラフ<\/em>/u);
  assert.match(decorated, /<code>式<\/code>/u);
  assert.match(decorated, /class="katex(?:\s[^"]*)?"/u);
});

test("Inline LaTeX 7: prose keeps the exact same Markdown and KaTeX pipeline", () => {
  const html = renderProse(String.raw`本文の数式 $f(x)=\frac{1}{x}$ は正常です。`);
  assert.match(html, /^<p>/u);
  assert.match(html, /class="katex inline-math"/u);
  assert.equal((inlineSource.match(/remarkPlugins:\s*\[remarkGfm, remarkMath\]/gu) ?? []).length, 1);
  assert.match(inlineSource, /mathOutput === "mathml"[\s\S]*?\[\[rehypeKatex, \{ output: "mathml" \}\], rehypeInlineMathContract\]/u);
  assert.match(inlineSource, /:\s*\[rehypeKatex, rehypeInlineMathContract\]/u);
});

test("Inline LaTeX baseline contract covers short, tall, heading, and BOX math", () => {
  const sources = [
    String.raw`また、$y=x^2$ と比べて……`,
    String.raw`関数 $f(x)=\frac{1}{x}$ を考える。`,
    String.raw`$\sum_{i=1}^{n} i$ を求める。`,
    String.raw`$x$、$x_i$、$\sqrt{x}$、$\sin\theta$`,
  ];
  for (const source of sources) {
    const html = renderProse(source);
    assert.match(html, /class="katex inline-math"/u, source);
    assert.doesNotMatch(html, /katex-error/u, source);
  }

  assert.match(renderInline(String.raw`見出し $y=x^2$`), /class="katex inline-math"/u);
  assert.match(renderInline(String.raw`BOX $\frac{a}{b}$`, "title"), /class="katex inline-math"/u);
});

test("Inline LaTeX 8: pagination uses the measured post-render heading height", () => {
  const parsed = parseDocument("前文\n\n## 二次関数 $y=ax^2$ の基本\n\n後続本文を二行以上表示します。");
  const [lead, heading, body] = parsed.blocks;
  assert.equal(heading.markdown, "二次関数 $y=ax^2$ の基本");
  const pages = paginateMeasuredDocument(
    parsed.blocks,
    new Map([
      [lead.id, measurement(200, 8)],
      [heading.id, measurement(55, 2)],
      [body.id, measurement(70, 3)],
    ]),
    300,
  );
  assert.equal(pages.length, 2);
  assert.deepEqual(pages[1].blocks.map((block) => block.id), [heading.id, body.id]);
});

test("Inline LaTeX 9: PDF clones the already rendered canonical Page DOM", () => {
  assert.match(pdfSource, /await waitForStableLayout\(source\)[\s\S]*?createCaptureHost\(source\)/u);
  assert.match(pdfSource, /host\.append\(page\.cloneNode\(true\)\)/u);
  assert.match(clientSource, /<PageDocument[\s\S]*?className="shared-page-document"[\s\S]*?ref=\{printPagesRef\}/u);
  assert.match(clientSource, /<InlineMarkdownContent kind="heading" source=\{block\.markdown\}/u);
});

test("Inline LaTeX 10: captions and sequential batch PDF use the shared renderer", () => {
  const figure = parseDocument("```figure function-graph\nformula: x^2\ncaption: グラフ $y=x^2$\n```").blocks[0];
  assert.equal(figure.params?.caption, "グラフ $y=x^2$");
  assert.match(renderInline(figure.params?.caption ?? "", "caption"), /class="katex(?:\s[^"]*)?"/u);
  assert.match(clientSource, /<InlineMarkdownContent kind="caption" source=\{block\.params\.caption\}/u);
  assert.match(clientSource, /runBatchSequentially/u);
  assert.match(clientSource, /function BatchRenderSurface[\s\S]*?generateMaterialPdf\(container\)/u);
  assert.match(clientSource, /function BatchRenderSurface[\s\S]*?<PageDocument[\s\S]*?ref=\{pagesRef\}/u);
});

test("Inline LaTeX 11: figure labels render $a$ through the shared KaTeX pipeline", () => {
  const figure = parseDocument([
    "```figure triangle",
    "vertices: A, 75, 215; B, 345, 215; C, 230, 45",
    "side-labels: B-C:$a$; C-A:$b$; A-B:$c$",
    "angle-labels: A:$A$; B:$B$; C:$C$",
    "caption: 三角形 $ABC$ の辺と角の対応",
    "```",
  ].join("\n")).blocks[0];

  assert.equal(figure.params?.["side-labels"], "B-C:$a$; C-A:$b$; A-B:$c$");
  const renderedLabel = renderInline("$a$", "label");
  assertInlineMath(renderedLabel, "a");
  assert.doesNotMatch(renderedLabel, /katex-html/u);
  assert.match(clientSource, /function SvgInlineLabel[\s\S]*?<InlineMarkdownContent kind="label" source=\{source\}/u);
  assert.match(clientSource, /className="geometry-side-label"[\s\S]*?source=\{side\.label\}/u);
  assert.match(clientSource, /className="geometry-angle-label"[\s\S]*?source=\{angle\.label\}/u);
  assert.match(clientSource, /className="stat-axis-label"[\s\S]*?source=\{xLabel\}/u);
  assert.match(stylesheet, /\.svg-inline-label-object[\s\S]*?overflow:\s*visible/u);
  assert.doesNotMatch(clientSource, />\{side\.label\}<\/text>/u);
  assert.doesNotMatch(clientSource, />\{angle\.label\}<\/text>/u);
});
