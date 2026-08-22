import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const coreSource = await readFile(new URL("../app/studio-core.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(coreSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const core = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const clientSource = await readFile(new URL("../app/studio-client.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const pdfSource = await readFile(new URL("../app/pdf-generation.ts", import.meta.url), "utf8");

function measurement(height, lineCount = 2, width = 500, clientWidth = 500) {
  return { height, width, clientWidth, lineCount };
}

function measurements(blocks, height, lineCount = 2) {
  return new Map(blocks.map((block) => [block.id, measurement(height, lineCount)]));
}

test("Test 1: a short ordinary material keeps the conventional single-page layout", () => {
  const parsed = core.parseDocument("## 導入\n\n短い本文です。");
  const heights = new Map(parsed.blocks.map((block) => [block.id, measurement(40)]));
  const pages = core.paginateMeasuredDocument(parsed.blocks, heights, 500);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].blocks.length, 2);
});

test("Test 2: long Japanese prose never creates a tiny punctuation-only fragment", () => {
  const prose = `${"この考え方を使うと式の意味を順番に確認できます。".repeat(45)}です。`;
  const block = core.parseDocument(prose).blocks[0];
  const prepared = core.prepareBlocksForPagination([block], new Set([block.id])).blocks;
  assert.ok(prepared.length > 1);
  for (const fragment of prepared) {
    assert.doesNotMatch(fragment.markdown.trim(), /^(?:です。|ます。|となる。)$/u);
  }
  assert.equal(prepared.map((fragment) => fragment.markdown).join(""), prose);
});

test("Test 3: a heading moves with measured following content", () => {
  const parsed = core.parseDocument("前文\n\n## 二次関数\n\n二次関数とは、変数の二乗を含む関数です。");
  const [lead, heading, body] = parsed.blocks;
  const pages = core.paginateMeasuredDocument(
    parsed.blocks,
    new Map([[lead.id, measurement(230)], [heading.id, measurement(35)], [body.id, measurement(70)]]),
    300,
  );
  assert.equal(pages.length, 2);
  assert.equal(pages[1].blocks[0].type, "heading");
  assert.equal(pages[1].blocks[1].type, "paragraph");
});

test("Test 4: a long solution box is split by parsed child nodes", () => {
  const parsed = core.parseDocument(`:::solution title="解答"\n${"説明文です。根拠を確認します。".repeat(80)}\n\n$$\nx^2+1\n$$\n:::`);
  const box = parsed.blocks[0];
  const prepared = core.prepareBlocksForPagination([box], new Set([box.id]));
  assert.ok(box.children.length >= 2);
  assert.ok(prepared.blocks.length > 1);
  const pages = core.paginateMeasuredDocument(prepared.blocks, measurements(prepared.blocks, 170), 300);
  assert.ok(pages.length > 1);
  assert.ok(pages.every((page) => page.blocks.every((block) => block.type === "callout")));
});

test("Test 5: every box fragment has an explicit complete-border state", () => {
  for (const role of ["first", "middle", "last"]) {
    assert.match(css, new RegExp(`\\.box-fragment--${role}`, "u"));
  }
  assert.match(css, /box-decoration-break:\s*clone/u);
  assert.doesNotMatch(css, /\.lesson-callout[^}]*overflow:\s*hidden/su);
});

test("Test 6: over-wide single math is scaled instead of clipped", () => {
  const math = core.parseDocument("$$\n\\boxed{a+b+c+d+e+f+g+h+i+j}\n$$").blocks[0];
  const pages = core.paginateMeasuredDocument(
    [math],
    new Map([[math.id, measurement(80, 1, 900, 450)]]),
    500,
  );
  assert.equal(pages[0].blocks[0].paginationScale, 0.5);
  assert.match(css, /pagination-scale-frame/u);
});

test("Test 7: aligned math splits only at equation-row boundaries", () => {
  const math = core.parseDocument("$$\n\\begin{aligned}\na&=1 \\\\\nb&=2 \\\\\nc&=3\n\\end{aligned}\n$$").blocks[0];
  const parts = core.prepareBlocksForPagination([math], new Set([math.id])).blocks;
  assert.equal(parts.length, 3);
  for (const part of parts) {
    assert.match(part.raw, /\\begin\{aligned\}[\s\S]*\\end\{aligned\}/u);
    assert.equal((part.raw.match(/&=/gu) ?? []).length, 1);
  }
});

test("Test 8: long tables split by rows and repeat their header", () => {
  const table = core.parseDocument("| 項目 | 内容 |\n|---|---|\n| A | a |\n| B | b |\n| C | c |").blocks[0];
  const parts = core.prepareBlocksForPagination([table], new Set([table.id])).blocks;
  assert.equal(parts.length, 3);
  for (const part of parts) assert.match(part.markdown, /^\| 項目 \| 内容 \|\n\|---\|---\|/u);
});

test("Test 9: a function graph is atomic and moves intact to the next page", () => {
  const parsed = core.parseDocument("前文\n\n```figure function-graph\nformula: x^2\n``` ".trim());
  const [lead, graph] = parsed.blocks;
  const pages = core.paginateMeasuredDocument(
    parsed.blocks,
    new Map([[lead.id, measurement(180)], [graph.id, measurement(180)]]),
    300,
  );
  assert.equal(pages.length, 2);
  assert.equal(pages[1].blocks[0].figureType, "function-graph");
});

test("Test 10: every registered figure uses the atomic strategy", () => {
  const types = ["mermaid", "function-graph", "data-chart", "number-line", "sign-chart", "triangle", "circle", "venn-diagram", "tree-diagram", "histogram", "box-plot", "scatter-plot", "probability-distribution", "image"];
  for (const type of types) {
    const source = type === "mermaid" ? "```mermaid\ngraph TD; A-->B\n```" : `\`\`\`figure ${type}\ncaption: test\n\`\`\``;
    const figure = core.parseDocument(source).blocks[0];
    assert.equal(figure.type, "figure", type);
    assert.equal(figure.breakPolicy, "atomic", type);
  }
});

test("Test 11: a figure inside a box remains a real figure AST child", () => {
  const parsed = core.parseDocument(":::solution\n```figure function-graph\nformula: x^2\n```\n:::");
  const figure = core.flattenStudioBlocks(parsed.blocks).find((block) => block.type === "figure");
  assert.equal(figure?.figureType, "function-graph");
});

test("Test 12: nested boxes recursively preserve the inner figure", () => {
  const parsed = core.parseDocument(":::solution\n:::explanation\n```figure histogram\nboundaries: 0, 10, 20\nfrequencies: 2, 3\n```\n:::\n:::");
  const [outer] = parsed.blocks;
  assert.equal(outer.children[0].type, "callout");
  assert.equal(outer.children[0].children[0].figureType, "histogram");
});

test("Test 13: a figure taller than one body area is proportionally scaled", () => {
  const figure = core.parseDocument("```figure function-graph\nformula: x^2\n```").blocks[0];
  const pages = core.paginateMeasuredDocument(
    [figure],
    new Map([[figure.id, measurement(600, 0, 500, 500)]]),
    300,
  );
  assert.equal(pages.length, 1);
  assert.ok(pages[0].blocks[0].paginationScale <= 0.5);
  assert.ok(pages[0].blocks[0].paginationScale > 0.48);
});

test("Test 14: a very long material paginates beyond ten pages without looping", () => {
  const blocks = Array.from({ length: 15 }, (_, index) => ({
    id: `long-${index}`,
    type: "paragraph",
    startLine: index + 1,
    endLine: index + 1,
    markdown: `本文${index}`,
    breakPolicy: "flow",
  }));
  const pages = core.paginateMeasuredDocument(blocks, measurements(blocks, 95), 100);
  assert.equal(pages.length, 15);
  assert.deepEqual(pages.map((page) => page.number), Array.from({ length: 15 }, (_, index) => index + 1));
});

test("Test 15: preview and PDF consume the same canonical Page DOM", () => {
  assert.match(clientSource, /<PageDocument[\s\S]*className="shared-page-document"[\s\S]*ref=\{printPagesRef\}/u);
  assert.doesNotMatch(clientSource, /className="print-pages"/u);
  assert.match(pdfSource, /source\.querySelectorAll<HTMLElement>\("\.paper"\)/u);
});

test("Test 16: consecutive pagination starts page numbering and state afresh", () => {
  const first = [{ id: "first", type: "paragraph", startLine: 1, endLine: 1, markdown: "A", breakPolicy: "flow" }];
  const second = [{ id: "second", type: "paragraph", startLine: 1, endLine: 1, markdown: "B", breakPolicy: "flow" }];
  assert.equal(core.paginateMeasuredDocument(first, measurements(first, 50), 100)[0].number, 1);
  const pages = core.paginateMeasuredDocument(second, measurements(second, 50), 100);
  assert.equal(pages[0].number, 1);
  assert.equal(pages[0].blocks[0].id, "second");
});

test("Test 17: batch conversion remains explicitly sequential and isolated", () => {
  assert.match(clientSource, /runBatchSequentially/u);
  assert.doesNotMatch(clientSource, /Promise\.all\([^)]*batch/isu);
  assert.match(clientSource, /document\.querySelectorAll\("\.pdf-capture-host"\)/u);
});

test("Orphan heading 1: a heading never uses the last heading-only space", () => {
  const parsed = core.parseDocument("前の内容\n\n## 例題\n\n問題文を読み、答えなさい。");
  const [lead, heading, body] = parsed.blocks;
  const pages = core.paginateMeasuredDocument(
    parsed.blocks,
    new Map([
      [lead.id, measurement(240, 10)],
      [heading.id, measurement(35, 1)],
      [body.id, measurement(70, 3)],
    ]),
    300,
  );
  assert.equal(pages[0].blocks.some((block) => block.id === heading.id), false);
  assert.equal(pages[1].blocks[0].id, heading.id);
  assert.equal(pages[1].blocks[1].id, body.id);
});

test("Orphan heading 2: room for a heading and only one prose line is rejected", () => {
  const parsed = core.parseDocument("前の内容\n\n## 解説\n\n一行目。二行目。三行目。");
  const [lead, heading, body] = parsed.blocks;
  const pages = core.paginateMeasuredDocument(
    parsed.blocks,
    new Map([
      [lead.id, measurement(210, 8)],
      [heading.id, measurement(35, 1)],
      [body.id, measurement(66, 3)],
    ]),
    300,
  );
  assert.equal(pages.length, 2);
  assert.equal(pages[1].blocks[0].id, heading.id);
  assert.equal(pages[1].blocks[1].id, body.id);
});

test("Orphan heading 3: a heading with two rendered prose lines may stay", () => {
  const parsed = core.parseDocument("前の内容\n\n## ポイント\n\n二行で収まる本文です。");
  const [lead, heading, body] = parsed.blocks;
  const pages = core.paginateMeasuredDocument(
    parsed.blocks,
    new Map([
      [lead.id, measurement(180, 7)],
      [heading.id, measurement(35, 1)],
      [body.id, measurement(44, 2)],
    ]),
    300,
  );
  assert.equal(pages.length, 1);
  assert.deepEqual(pages[0].blocks.map((block) => block.id), [lead.id, heading.id, body.id]);
});

test("Orphan heading 4: decorative separators are skipped when finding example content", () => {
  const parsed = core.parseDocument("前の内容\n\n## 例題\n\n---\n\n次の問いに答えなさい。");
  const [lead, heading, separator, problem] = parsed.blocks;
  const pages = core.paginateMeasuredDocument(
    parsed.blocks,
    new Map([
      [lead.id, measurement(220, 8)],
      [heading.id, measurement(35, 1)],
      [separator.id, measurement(8, 0)],
      [problem.id, measurement(60, 3)],
    ]),
    300,
  );
  assert.equal(pages[0].blocks.some((block) => block.id === heading.id), false);
  assert.deepEqual(
    pages[1].blocks.slice(0, 3).map((block) => block.id),
    [heading.id, separator.id, problem.id],
  );
});

test("Orphan heading 5: an example title stays with its atomic formula", () => {
  const parsed = core.parseDocument("前の内容\n\n## 例題\n\n$$\nx^2-4x+3=0\n$$");
  const [lead, heading, formula] = parsed.blocks;
  const pages = core.paginateMeasuredDocument(
    parsed.blocks,
    new Map([
      [lead.id, measurement(180, 7)],
      [heading.id, measurement(35, 1)],
      [formula.id, measurement(100, 1)],
    ]),
    300,
  );
  assert.equal(pages.length, 2);
  assert.deepEqual(pages[1].blocks.map((block) => block.id), [heading.id, formula.id]);
});

test("Orphan heading 6: an example title stays with its atomic figure", () => {
  const parsed = core.parseDocument("前の内容\n\n## 例題\n\n```figure function-graph\nformula: x^2\n```");
  const [lead, heading, figure] = parsed.blocks;
  const pages = core.paginateMeasuredDocument(
    parsed.blocks,
    new Map([
      [lead.id, measurement(150, 6)],
      [heading.id, measurement(35, 1)],
      [figure.id, measurement(150, 0)],
    ]),
    300,
  );
  assert.equal(pages.length, 2);
  assert.deepEqual(pages[1].blocks.map((block) => block.id), [heading.id, figure.id]);
});

test("Orphan heading 7: a heading-only container fragment moves with its next content fragment", () => {
  const nestedHeading = {
    id: "nested-heading",
    type: "heading",
    startLine: 2,
    endLine: 2,
    markdown: "例題",
    level: 3,
    breakPolicy: "atomic",
  };
  const nestedBody = {
    id: "nested-body",
    type: "paragraph",
    startLine: 3,
    endLine: 3,
    markdown: "BOX内の問題文です。",
    breakPolicy: "flow",
  };
  const lead = {
    id: "nested-lead",
    type: "paragraph",
    startLine: 1,
    endLine: 1,
    markdown: "前の内容",
    breakPolicy: "flow",
  };
  const first = {
    id: "box-fragment-1",
    type: "callout",
    startLine: 2,
    endLine: 2,
    markdown: "### 例題",
    blockName: "example",
    children: [nestedHeading],
    originBlockId: "box-origin",
    fragmentIds: ["box-fragment-1"],
    fragmentIndex: 0,
    fragmentEndIndex: 0,
    fragmentCount: 2,
    fragmentRole: "first",
    breakPolicy: "flow",
  };
  const second = {
    ...first,
    id: "box-fragment-2",
    markdown: nestedBody.markdown,
    children: [nestedBody],
    fragmentIds: ["box-fragment-2"],
    fragmentIndex: 1,
    fragmentEndIndex: 1,
    fragmentRole: "last",
    continuation: true,
  };
  const pages = core.paginateMeasuredDocument(
    [lead, first, second],
    new Map([
      [lead.id, measurement(230, 9)],
      [first.id, measurement(40, 1)],
      [second.id, measurement(70, 3)],
    ]),
    300,
  );
  assert.equal(pages[0].blocks.some((block) => block.originBlockId === "box-origin"), false);
  assert.equal(pages[1].blocks[0].type, "callout");
  assert.deepEqual(pages[1].blocks[0].children.map((child) => child.id), [nestedHeading.id, nestedBody.id]);
});

test("Orphan heading 8: a material over ten pages has no trailing semantic heading", () => {
  const blocks = [];
  const heights = new Map();
  for (let index = 0; index < 12; index += 1) {
    const lead = { id: `lead-${index}`, type: "paragraph", startLine: index * 3 + 1, endLine: index * 3 + 1, markdown: "前の内容", breakPolicy: "flow" };
    const heading = { id: `heading-${index}`, type: "heading", startLine: index * 3 + 2, endLine: index * 3 + 2, markdown: `例題${index + 1}`, level: 2, breakPolicy: "atomic" };
    const body = { id: `body-${index}`, type: "paragraph", startLine: index * 3 + 3, endLine: index * 3 + 3, markdown: "問題文", breakPolicy: "flow" };
    blocks.push(lead, heading, body);
    heights.set(lead.id, measurement(250, 9));
    heights.set(heading.id, measurement(35, 1));
    heights.set(body.id, measurement(70, 3));
  }
  const pages = core.paginateMeasuredDocument(blocks, heights, 300);
  assert.ok(pages.length > 10);
  for (const page of pages) {
    const lastMeaningful = page.blocks.findLast((block) => block.type !== "hr" && block.type !== "page-break");
    assert.notEqual(lastMeaningful?.type, "heading", `page ${page.number}`);
  }
});

test("Orphan heading 9: a manual marker between a heading and its content moves before the group", () => {
  const parsed = core.parseDocument("前の内容\n\n## 例題\n\n:::page-break\n:::\n\n問題文です。");
  const [lead, heading, marker, body] = parsed.blocks;
  const pages = core.paginateMeasuredDocument(
    parsed.blocks,
    new Map([
      [lead.id, measurement(150, 6)],
      [heading.id, measurement(35, 1)],
      [marker.id, measurement(0, 0)],
      [body.id, measurement(70, 3)],
    ]),
    300,
  );
  assert.equal(pages.length, 2);
  assert.deepEqual(pages[1].blocks.map((block) => block.id), [heading.id, body.id]);
});

test("Orphan heading 10: a large atomic figure scales just enough to stay with its heading", () => {
  const parsed = core.parseDocument("## 例題\n\n```figure function-graph\nformula: x^2\n```");
  const [heading, figure] = parsed.blocks;
  const pages = core.paginateMeasuredDocument(
    parsed.blocks,
    new Map([
      [heading.id, measurement(35, 1)],
      [figure.id, measurement(300, 0, 500, 500)],
    ]),
    300,
  );
  assert.equal(pages.length, 1);
  assert.equal(pages[0].blocks[0].id, heading.id);
  assert.equal(pages[0].blocks[1].id, figure.id);
  assert.ok(pages[0].blocks[1].paginationScale < 1);
});

test("PDF generation blocks any orphan heading missed by pagination", () => {
  assert.match(pdfSource, /assertNoOrphanHeadings\(source\)/u);
  assert.match(pdfSource, /assertNoUnsafePagination\(source\)/u);
});

test("Semantic constraints classify content by AST meaning instead of subject text", () => {
  const parsed = core.parseDocument(`## Section

本文です。

:::exercise id="q001" title="Question"
Stem.

- A
- B
:::

$$
x=1
$$`);
  const [heading, paragraph, problem, formula] = parsed.blocks;
  const headingConstraint = core.paginationConstraintFor(heading);
  const paragraphConstraint = core.paginationConstraintFor(paragraph);
  const problemConstraint = core.paginationConstraintFor(problem);
  const formulaConstraint = core.paginationConstraintFor(formula);

  assert.equal(headingConstraint.keepWithNext, true);
  assert.equal(headingConstraint.avoidBreakAfter, true);
  assert.deepEqual(paragraphConstraint.minimumFragment, { kind: "rendered-lines", count: 2 });
  assert.equal(problemConstraint.role, "problem");
  assert.equal(problemConstraint.container, true);
  assert.equal(problemConstraint.keepTogetherWhenFits, true);
  assert.equal(formulaConstraint.atomic, true);
  assert.equal(formulaConstraint.role, "formula");
});

test("Preferred paragraph break points require real rendered line offsets", () => {
  const paragraph = core.parseDocument("四行以上になる段落です。").blocks[0];
  assert.equal(core.hasPreferredBreakPoints(paragraph, measurement(88, 4)), false);
  assert.equal(core.hasPreferredBreakPoints(paragraph, {
    ...measurement(88, 4),
    lineBreakOffsets: [5, 10, 15],
  }), true);
});

test("Look-behind keeps a short explanation cue with its display formula", () => {
  const parsed = core.parseDocument("前の内容です。\n\nしたがって、次式を得ます。\n\n$$\nx=1\n$$");
  const [lead, cue, formula] = parsed.blocks;
  const pages = core.paginateMeasuredDocument(
    parsed.blocks,
    new Map([
      [lead.id, measurement(205, 8)],
      [cue.id, measurement(32, 1)],
      [formula.id, measurement(82, 1)],
    ]),
    300,
  );
  assert.deepEqual(pages[0].blocks.map((block) => block.id), [lead.id]);
  assert.deepEqual(pages[1].blocks.map((block) => block.id), [cue.id, formula.id]);
  assert.equal(pages[0].breakAfter, "keepWithPrevious");
});

test("Problem stem keeps the first choices fragment inside a split exercise container", () => {
  const lead = { id: "problem-lead", type: "paragraph", startLine: 1, endLine: 1, markdown: "lead", breakPolicy: "flow" };
  const stemChild = { id: "problem-stem-child", type: "paragraph", startLine: 2, endLine: 2, markdown: "stem", breakPolicy: "flow" };
  const choicesChild = { id: "problem-choices-child", type: "list", startLine: 3, endLine: 4, markdown: "- A\n- B", breakPolicy: "flow" };
  const stem = {
    id: "problem-fragment-stem",
    type: "callout",
    startLine: 2,
    endLine: 2,
    markdown: "stem",
    blockName: "exercise",
    children: [stemChild],
    originBlockId: "problem-origin",
    fragmentIds: ["problem-fragment-stem"],
    fragmentIndex: 0,
    fragmentEndIndex: 0,
    fragmentCount: 2,
    fragmentRole: "first",
    breakPolicy: "flow",
  };
  const choices = {
    ...stem,
    id: "problem-fragment-choices",
    markdown: choicesChild.markdown,
    children: [choicesChild],
    fragmentIds: ["problem-fragment-choices"],
    fragmentIndex: 1,
    fragmentEndIndex: 1,
    fragmentRole: "last",
    continuation: true,
  };
  const pages = core.paginateMeasuredDocument(
    [lead, stem, choices],
    new Map([
      [lead.id, measurement(220, 8)],
      [stem.id, measurement(42, 2)],
      [choices.id, measurement(62, 2)],
      [stemChild.id, measurement(32, 2)],
      [choicesChild.id, measurement(52, 2)],
    ]),
    300,
  );
  assert.equal(pages[0].blocks.some((block) => block.originBlockId === "problem-origin"), false);
  assert.equal(pages[0].breakAfter, "problemKeepTogether");
  assert.equal(pages[0].paginationDebug.nextNodeType, "callout");
  assert.equal(pages[0].paginationDebug.nextNodeHeight, 107);
  assert.equal(pages[0].paginationDebug.atomic, false);
  assert.equal(pages[0].paginationDebug.splittable, true);
  assert.equal(pages[0].paginationDebug.container, true);
  assert.equal(pages[1].blocks.length, 1);
  assert.deepEqual(pages[1].blocks[0].children.map((child) => child.id), [stemChild.id, choicesChild.id]);
});

test("Four-choice problems expose only two-or-more-choice safe fragments", () => {
  const problem = core.parseDocument(`:::exercise id="q001" title="問題1"
次のうち正しいものを選びなさい。

- 選択肢A
- 選択肢B
- 選択肢C
- 選択肢D
:::`).blocks[0];
  const fragments = core.prepareBlocksForPagination([problem], new Set([problem.id])).blocks;
  const choiceFragments = fragments
    .flatMap((fragment) => fragment.children ?? [])
    .filter((child) => child.type === "list");

  assert.equal(choiceFragments.length, 2);
  assert.deepEqual(
    choiceFragments.map((fragment) => (fragment.markdown.match(/^\s*[-+*]\s+/gmu) ?? []).length),
    [2, 2],
  );
});

test("A problem that fits an empty page is moved whole even when whitespace remains", () => {
  const lead = { id: "safe-lead", type: "paragraph", startLine: 1, endLine: 1, markdown: "lead", breakPolicy: "flow" };
  const stemChild = { id: "safe-stem-child", type: "paragraph", startLine: 2, endLine: 2, markdown: "stem", breakPolicy: "flow" };
  const choicesChild = { id: "safe-choices-child", type: "list", startLine: 3, endLine: 6, markdown: "- A\n- B\n- C\n- D", breakPolicy: "flow" };
  const fragments = [
    {
      id: "safe-problem-stem",
      type: "callout",
      startLine: 2,
      endLine: 2,
      markdown: "stem",
      blockName: "exercise",
      children: [stemChild],
      originBlockId: "safe-problem-origin",
      fragmentIds: ["safe-problem-stem"],
      fragmentIndex: 0,
      fragmentEndIndex: 0,
      fragmentCount: 2,
      fragmentRole: "first",
      breakPolicy: "flow",
    },
    {
      id: "safe-problem-choices",
      type: "callout",
      startLine: 3,
      endLine: 6,
      markdown: choicesChild.markdown,
      blockName: "exercise",
      children: [choicesChild],
      originBlockId: "safe-problem-origin",
      fragmentIds: ["safe-problem-choices"],
      fragmentIndex: 1,
      fragmentEndIndex: 1,
      fragmentCount: 2,
      fragmentRole: "last",
      continuation: true,
      breakPolicy: "flow",
    },
  ];
  const pages = core.paginateMeasuredDocument(
    [lead, ...fragments],
    new Map([
      [lead.id, measurement(180, 7)],
      [fragments[0].id, measurement(50, 2)],
      [fragments[1].id, measurement(87, 4)],
      [stemChild.id, measurement(40, 2)],
      [choicesChild.id, measurement(77, 4)],
    ]),
    300,
  );

  assert.equal(pages.length, 2);
  assert.deepEqual(pages[0].blocks.map((block) => block.id), [lead.id]);
  assert.equal(pages[0].breakAfter, "problemKeepTogether");
  assert.equal(pages[0].paginationDebug.breakReason, "problemKeepTogether");
  assert.equal(pages[0].paginationDebug.nextNodeHeight, 140);
  assert.equal(pages[1].blocks.length, 1);
  assert.equal(pages[1].blocks[0].originBlockId, "safe-problem-origin");
});

test("An overlong four-choice problem splits only after two complete choices", () => {
  const problem = core.parseDocument(`:::exercise id="q-long" title="長い問題"
長い問題文ですが、少なくとも最初の選択肢群までは同じページに残します。

- 選択肢Aの長い説明
- 選択肢Bの長い説明
- 選択肢Cの長い説明
- 選択肢Dの長い説明
:::`).blocks[0];
  const fragments = core.prepareBlocksForPagination([problem], new Set([problem.id])).blocks;
  assert.equal(fragments.length, 3);
  const pages = core.paginateMeasuredDocument(
    fragments,
    measurements(fragments, 110, 3),
    300,
  );

  assert.equal(pages.length, 2);
  const firstChoices = pages[0].blocks[0].children
    .filter((child) => child.type === "list")
    .flatMap((child) => child.markdown.match(/^\s*[-+*]\s+/gmu) ?? []);
  const secondChoices = pages[1].blocks[0].children
    .filter((child) => child.type === "list")
    .flatMap((child) => child.markdown.match(/^\s*[-+*]\s+/gmu) ?? []);
  assert.equal(firstChoices.length, 2);
  assert.equal(secondChoices.length, 2);
  assert.equal(pages[0].blocks[0].children[0].type, "paragraph");
});

test("Page badness moves a paragraph line to prevent a one-line widow", () => {
  const fragments = Array.from({ length: 5 }, (_, index) => ({
    id: `widow-${index + 1}`,
    type: "paragraph",
    startLine: 1,
    endLine: 1,
    markdown: `line-${index + 1}`,
    breakPolicy: "flow",
    originBlockId: "widow-origin",
    fragmentIds: [`widow-${index + 1}`],
    fragmentIndex: index,
    fragmentEndIndex: index,
    fragmentCount: 5,
    fragmentRole: index === 0 ? "first" : index === 4 ? "last" : "middle",
    continuation: index > 0,
  }));
  const pages = core.paginateMeasuredDocument(
    fragments,
    measurements(fragments, 40, 1),
    150,
  );
  assert.deepEqual(pages.map((page) => page.blocks[0].paginationLineCount), [2, 3]);
  assert.equal(pages[0].breakAfter, "whitespaceOptimization");
  assert.ok(Number.isFinite(pages[0].paginationDebug.badness));
});

test("Table rows use row boundaries without leaving a one-row first fragment", () => {
  const rows = Array.from({ length: 6 }, (_, index) => ({
    id: `table-row-${index + 1}`,
    type: "table",
    startLine: 1,
    endLine: 3,
    markdown: `| H |\n|---|\n| ${index + 1} |`,
    breakPolicy: "flow",
    originBlockId: "table-origin",
    fragmentIds: [`table-row-${index + 1}`],
    fragmentIndex: index,
    fragmentEndIndex: index,
    fragmentCount: 6,
    fragmentRole: index === 0 ? "first" : index === 5 ? "last" : "middle",
    continuation: index > 0,
  }));
  const pages = core.paginateMeasuredDocument(rows, measurements(rows, 30, 1), 100);
  assert.deepEqual(pages.map((page) => page.blocks[0].fragmentIds.length), [2, 2, 2]);
  for (const page of pages) assert.match(page.blocks[0].markdown, /^\| H \|\n\|---\|/u);
});

test("Merged table rows pay the repeated header chrome only once per page", () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({
    id: `compact-table-row-${index + 1}`,
    type: "table",
    startLine: 1,
    endLine: 3,
    markdown: `| H |\n|---|\n| ${index + 1} |`,
    breakPolicy: "flow",
    originBlockId: "compact-table-origin",
    fragmentIds: [`compact-table-row-${index + 1}`],
    fragmentIndex: index,
    fragmentEndIndex: index,
    fragmentCount: 12,
    fragmentRole: index === 0 ? "first" : index === 11 ? "last" : "middle",
    continuation: index > 0,
  }));
  const rowMeasurements = new Map(rows.map((row) => [row.id, {
    ...measurement(60, 1),
    tableBodyHeight: 20,
    tableChromeHeight: 40,
  }]));
  const pages = core.paginateMeasuredDocument(rows, rowMeasurements, 320);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].blocks[0].fragmentIds.length, 12);
});

test("Pagination break reasons remain available for debug mode", () => {
  const parsed = core.parseDocument("前文\n\n```figure function-graph\nformula: x^2\n```");
  const [lead, figure] = parsed.blocks;
  const pages = core.paginateMeasuredDocument(
    parsed.blocks,
    new Map([[lead.id, measurement(180, 6)], [figure.id, measurement(180, 0)]]),
    300,
  );
  assert.equal(pages[0].breakAfter, "atomicMove");
  assert.equal(pages[0].paginationDebug.nextNode, figure.id);
  assert.ok(pages[0].paginationDebug.remainingHeight >= 0);
});

test("Page DOM geometry reserves header margin and footer safety exactly once", () => {
  const geometry = core.derivePaginationPageGeometry({
    coordinateScale: 0.5,
    pageHeight: 1122.5,
    pageContentTop: 64.25,
    pageContentBottom: 1058.25,
    headerBottom: 87.75,
    headerMarginBottom: 15,
    footerTop: 1066.25,
    requiredFooterGap: 8,
  });
  assert.equal(geometry.coordinateScale, 0.5);
  assert.equal(geometry.contentTop, 102.75);
  assert.equal(geometry.contentBottom, 1058.25);
  assert.equal(geometry.usableHeight, 955.5);
});

test("A break caused only by the measured footer gap is diagnosed as footerSafety", () => {
  const blocks = [
    { id: "footer-lead", type: "paragraph", startLine: 1, endLine: 1, markdown: "前文", breakPolicy: "flow" },
    { id: "footer-next", type: "paragraph", startLine: 2, endLine: 2, markdown: "続き", breakPolicy: "flow" },
  ];
  const geometry = core.derivePaginationPageGeometry({
    pageHeight: 1100,
    pageContentTop: 0,
    pageContentBottom: 1000,
    footerTop: 950,
    requiredFooterGap: 10,
  });
  const pages = core.paginateMeasuredDocument(
    blocks,
    new Map([[blocks[0].id, measurement(500, 10)], [blocks[1].id, measurement(440, 9)]]),
    geometry.usableHeight,
    false,
    { pageGeometry: geometry },
  );
  assert.equal(pages.length, 2);
  assert.equal(pages[0].breakAfter, "footerSafety");
});

test("Merged problem fragments pay one frame and only the live continuation marker", () => {
  const blocks = [];
  const measured = new Map();
  for (let index = 0; index < 5; index += 1) {
    const origin = `measured-problem-${index}`;
    const stemChild = {
      id: `${origin}-stem-child`, type: "paragraph", startLine: index + 1, endLine: index + 1,
      markdown: "これは十分に長い問題文です。正しい選択肢を選びなさい。", breakPolicy: "flow",
    };
    const choicesChild = {
      id: `${origin}-choices-child`, type: "list", startLine: index + 1, endLine: index + 1,
      markdown: "- A\n- B\n- C\n- D", breakPolicy: "flow",
    };
    const first = {
      id: `${origin}-first`, type: "callout", blockName: "exercise", startLine: index + 1, endLine: index + 1,
      markdown: stemChild.markdown, children: [stemChild], originBlockId: origin,
      fragmentIds: [`${origin}-first`], fragmentIndex: 0, fragmentEndIndex: 0,
      fragmentCount: 2, fragmentRole: "first", breakPolicy: "flow",
    };
    const last = {
      ...first, id: `${origin}-last`, markdown: choicesChild.markdown, children: [choicesChild],
      fragmentIds: [`${origin}-last`], fragmentIndex: 1, fragmentEndIndex: 1,
      fragmentRole: "last", continuation: true,
    };
    blocks.push(first, last);
    measured.set(first.id, {
      ...measurement(107, 2), containerContentHeight: 35,
      continuationMarkerHeight: 13.7, containerContinuationAdjustmentHeight: 0,
    });
    measured.set(last.id, {
      ...measurement(130, 4), containerContentHeight: 72,
      continuationMarkerHeight: 0, containerContinuationAdjustmentHeight: 4,
    });
    measured.set(stemChild.id, measurement(35, 2));
    measured.set(choicesChild.id, measurement(72, 4));
  }
  const pages = core.paginateMeasuredDocument(blocks, measured, 940);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].blocks.length, 5);
  assert.ok(pages[0].blocks.every((block) => block.fragmentIds.length === 2));
});

test("Nested list fragments inside one callout pay one list wrapper", () => {
  const origin = "nested-list-callout";
  const listOrigin = "nested-list";
  const blocks = [];
  const measured = new Map();
  for (let index = 0; index < 4; index += 1) {
    const child = {
      id: `${listOrigin}-item-${index + 1}`,
      type: "list",
      startLine: index + 1,
      endLine: index + 1,
      markdown: `- 選択肢${index + 1}`,
      originBlockId: listOrigin,
      fragmentIds: [`${listOrigin}-item-${index + 1}`],
      fragmentIndex: index,
      fragmentEndIndex: index,
      fragmentCount: 4,
      fragmentRole: index === 0 ? "first" : index === 3 ? "last" : "middle",
      continuation: index > 0,
      breakPolicy: "flow",
    };
    const block = {
      id: `${origin}-fragment-${index + 1}`,
      type: "callout",
      blockName: "explanation",
      startLine: index + 1,
      endLine: index + 1,
      markdown: child.markdown,
      children: [child],
      originBlockId: origin,
      fragmentIds: [`${origin}-fragment-${index + 1}`],
      fragmentIndex: index,
      fragmentEndIndex: index,
      fragmentCount: 4,
      fragmentRole: index === 0 ? "first" : index === 3 ? "last" : "middle",
      continuation: index > 0,
      breakPolicy: "flow",
    };
    blocks.push(block);
    measured.set(block.id, {
      ...measurement(107, 1),
      containerContentHeight: 29,
      continuationMarkerHeight: index === 3 ? 0 : 10,
      containerContinuationAdjustmentHeight: 0,
    });
    measured.set(child.id, {
      ...measurement(29, 1),
      listBodyHeight: 23,
      listMergeGapHeight: 2,
    });
  }

  const pages = core.paginateMeasuredDocument(blocks, measured, 180);
  assert.equal(pages.length, 1);
  assert.equal(pages[0].blocks.length, 1);
  assert.equal(pages[0].blocks[0].fragmentIds.length, 4);
  assert.equal(pages[0].blocks[0].children[0].fragmentIds.length, 4);
});

test("An unrelated figure may begin the next page without moving safe prose", () => {
  const first = { id: "figure-lead-1", type: "paragraph", startLine: 1, endLine: 1, markdown: "前文1", breakPolicy: "flow" };
  const second = { id: "figure-lead-2", type: "paragraph", startLine: 2, endLine: 2, markdown: "前文2", breakPolicy: "flow" };
  const figure = core.parseDocument("```figure function-graph\nformula: x^2\n```").blocks[0];
  const pages = core.paginateMeasuredDocument(
    [first, second, figure],
    new Map([
      [first.id, measurement(100, 4)],
      [second.id, measurement(80, 3)],
      [figure.id, measurement(150, 0)],
    ]),
    300,
  );
  assert.deepEqual(pages[0].blocks.map((block) => block.id), [first.id, second.id]);
  assert.equal(pages[0].breakAfter, "atomicMove");
  assert.equal(pages[1].blocks[0].id, figure.id);
});

test("Tiny callout tails backtrack only to a safe container-child boundary", () => {
  const fragments = Array.from({ length: 5 }, (_, index) => {
    const child = {
      id: `tiny-tail-child-${index}`, type: "paragraph", startLine: index + 1, endLine: index + 1,
      markdown: `採点基準${index + 1}`, breakPolicy: "flow",
    };
    return {
      id: `tiny-tail-fragment-${index}`, type: "callout", blockName: "solution",
      startLine: index + 1, endLine: index + 1, markdown: child.markdown, children: [child],
      originBlockId: "tiny-tail-origin", fragmentIds: [`tiny-tail-fragment-${index}`],
      fragmentIndex: index, fragmentEndIndex: index, fragmentCount: 5,
      fragmentRole: index === 0 ? "first" : index === 4 ? "last" : "middle",
      continuation: index > 0, breakPolicy: "flow",
    };
  });
  const measured = new Map();
  fragments.forEach((fragment, index) => {
    measured.set(fragment.id, {
      ...measurement(index === 0 ? 100 : index === 4 ? 50 : 73, 2),
      containerContentHeight: index === 4 ? 20 : 60,
      continuationMarkerHeight: index === 4 ? 0 : 10,
      containerContinuationAdjustmentHeight: 0,
    });
    measured.set(fragment.children[0].id, measurement(index === 4 ? 20 : 60, 2));
  });
  const pages = core.paginateMeasuredDocument(fragments, measured, 300);
  assert.equal(pages.length, 2);
  assert.deepEqual(pages.map((page) => page.blocks[0].fragmentIds.length), [3, 2]);
  assert.equal(pages[0].breakAfter, "tinyTailBacktrack");
});

test("Debug mode exposes actual, engine, and footer landmarks without entering PDF output", () => {
  assert.match(clientSource, /get\("paginationDebug"\)\s*===\s*"1"/u);
  assert.match(clientSource, /PaginationDebugOverlay/u);
  assert.match(clientSource, /measurePageGeometry/u);
  assert.match(css, /pagination-debug-line\.is-actual/u);
  assert.match(css, /pagination-debug-line\.is-engine/u);
  assert.match(css, /pagination-debug-line\.is-footer/u);
  assert.match(css, /pdf-capture-host \.pagination-debug-overlay[\s\S]*display:\s*none/u);
});

test("The reusable stress fixture contains every high-risk pagination structure", async () => {
  const source = await readFile(new URL("./fixtures/pagination-stress.md", import.meta.url), "utf8");
  const parsed = core.parseDocument(source);
  const flattened = core.flattenStudioBlocks(parsed.blocks);
  for (const type of ["heading", "paragraph", "list", "table", "math", "figure", "callout"]) {
    assert.ok(flattened.some((block) => block.type === type), type);
  }
  assert.ok(flattened.some((block) => block.type === "callout" && block.children?.some((child) => child.type === "callout")));
  assert.ok(flattened.some((block) => block.type === "figure" && block.params?.caption));
});

test("A 30-page semantic stress run stays bounded and starts with fresh state", () => {
  const blocks = Array.from({ length: 210 }, (_, index) => ({
    id: `performance-${index}`,
    type: index % 14 === 12 ? "heading" : "paragraph",
    startLine: index + 1,
    endLine: index + 1,
    markdown: `node-${index}`,
    level: index % 14 === 12 ? 2 : undefined,
    breakPolicy: index % 14 === 12 ? "atomic" : "flow",
  }));
  const heights = new Map(blocks.map((block) => [
    block.id,
    measurement(block.type === "heading" ? 28 : 40, block.type === "heading" ? 1 : 2),
  ]));
  const started = performance.now();
  const pages = core.paginateMeasuredDocument(blocks, heights, 300);
  const elapsed = performance.now() - started;
  assert.ok(pages.length >= 30);
  assert.equal(pages[0].number, 1);
  assert.ok(elapsed < 1000, `pagination took ${elapsed.toFixed(1)}ms`);
  for (const page of pages.slice(0, -1)) {
    assert.notEqual(page.blocks.at(-1)?.type, "heading", `page ${page.number}`);
  }
});
