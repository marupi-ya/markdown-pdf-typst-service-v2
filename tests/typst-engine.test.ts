import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildTypstAst } from "../app/pdf-engine/typst/ast";
import { generateTypstProject } from "../app/pdf-engine/typst/generator";
import { latexToTypstMath, TypstMathAdapterError } from "../app/pdf-engine/typst/math-adapter";
import { validateTypstCompileRequest } from "../app/pdf-engine/typst/request";
import type { TypstBlockNode, TypstCompileRequest } from "../app/pdf-engine/typst/types";
import { DEFAULT_SETTINGS } from "../app/theme-settings";

const fixture = (name: string) => readFile(new URL(`./fixtures/typst/${name}`, import.meta.url), "utf8");

function request(markdown: string): TypstCompileRequest {
  return {
    markdown,
    outputMode: "complete",
    includeQuestionInAnswer: true,
    settings: DEFAULT_SETTINGS,
    theme: "standard-blue",
  };
}

function flatten(nodes: TypstBlockNode[]): TypstBlockNode[] {
  return nodes.flatMap((node) => {
    if (
      node.type === "Problem"
      || node.type === "Answer"
      || node.type === "Explanation"
      || node.type === "Point"
      || node.type === "Example"
      || node.type === "Warning"
    ) return [node, ...flatten(node.children)];
    return [node];
  });
}

test("existing Markdown parser is converted into the required semantic Typst AST", async () => {
  const ast = buildTypstAst(await fixture("test-3-mathematics.md"));
  const nodes = flatten(ast.children);
  for (const type of ["Heading", "Paragraph", "InlineMath", "DisplayMath", "Problem", "Answer", "Point", "Figure"]) {
    const present = type === "InlineMath"
      ? nodes.some((node) => node.type === "Paragraph" && node.children.some((child) => child.type === "InlineMath"))
      : nodes.some((node) => node.type === type);
    assert.equal(present, true, `${type} should be present`);
  }
});

test("semantic page-break policies do not depend on DOM measurements", async () => {
  const ast = buildTypstAst(await fixture("test-6-boundary.md"));
  const nodes = flatten(ast.children);
  const heading = nodes.find((node) => node.type === "Heading");
  const math = nodes.find((node) => node.type === "DisplayMath");
  const problem = nodes.find((node) => node.type === "Problem");
  const answer = nodes.find((node) => node.type === "Answer");
  assert.deepEqual(heading?.policy, { keepTogether: true, keepWithNext: true, allowBreak: false });
  assert.deepEqual(math?.policy, { keepTogether: true, keepWithNext: false, allowBreak: false });
  assert.equal(problem?.policy.keepTogether, true);
  assert.equal(answer?.policy.allowBreak, false);
  assert.equal(nodes.some((node) => node.type === "PageBreak"), true);
});

test("LaTeX adapter converts supported math and reports unsupported syntax with source location", () => {
  const converted = latexToTypstMath("\\frac{1}{2}+x^2", 18);
  assert.match(converted, /frac|\/2/u);
  assert.throws(
    () => latexToTypstMath("\\input{/etc/passwd}", 42),
    (error) => error instanceof TypstMathAdapterError && error.sourceLine === 42 && error.latexSource.includes("input"),
  );
  assert.throws(() => latexToTypstMath("x #set page", 7), TypstMathAdapterError);
});

test("LaTeX adapter normalizes TeX shorthand fractions inside aligned equations", () => {
  const source = String.raw`\begin{aligned}
a^2
&=9+25-30\left(-\frac12\right)\\
&=34+15\\
&=49
\end{aligned}`;
  const converted = latexToTypstMath(source, 965);
  assert.match(converted, /frac\(1, 2\)|1\s*\/\s*2/u);
  assert.match(converted, /a\^2/u);
  assert.match(converted, /49/u);
});

test("LaTeX adapter preserves braced and command-token fraction arguments", () => {
  assert.match(latexToTypstMath(String.raw`\frac{x+1}{2}`, 10), /frac\(x \+ 1, 2\)|\(x \+ 1\)\s*\/\s*2/u);
  assert.match(latexToTypstMath(String.raw`\frac\pi2`, 11), /frac\(pi, 2\)|pi\s*\/\s*2/u);
});

test("user prose is emitted as escaped text rather than executable Typst code", () => {
  const project = generateTypstProject(request("# Security\n\nUser prose #set page(width: 1cm) must remain text."));
  assert.match(project.source, /#text\("User prose #set page/gu);
  assert.doesNotMatch(project.source, /\n#set page\(width: 1cm\)/gu);
});

test("figures stay vector SVG and never become PNG or canvas data", async () => {
  const project = generateTypstProject(request(await fixture("test-4-physics.md")));
  assert.equal(project.assets.length, 1);
  assert.equal(project.assets[0].mediaType, "image/svg+xml");
  assert.match(project.assets[0].contents, /^<svg/gu);
  assert.doesNotMatch(project.assets[0].contents, /data:image\/png|canvas/giu);
  assert.match(project.source, /image\("assets\/figure-/gu);
});

test("triangle SVG suppresses duplicate angle names and places each vertex label once", () => {
  const project = generateTypstProject(request(`# 三角形

\`\`\`figure triangle
vertices: A, 75, 215; B, 345, 215; C, 245, 45
side-labels: B-C:a; C-A:b; A-B:c
angle-labels: A:A; B:B; C:C
\`\`\`
`));
  const svg = project.assets[0]?.contents ?? "";
  for (const label of ["A", "B", "C"]) {
    assert.equal(svg.match(new RegExp(`>${label}<\\/text>`, "gu"))?.length, 1, `${label} should be rendered once`);
  }
  assert.match(svg, /dominant-baseline="middle"/u);
  assert.match(project.source, /width: 72%/u);
});

test("short answers stay together while long answers remain breakable", () => {
  const longText = "長い解説です。".repeat(180);
  const ast = buildTypstAst(`:::exercise id="q001" title="演習1 確認"
短い問題です。
:::

:::solution for="q001" title="演習1 解答・解説"
短い解答です。
:::

:::exercise id="q002" title="演習2 確認"
別の問題です。
:::

:::solution for="q002" title="演習2の解答・解説"
${longText}
:::`);
  const answers = flatten(ast.children).filter((node) => node.type === "Answer");
  assert.equal(answers[0]?.policy.allowBreak, false);
  assert.equal(answers[1]?.policy.allowBreak, true);
  assert.equal(answers[0]?.type === "Answer" ? answers[0].variant : undefined, "solution");
  assert.equal(
    answers[0]?.type === "Answer" && answers[0].title[0]?.type === "InlineText"
      ? answers[0].title[0].value
      : "",
    "演習1：解答・解説",
  );
});

test("exercise runs start their answer section on a fresh page without height measurement", () => {
  const markdown = `# 教材

## 演習問題

:::exercise id="q001" title="演習1 問題"
問題1です。
:::

:::exercise id="q002" title="演習2 問題"
問題2です。
:::

## 演習問題の解答・解説

:::solution for="q001" title="演習1の解答・解説"
解答1です。
:::

:::solution for="q002" title="演習2の解答・解説"
解答2です。
:::`;
  const project = generateTypstProject(request(markdown));
  assert.match(project.source, /studio-semantic-break:answer-section\n#pagebreak\(\)/u);
  assert.match(project.source, /#studio-display-math|#let studio-display-math/u);
  assert.doesNotMatch(project.source, /getBoundingClientRect|html2canvas|canvas/iu);
});

test("Typst theme reduces tinted surfaces and enlarges display math by role", () => {
  const project = generateTypstProject(request(`:::definition title="定義"
本文です。

$$
x^2=1
$$
:::

:::explanation title="通常説明"
白背景の説明です。
:::

:::solution title="解答・解説"
したがって、

$$
x=1
$$
:::

$$
y^2=1
$$`));
  assert.match(project.source, /"explanation",\n\s+"definition"/u);
  assert.match(project.source, /variant == "solution"/u);
  assert.match(project.source, /variant == "caution"/u);
  assert.match(project.source, /variant == "explanation" or variant == "learning-goals"/u);
  assert.match(project.source, /else \{ white \}/u);
  assert.match(project.source, /#let studio-display-math\(body, emphasis: false\)/u);
  assert.match(project.source, /#studio-display-math\([\s\S]*emphasis: true/u);
  assert.match(project.source, /#studio-final-display-math/u);
  assert.match(project.source, /#studio-conclusion/u);
  assert.match(project.source, /#let studio-display-math[\s\S]*align\(left\)/u);
  assert.doesNotMatch(project.source, /#694c98|#f7f3fb|#5f4b8b|#f7f4fb/u);
});

test("revised sine and cosine lesson validates with vector figures and an explicit answer break", async () => {
  const markdown = await readFile(new URL("../docs/examples/lesson-013-revised.md", import.meta.url), "utf8");
  const ast = buildTypstAst(markdown);
  const nodes = flatten(ast.children);
  const mermaid = nodes.find((node) => node.type === "Figure" && node.figureType === "mermaid");
  assert.ok(mermaid?.type === "Figure");
  const project = generateTypstProject({
    ...request(markdown),
    mermaidAssets: {
      [mermaid.assetPath]: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"640\" height=\"180\" viewBox=\"0 0 640 180\"><text x=\"20\" y=\"40\">Choose a theorem</text></svg>",
    },
  });
  assert.equal(project.assets.length, 4);
  assert.equal(nodes.filter((node) => node.type === "PageBreak").length, 1);
  assert.equal(nodes.some((node) => node.type === "Warning"), true);
  assert.match(project.source, /studio-semantic-break:exercise-section/u);
  assert.match(project.source, /studio-semantic-break:balanced-answer-run/u);
  const illustratedExplanation = nodes.find((node) => (
    node.type === "Explanation"
    && node.children.some((child) => child.type === "Figure" && child.figureType === "mermaid")
  ));
  assert.equal(illustratedExplanation?.policy.keepTogether, true);
  assert.equal(illustratedExplanation?.policy.allowBreak, false);
  assert.match(markdown, /a=8,\\ b=4,\\ c=5/u);
  assert.match(markdown, /-23<0/u);
});

test("request validation rejects arbitrary asset paths", () => {
  assert.throws(() => validateTypstCompileRequest({
    ...request("# Safe"),
    mermaidAssets: { "../../secret.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>" },
  }), /許可されていないMermaid資産パス/u);
});
