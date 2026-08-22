import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const sourceUrl = new URL("../app/studio-core.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const core = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

function solutionBlock(markdown, id = "solution-block") {
  return {
    id,
    type: "callout",
    startLine: 1,
    endLine: 3,
    markdown,
    blockName: "solution",
    breakPolicy: "conditional",
  };
}

function forcedFragments(block) {
  return core.prepareBlocksForPagination(
    [block],
    new Set([block.id]),
  ).blocks;
}

function headingFixture(heading) {
  const lead = "前段の説明です。".repeat(36);
  const following = `${"後続本文".repeat(32)}。`;
  return {
    following,
    markdown: `${lead}\n\n${heading}\n\n${following}`,
  };
}

test("number-line accepts intervals, endpoint styles, and labeled points", () => {
  const result = core.parseNumberLineConfig({
    range: "-5, 5",
    interval: "-2, 3",
    endpoints: "open, closed",
    points: "-4:A:closed, 0:O:open",
    "tick-step": "1",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.config.interval, [-2, 3]);
  assert.deepEqual(result.config.endpoints, ["open", "closed"]);
  assert.deepEqual(result.config.points, [
    { value: -4, label: "A", marker: "closed" },
    { value: 0, label: "O", marker: "open" },
  ]);
});

test("number-line rejects reversed and out-of-range intervals", () => {
  const reversed = core.parseNumberLineConfig({ range: "5, -5" });
  const outside = core.parseNumberLineConfig({
    range: "-5, 5",
    interval: "-6, 2",
  });

  assert.equal(reversed.ok, false);
  assert.match(reversed.errors.join(" "), /min < max/u);
  assert.equal(outside.ok, false);
  assert.match(outside.errors.join(" "), /表示範囲内/u);
});

test("number-line limits excessive tick density", () => {
  const result = core.parseNumberLineConfig({
    range: "-10, 10",
    "tick-step": "0.1",
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /30個/u);
});

test("sign-chart builds a simple row from interval signs", () => {
  const result = core.parseSignChartConfig({
    variable: "x",
    "critical-points": "-2, 1",
    label: "f(x)",
    signs: "+, -, +",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.config.rows, [
    { label: "f(x)", cells: ["+", "0", "-", "0", "+"] },
  ]);
});

test("sign-chart accepts multiple explicit rows", () => {
  const result = core.parseSignChartConfig({
    "critical-points": "-1, 2",
    rows: "x+1 | -, 0, +, +, +; x-2 | -, -, -, 0, +; f(x) | +, 0, -, 0, +",
  });

  assert.equal(result.ok, true);
  assert.equal(result.config.rows.length, 3);
  assert.equal(result.config.rows[2].cells.length, 5);
});

test("sign-chart rejects unsorted points and mismatched signs", () => {
  const result = core.parseSignChartConfig({
    "critical-points": "2, -1",
    signs: "+, -",
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /小さい順/u);
  assert.match(result.errors.join(" "), /3個/u);
});

test("triangle accepts vertices, side labels, angle labels, and right angles", () => {
  const result = core.parseTriangleConfig({
    vertices: "A, 70, 220; B, 350, 220; C, 350, 40",
    "side-labels": "A-B:c; B-C:a; C-A:b",
    "angle-labels": "A:α; C:γ",
    "right-angle": "B",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.config.vertices[1], { label: "B", x: 350, y: 220 });
  assert.deepEqual(result.config.sides[0], { from: "A", to: "B", label: "c" });
  assert.deepEqual(result.config.angles[1], { vertex: "C", label: "γ" });
  assert.deepEqual(result.config.rightAngles, ["B"]);
});

test("triangle rejects duplicate, out-of-range, and collinear vertices", () => {
  const duplicate = core.parseTriangleConfig({ vertices: "A, 60, 60; A, 200, 120; C, 360, 200" });
  const outside = core.parseTriangleConfig({ vertices: "A, 0, 40; B, 200, 120; C, 360, 200" });
  const collinear = core.parseTriangleConfig({ vertices: "A, 60, 60; B, 200, 120; C, 340, 180" });

  assert.equal(duplicate.ok, false);
  assert.match(duplicate.errors.join(" "), /重複/u);
  assert.equal(outside.ok, false);
  assert.match(outside.errors.join(" "), /範囲/u);
  assert.equal(collinear.ok, false);
  assert.match(collinear.errors.join(" "), /一直線/u);
});

test("circle accepts center, radius, points, segments, and arcs", () => {
  const result = core.parseCircleConfig({
    center: "O",
    radius: "92",
    points: "A:0; B:90; C:210",
    segments: "O-A:r; A-B:弦AB",
    arcs: "A-B:minor:弧AB; B-C:major:優弧BC",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.config.points[1], { label: "B", angle: 90 });
  assert.deepEqual(result.config.segments[0], { from: "O", to: "A", label: "r" });
  assert.deepEqual(result.config.arcs[1], { from: "B", to: "C", kind: "major", label: "優弧BC" });
});

test("circle rejects bad radii and references to missing points", () => {
  const result = core.parseCircleConfig({
    radius: "8",
    points: "A:0; B:90",
    segments: "O-Z:r",
    arcs: "A-Z:minor:弧AZ",
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /radius/u);
  assert.match(result.errors.join(" "), /登録済み/u);
  assert.match(result.errors.join(" "), /円周上/u);
});

test("venn-diagram accepts two sets, shading, and region labels", () => {
  const result = core.parseVennDiagramConfig({
    sets: "A:英語; B:数学",
    universe: "クラス全体",
    shade: "A&B",
    regions: "A-only | 12人; B-only | 8人; A&B | 5人; outside | 3人",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.config.sets, [{ id: "A", label: "英語" }, { id: "B", label: "数学" }]);
  assert.deepEqual(result.config.shaded, ["A&B"]);
  assert.deepEqual(result.config.regions[2], { key: "A&B", label: "5人" });
});

test("venn-diagram accepts three sets and normalizes intersection order", () => {
  const result = core.parseVennDiagramConfig({
    sets: "A:英語; B:数学; C:理科",
    shade: "C&A; C&B&A",
    regions: "C&A | 4人; C&B&A | 2人",
    "show-universe": "false",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.config.shaded, ["A&C", "A&B&C"]);
  assert.deepEqual(result.config.regions.map((region) => region.key), ["A&C", "A&B&C"]);
  assert.equal(result.config.showUniverse, false);
});

test("venn-diagram rejects invalid set counts and unknown regions", () => {
  const oneSet = core.parseVennDiagramConfig({ sets: "A:英語" });
  const unknown = core.parseVennDiagramConfig({ sets: "A:英語; B:数学", shade: "A&Z" });

  assert.equal(oneSet.ok, false);
  assert.match(oneSet.errors.join(" "), /2〜3集合/u);
  assert.equal(unknown.ok, false);
  assert.match(unknown.errors.join(" "), /登録した集合名/u);
});

test("tree-diagram accepts branches, probabilities, stages, and terminal results", () => {
  const result = core.parseTreeDiagramConfig({
    root: "S | 開始",
    branches: "S>H1 | 表 | 1/2; S>T1 | 裏 | 1/2; H1>HH | 表 | 1/2; H1>HT | 裏 | 1/2; T1>TH | 表 | 1/2; T1>TT | 裏 | 1/2",
    nodes: "H1 | 1回目が表; T1 | 1回目が裏",
    results: "HH | 表・表 | 1/4; HT | 表・裏 | 1/4; TH | 裏・表 | 1/4; TT | 裏・裏 | 1/4",
    stages: "開始; 1回目; 2回目",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.config.root, { id: "S", label: "開始" });
  assert.equal(result.config.branches.length, 6);
  assert.deepEqual(result.config.results[0], { node: "HH", label: "表・表", probability: "1/4" });
  assert.deepEqual(result.config.stages, ["開始", "1回目", "2回目"]);
});

test("tree-diagram supports labels without probabilities", () => {
  const result = core.parseTreeDiagramConfig({
    root: "S | 3枚から選ぶ",
    branches: "S>A | 赤; S>B | 青; S>C | 白",
    results: "A | 赤玉; B | 青玉; C | 白玉",
    "show-node-labels": "true",
  });

  assert.equal(result.ok, true);
  assert.equal(result.config.branches[0].probability, "");
  assert.equal(result.config.showNodeLabels, true);
});

test("tree-diagram rejects multiple parents, disconnected nodes, and nonterminal results", () => {
  const result = core.parseTreeDiagramConfig({
    root: "S | 開始",
    branches: "S>A | 表; S>B | 裏; A>C | 赤; B>C | 青; X>Y | 外; Y>X | 戻る",
    results: "A | 途中点",
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /親は1つ/u);
  assert.match(result.errors.join(" "), /つながらない/u);
  assert.match(result.errors.join(" "), /終点/u);
});

test("histogram accepts class boundaries, frequencies, axes, and value labels", () => {
  const result = core.parseHistogramConfig({
    boundaries: "0, 10, 20, 30, 40",
    frequencies: "2, 7, 9, 4",
    "x-label": "得点",
    "y-label": "人数",
    "y-max": "10",
    "y-tick": "2",
    "show-values": "true",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.config.boundaries, [0, 10, 20, 30, 40]);
  assert.deepEqual(result.config.frequencies, [2, 7, 9, 4]);
  assert.equal(result.config.yMax, 10);
  assert.equal(result.config.showValues, true);
});

test("histogram rejects uneven classes, mismatched frequencies, and a low y maximum", () => {
  const result = core.parseHistogramConfig({
    boundaries: "0, 10, 25, 35",
    frequencies: "3, 8",
    "y-max": "5",
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /階級幅/u);
  assert.match(result.errors.join(" "), /3個/u);
  assert.match(result.errors.join(" "), /最大度数以上/u);
});

test("box-plot accepts multiple series, outliers, range, and ticks", () => {
  const result = core.parseBoxPlotConfig({
    series: "A組 | 30, 45, 60, 72, 88 | 95; B組 | 35, 50, 63, 75, 90",
    range: "20, 100",
    "tick-step": "10",
    "axis-label": "得点",
  });

  assert.equal(result.ok, true);
  assert.equal(result.config.series.length, 2);
  assert.deepEqual(result.config.series[0].fiveNumber, [30, 45, 60, 72, 88]);
  assert.deepEqual(result.config.series[0].outliers, [95]);
  assert.deepEqual(result.config.range, [20, 100]);
});

test("box-plot rejects unordered summaries and outliers inside the whiskers", () => {
  const unordered = core.parseBoxPlotConfig({
    series: "A組 | 30, 65, 60, 72, 88 | 80",
  });
  const inside = core.parseBoxPlotConfig({
    series: "A組 | 30, 45, 60, 72, 88 | 80",
  });

  assert.equal(unordered.ok, false);
  assert.match(unordered.errors.join(" "), /小さい順/u);
  assert.equal(inside.ok, false);
  assert.match(inside.errors.join(" "), /最小値より小さい値/u);
});

test("scatter-plot accepts points, axes, labels, grid, and a linear trend", () => {
  const result = core.parseScatterPlotConfig({
    points: "1, 42, A; 2, 51, B; 3, 55, C; 4, 68, D",
    "x-range": "0, 5",
    "y-range": "30, 80",
    "x-tick": "1",
    "y-tick": "10",
    "x-label": "学習時間",
    "y-label": "得点",
    "show-grid": "true",
    "show-labels": "true",
    "trend-line": "linear",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.config.points[1], { x: 2, y: 51, label: "B" });
  assert.deepEqual(result.config.xRange, [0, 5]);
  assert.equal(result.config.trend.label, "傾向線");
  assert.ok(Number.isFinite(result.config.trend.slope));
});

test("scatter-plot rejects malformed and out-of-range points", () => {
  const result = core.parseScatterPlotConfig({
    points: "1, 2; 不明, 4; 3, 9, A",
    "x-range": "0, 2",
    "y-range": "0, 10",
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /有限の数値/u);
  assert.match(result.errors.join(" "), /すべての点のx座標/u);
});

test("scatter-plot rejects a linear trend when all x values are equal", () => {
  const result = core.parseScatterPlotConfig({
    points: "2, 3, A; 2, 6, B; 2, 9, C",
    "trend-line": "linear",
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /異なるx座標/u);
});

test("probability-distribution accepts a binomial distribution and interval shading", () => {
  const result = core.parseProbabilityDistributionConfig({
    distribution: "binomial",
    n: "10",
    p: "0.4",
    "x-tick": "1",
    shade: "3, 6",
  });

  assert.equal(result.ok, true);
  assert.equal(result.config.mean, 4);
  assert.equal(result.config.shade.kind, "interval");
  assert.deepEqual(result.config.xRange, [0, 10]);
});

test("probability-distribution accepts a normal distribution and one-sided shading", () => {
  const result = core.parseProbabilityDistributionConfig({
    distribution: "normal",
    mean: "50",
    sd: "10",
    "x-range": "20, 80",
    "x-tick": "10",
    shade: "left, 40",
  });

  assert.equal(result.ok, true);
  assert.equal(result.config.standardDeviation, 10);
  assert.deepEqual(result.config.shade, { kind: "left", upper: 40 });
});

test("probability-distribution rejects invalid parameters without dropping later content", () => {
  const parsed = core.parseDocument(`\`\`\`figure probability-distribution
distribution: binomial
n: 0
p: 2
shade: 1.5, 3
\`\`\`

## 後続本文

この文章は残ります。`);

  assert.ok(parsed.issues.some((issue) => issue.id.startsWith("figure-probability-distribution-")));
  assert.ok(parsed.blocks.some((block) => block.markdown.includes("この文章は残ります")));
});

test("function-graph keeps the legacy single formula syntax", () => {
  const result = core.parseFunctionGraphConfig({
    formula: "y = x^2 - 4x + 3",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.config.xRange, [-5, 5]);
  assert.equal(result.config.series.length, 1);
  assert.equal(result.config.series[0].formula, "y = x^2 - 4x + 3");
  assert.equal(result.config.series[0].style, "solid");
});

test("function-graph accepts multiple labeled functions and line styles", () => {
  const result = core.parseFunctionGraphConfig({
    functions: "y=x^2 | f(x)=x^2 | solid; y=-x+2 | g(x)=-x+2 | dashed; y=2x-1 | h(x)=2x-1 | dotted",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.config.series.map((series) => [series.label, series.style]),
    [
      ["f(x)=x^2", "solid"],
      ["g(x)=-x+2", "dashed"],
      ["h(x)=2x-1", "dotted"],
    ],
  );
});

test("function-graph accepts custom ranges, ticks, grid, and legend", () => {
  const result = core.parseFunctionGraphConfig({
    formula: "y=x^2",
    "x-range": "-2, 6",
    "y-range": "-4, 12",
    "x-tick": "1",
    "y-tick": "2",
    "show-grid": "false",
    legend: "true",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.config.xRange, [-2, 6]);
  assert.deepEqual(result.config.yRange, [-4, 12]);
  assert.equal(result.config.xTick, 1);
  assert.equal(result.config.yTick, 2);
  assert.equal(result.config.showGrid, false);
  assert.equal(result.config.showLegend, true);
});

test("function-graph accepts labeled points and auxiliary lines", () => {
  const result = core.parseFunctionGraphConfig({
    formula: "y=x^2-1",
    "x-range": "-3, 3",
    "y-range": "-2, 8",
    points: "-1,0,A,open; 0,-1,P,closed; 1,0,B",
    guides: "x=0 | x=0 | dashed; y,-1,y=-1,dotted",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.config.points[0], { x: -1, y: 0, label: "A", marker: "open" });
  assert.deepEqual(result.config.guides, [
    { axis: "x", value: 0, label: "x=0", style: "dashed" },
    { axis: "y", value: -1, label: "y=-1", style: "dotted" },
  ]);
});

test("function-graph rejects reversed ranges and overly dense ticks", () => {
  const result = core.parseFunctionGraphConfig({
    formula: "y=x",
    "x-range": "2, -2",
    "x-tick": "0.1",
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /最小値 < 最大値/u);
  assert.match(result.errors.join(" "), /30個以内/u);
});

test("function-graph rejects unsupported formulas, styles, and points outside the range", () => {
  const result = core.parseFunctionGraphConfig({
    functions: "y=sin(x) | trig | solid; y=x^2 | square | zigzag",
    "x-range": "-2, 2",
    "y-range": "-2, 2",
    points: "3,0,A",
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /5次以下の多項式/u);
  assert.match(result.errors.join(" "), /線種/u);
  assert.match(result.errors.join(" "), /表示範囲内/u);
});

test("function-graph validation reports bad Markdown without dropping later content", () => {
  const parsed = core.parseDocument(`\`\`\`figure function-graph
functions: y=x^2 | f | solid; y=-x | g | dashed
points: 0,0,O
\`\`\`

本文は残ります。

\`\`\`figure function-graph
x-range: 1, -1
\`\`\``);

  assert.ok(parsed.blocks.some((block) => block.type === "paragraph" && block.markdown.includes("本文は残ります")));
  assert.equal(parsed.issues.filter((issue) => issue.id.startsWith("figure-function-graph-")).length, 1);
});

test("new math figures are registered and validated in Markdown", () => {
  const parsed = core.parseDocument(`---
title: "図表テスト"
subject: "数学"
---

\`\`\`figure number-line
range: -3, 3
interval: -1, 2
endpoints: open, closed
\`\`\`

\`\`\`figure sign-chart
critical-points: -1, 2
signs: +, -, +
\`\`\``);

  assert.deepEqual(parsed.blocks.filter((block) => block.type === "figure").map((block) => block.figureType), ["number-line", "sign-chart"]);
  assert.equal(parsed.issues.filter((issue) => issue.id.startsWith("figure-")).length, 0);
});

test("triangle and circle are registered and validated in Markdown", () => {
  const parsed = core.parseDocument(`\`\`\`figure triangle
vertices: A, 70, 220; B, 350, 220; C, 350, 40
side-labels: A-B:c; B-C:a; C-A:b
right-angle: B
\`\`\`

\`\`\`figure circle
center: O
radius: 90
points: A:0; B:90; C:210
segments: O-A:r; A-B:弦AB
arcs: A-B:minor:弧AB
\`\`\``);

  assert.deepEqual(parsed.blocks.filter((block) => block.type === "figure").map((block) => block.figureType), ["triangle", "circle"]);
  assert.equal(parsed.issues.filter((issue) => issue.id.startsWith("figure-")).length, 0);
});

test("venn-diagram is registered and validated in Markdown", () => {
  const parsed = core.parseDocument(`\`\`\`figure venn-diagram
sets: A:英語; B:数学; C:理科
shade: A&B&C
regions: A-only | 10人; A&B&C | 2人; outside | 3人
caption: 3教科のベン図
\`\`\``);

  assert.deepEqual(parsed.blocks.filter((block) => block.type === "figure").map((block) => block.figureType), ["venn-diagram"]);
  assert.equal(parsed.issues.filter((issue) => issue.id.startsWith("figure-venn-diagram-")).length, 0);
});

test("invalid venn-diagram warns without dropping later content", () => {
  const parsed = core.parseDocument(`\`\`\`figure venn-diagram
sets: A:英語; A:数学
shade: A&Z
\`\`\`

本文は残ります。`);

  assert.ok(parsed.issues.some((issue) => issue.id.startsWith("figure-venn-diagram-")));
  assert.ok(parsed.blocks.some((block) => block.type === "paragraph" && block.markdown.includes("本文は残ります")));
});

test("tree-diagram is registered and invalid input does not drop later content", () => {
  const valid = core.parseDocument(`\`\`\`figure tree-diagram
root: S | 開始
branches: S>A | 表 | 1/2; S>B | 裏 | 1/2
results: A | 表; B | 裏
caption: 1回の試行
\`\`\``);
  const invalid = core.parseDocument(`\`\`\`figure tree-diagram
root: S | 開始
branches: S>A | 表; B>A | 裏
\`\`\`

本文は残ります。`);

  assert.deepEqual(valid.blocks.filter((block) => block.type === "figure").map((block) => block.figureType), ["tree-diagram"]);
  assert.equal(valid.issues.filter((issue) => issue.id.startsWith("figure-tree-diagram-")).length, 0);
  assert.ok(invalid.issues.some((issue) => issue.id.startsWith("figure-tree-diagram-")));
  assert.ok(invalid.blocks.some((block) => block.type === "paragraph" && block.markdown.includes("本文は残ります")));
});

test("histogram and box-plot are registered and invalid input keeps later content", () => {
  const valid = core.parseDocument(`\`\`\`figure histogram
boundaries: 0, 10, 20, 30
frequencies: 3, 7, 4
caption: 得点分布
\`\`\`

\`\`\`figure box-plot
series: A組 | 30, 45, 60, 72, 88 | 95; B組 | 35, 50, 63, 75, 90
range: 20, 100
caption: クラス比較
\`\`\``);
  const invalid = core.parseDocument(`\`\`\`figure histogram
boundaries: 0, 10, 25
frequencies: 3
\`\`\`

\`\`\`figure box-plot
series: A組 | 30, 50, 45, 70, 90
\`\`\`

本文は残ります。`);

  assert.deepEqual(valid.blocks.filter((block) => block.type === "figure").map((block) => block.figureType), ["histogram", "box-plot"]);
  assert.equal(valid.issues.filter((issue) => issue.id.startsWith("figure-histogram-") || issue.id.startsWith("figure-box-plot-")).length, 0);
  assert.ok(invalid.issues.some((issue) => issue.id.startsWith("figure-histogram-")));
  assert.ok(invalid.issues.some((issue) => issue.id.startsWith("figure-box-plot-")));
  assert.ok(invalid.blocks.some((block) => block.type === "paragraph" && block.markdown.includes("本文は残ります")));
});

test("scatter-plot is registered and invalid input keeps later content", () => {
  const valid = core.parseDocument(`\`\`\`figure scatter-plot
points: 1, 42, A; 2, 51, B; 3, 60, C
x-range: 0, 4
y-range: 30, 70
trend-line: linear
caption: 学習時間と得点
\`\`\``);
  const invalid = core.parseDocument(`\`\`\`figure scatter-plot
points: 1, 2; X, 4
\`\`\`

本文は残ります。`);

  assert.deepEqual(valid.blocks.filter((block) => block.type === "figure").map((block) => block.figureType), ["scatter-plot"]);
  assert.equal(valid.issues.filter((issue) => issue.id.startsWith("figure-scatter-plot-")).length, 0);
  assert.ok(invalid.issues.some((issue) => issue.id.startsWith("figure-scatter-plot-")));
  assert.ok(invalid.blocks.some((block) => block.type === "paragraph" && block.markdown.includes("本文は残ります")));
});

test("invalid new figures report warnings without dropping the document", () => {
  const parsed = core.parseDocument(`\`\`\`figure number-line
range: 2, -2
\`\`\`

本文は残ります。

\`\`\`figure sign-chart
critical-points: 1, 1
signs: +, -
\`\`\``);

  assert.ok(parsed.blocks.some((block) => block.type === "paragraph" && block.markdown.includes("本文は残ります")));
  assert.ok(parsed.issues.some((issue) => issue.id.startsWith("figure-number-line-")));
  assert.ok(parsed.issues.some((issue) => issue.id.startsWith("figure-sign-chart-")));
});

test("invalid triangle and circle report warnings without dropping later content", () => {
  const parsed = core.parseDocument(`\`\`\`figure triangle
vertices: A, 10, 10; B, 20, 20
\`\`\`

\`\`\`figure circle
radius: -2
points: A:0
segments: O-Z:r
\`\`\`

本文は残ります。`);

  assert.ok(parsed.issues.some((issue) => issue.id.startsWith("figure-triangle-")));
  assert.ok(parsed.issues.some((issue) => issue.id.startsWith("figure-circle-")));
  assert.ok(parsed.blocks.some((block) => block.type === "paragraph" && block.markdown.includes("本文は残ります")));
});

test("short solutions remain a single block", () => {
  const block = solutionBlock("短い解答です。");
  const prepared = core.prepareBlocksForPagination(
    [block],
    new Set([block.id]),
  );

  assert.equal(prepared.blocks.length, 1);
  assert.equal(prepared.blocks[0].id, block.id);
  assert.equal(prepared.blocks[0].continuation, undefined);
});

test("Japanese closing brackets stay with the preceding sentence", () => {
  const sentence = "生徒は変化の兆候を記録した。」";
  const markdown = Array.from(
    { length: 18 },
    (_, index) => `${index + 1}. 「${sentence}次の観察へ進んだ。`,
  ).join("");
  const block = solutionBlock(markdown);
  const prepared = core.prepareBlocksForPagination(
    [block],
    new Set([block.id]),
  );

  assert.ok(prepared.blocks.length > 1);
  for (const fragment of prepared.blocks.slice(1)) {
    assert.doesNotMatch(fragment.markdown, /^[」』】）》〕］｝〉》〗〙〛”’"'）)\]]/u);
  }
  assert.equal(
    prepared.blocks.reduce(
      (count, fragment) => count + (fragment.markdown.match(/」/gu)?.length ?? 0),
      0,
    ),
    markdown.match(/」/gu)?.length,
  );
});

test("an opening ASCII quote remains with the following English sentence", () => {
  const markdown = Array.from(
    { length: 30 },
    () => 'The observer recorded the change. "The next trial begins now." ',
  ).join("");
  const block = solutionBlock(markdown);
  const prepared = core.prepareBlocksForPagination(
    [block],
    new Set([block.id]),
  );

  assert.ok(prepared.blocks.length > 1);
  const joined = prepared.blocks.map((fragment) => fragment.markdown).join("\n\n");
  assert.match(joined, /change\.\s*"The next trial/u);
});

test("internal Markdown headings stay with the following prose", () => {
  const heading = "### 本文中の根拠";
  const fixture = headingFixture(heading);
  const fragments = forcedFragments(solutionBlock(fixture.markdown));
  const headingFragment = fragments.find((fragment) =>
    fragment.markdown.includes(heading)
  );

  assert.ok(fragments.length > 1);
  assert.ok(headingFragment);
  assert.match(headingFragment.markdown, /### 本文中の根拠\s+後続本文/u);
  assert.doesNotMatch(headingFragment.markdown.trim(), /### 本文中の根拠$/u);
});

test("standalone bold subheadings stay with the following prose", () => {
  const heading = "**3. 全文の構文・文法解説**";
  const fixture = headingFixture(heading);
  const fragments = forcedFragments(solutionBlock(fixture.markdown));
  const headingFragment = fragments.find((fragment) =>
    fragment.markdown.includes(heading)
  );

  assert.ok(headingFragment);
  assert.match(
    headingFragment.markdown,
    /\*\*3\. 全文の構文・文法解説\*\*\s+後続本文/u,
  );
});

test("a very long first paragraph is split after keeping text with its heading", () => {
  const heading = "### 詳細解説";
  const lead = "前段です。".repeat(45);
  const following = `${"非常に長い後続本文".repeat(80)}。`;
  const parsed = core.parseDocument(
    `:::solution\n${lead}\n\n${heading}\n\n${following}\n:::`,
  );
  const block = parsed.blocks.find((candidate) => candidate.type === "callout");
  const followingBlock = block.children.find((candidate) => candidate.markdown === following);
  const lineBreakOffsets = [];
  for (let offset = 120; offset < following.length; offset += 120) {
    lineBreakOffsets.push(offset);
  }
  const measurements = new Map([
    [followingBlock.id, {
      height: 1200,
      width: 600,
      clientWidth: 600,
      lineCount: lineBreakOffsets.length + 1,
      lineBreakOffsets,
      textContent: following,
    }],
  ]);
  const fragments = core.prepareBlocksForPagination(
    [block],
    new Set([block.id]),
    measurements,
    600,
  ).blocks;
  const headingFragment = fragments.find((fragment) =>
    fragment.markdown.includes(heading)
  );

  assert.ok(headingFragment);
  assert.match(headingFragment.markdown, /### 詳細解説\s+非常に長い後続本文/u);
  assert.ok(headingFragment.markdown.length <= 422);
});

test("heading-aware splitting preserves all visible text", () => {
  const fixture = headingFixture("### 本文中の根拠");
  const fragments = forcedFragments(solutionBlock(fixture.markdown));
  const compact = (value) => value.replace(/\s+/gu, "");

  assert.equal(
    compact(fragments.map((fragment) => fragment.markdown).join("")),
    compact(fixture.markdown),
  );
});

test("internal heading groups move to the next measured page as one unit", () => {
  const heading = "### 本文中の根拠";
  const fixture = headingFixture(heading);
  const fragments = forcedFragments(solutionBlock(fixture.markdown));
  const headingFragment = fragments.find((fragment) =>
    fragment.markdown.includes(heading)
  );
  assert.ok(headingFragment);

  const heights = new Map(
    fragments.map((fragment) => [
      fragment.id,
      fragment.id === headingFragment.id ? 90 : 270,
    ]),
  );
  const pages = core.paginateMeasuredDocument(fragments, heights, 300);
  const pageWithHeading = pages.find((page) =>
    page.blocks.some((block) => block.markdown.includes(heading))
  );

  assert.ok(pageWithHeading);
  assert.ok(pageWithHeading.number > 1);
  const rendered = pageWithHeading.blocks.find((block) =>
    block.markdown.includes(heading)
  );
  assert.match(rendered.markdown, /### 本文中の根拠\s+後続本文/u);
});

test("headings inside exercise containers also stay with following content", () => {
  const heading = "### 問題内の小見出し";
  const fixture = headingFixture(heading);
  const exercise = {
    ...solutionBlock(fixture.markdown, "exercise-block"),
    blockName: "exercise",
  };
  const fragments = forcedFragments(exercise);
  const headingFragment = fragments.find((fragment) =>
    fragment.markdown.includes(heading)
  );

  assert.ok(headingFragment);
  assert.match(headingFragment.markdown, /### 問題内の小見出し\s+後続本文/u);
});

test("solution fragments on the same page render as one callout", () => {
  const block = solutionBlock("説明文です。".repeat(120));
  const prepared = core.prepareBlocksForPagination(
    [block],
    new Set([block.id]),
  );
  assert.ok(prepared.blocks.length > 1);

  const heights = new Map(
    prepared.blocks.map((fragment) => [
      fragment.id,
      Math.max(1, Math.floor((1000 - prepared.blocks.length * 4) / prepared.blocks.length)),
    ]),
  );
  const pages = core.paginateMeasuredDocument(
    prepared.blocks,
    heights,
    1000,
  );

  assert.equal(pages.length, 1);
  assert.equal(pages[0].blocks.length, 1);
  assert.equal(pages[0].blocks[0].continuation, false);
  assert.deepEqual(
    pages[0].blocks[0].fragmentIds,
    prepared.blocks.map((fragment) => fragment.id),
  );
});

test("continuation appears only after an actual page boundary", () => {
  const block = solutionBlock("説明文です。".repeat(120));
  const prepared = core.prepareBlocksForPagination(
    [block],
    new Set([block.id]),
  );
  const heights = new Map(
    prepared.blocks.map((fragment) => [fragment.id, 260]),
  );
  const pages = core.paginateMeasuredDocument(
    prepared.blocks,
    heights,
    300,
  );

  assert.ok(pages.length > 1);
  assert.equal(pages[0].blocks[0].continuation, false);
  for (const page of pages.slice(1)) {
    assert.equal(page.blocks[0].continuation, true);
  }
});

test("remeasurement keeps explicit page breaks while replacing merged fragments", () => {
  const block = solutionBlock("説明文です。".repeat(90));
  const prepared = core.prepareBlocksForPagination(
    [block],
    new Set([block.id]),
  );
  const pageBreak = {
    id: "manual-break",
    type: "page-break",
    startLine: 4,
    endLine: 4,
    markdown: "",
    breakPolicy: "atomic",
  };
  const tail = {
    id: "tail",
    type: "paragraph",
    startLine: 5,
    endLine: 5,
    markdown: "次ページの本文",
    breakPolicy: "flow",
  };
  const sourceBlocks = [...prepared.blocks, pageBreak, tail];
  const heights = new Map(
    sourceBlocks.map((fragment) => [
      fragment.id,
      fragment.originBlockId === block.id
        ? Math.max(1, Math.floor((900 - prepared.blocks.length * 4) / prepared.blocks.length))
        : 60,
    ]),
  );
  const pages = core.paginateMeasuredDocument(sourceBlocks, heights, 1000);
  const measurementBlocks = core.prepareBlocksForMeasurement(
    sourceBlocks,
    pages,
  );

  assert.equal(
    measurementBlocks.filter((candidate) => candidate.type === "page-break").length,
    1,
  );
  assert.equal(measurementBlocks.at(-1).id, tail.id);
  assert.equal(
    measurementBlocks.filter((candidate) => candidate.originBlockId === block.id).length,
    1,
  );
  const merged = measurementBlocks.find((candidate) => candidate.originBlockId === block.id);
  const decomposed = core.prepareBlocksForMeasurement(
    sourceBlocks,
    pages,
    new Set([merged.id]),
  );
  assert.equal(
    decomposed.filter((candidate) => candidate.originBlockId === block.id).length,
    prepared.blocks.length,
  );
});

const separatedEditionSource = `---
lesson_id: L01
title: 分離テスト
subject: 数学
difficulty: 基礎
---

:::explanation title="解説"
共通の解説です。
:::

:::exercise id="q001" title="演習1"
次の式を計算しなさい。$x^2+2x+1$

| 条件 | 値 |
| --- | --- |
| x | 1 |
:::

:::solution for="q001" title="解答1"
$x^2+2x+1=(x+1)^2$ です。
:::
`;

test("output modes derive render blocks without mutating the parsed document", () => {
  const parsed = core.parseDocument(separatedEditionSource);
  const originalIds = parsed.blocks.map((block) => block.id);
  const complete = core.createRenderDocument(parsed, "complete", true);
  const questions = core.createRenderDocument(parsed, "questions", true);
  const splitPreview = core.createRenderDocument(parsed, "split", true);

  assert.deepEqual(complete.blocks.map((block) => block.id), originalIds);
  assert.equal(questions.blocks.some((block) => block.blockName === "solution"), false);
  assert.equal(questions.blocks.some((block) => block.blockName === "exercise"), true);
  assert.deepEqual(splitPreview.blocks, questions.blocks);
  assert.deepEqual(parsed.blocks.map((block) => block.id), originalIds);
});

test("answer edition reprints the matching question before its solution", () => {
  const parsed = core.parseDocument(separatedEditionSource);
  const answers = core.createRenderDocument(parsed, "answers", true);

  assert.deepEqual(answers.blocks.map((block) => block.blockName), ["answer-question", "solution"]);
  assert.match(answers.blocks[0].markdown, /x\^2\+2x\+1/u);
  assert.equal(answers.blocks[0].attributes["reprinted-for"], answers.blocks[1].id);
  assert.notEqual(answers.blocks[0], parsed.blocks.find((block) => block.blockName === "exercise"));
});

test("answer edition can omit the question body while keeping its title", () => {
  const parsed = core.parseDocument(separatedEditionSource);
  const answers = core.createRenderDocument(parsed, "answers", false);

  assert.equal(answers.blocks[0].type, "heading");
  assert.equal(answers.blocks[0].markdown, "演習1");
  assert.equal(answers.blocks[1].blockName, "solution");
  assert.equal(answers.blocks.some((block) => block.markdown.includes("次の式を計算")), false);
});

test("orphan answers remain renderable and relationship defects are all reported", () => {
  const parsed = core.parseDocument(`:::exercise id="q001" title="問題1"\nA\n:::\n\n:::exercise id="q001" title="重複"\nB\n:::\n\n:::exercise id="q002" title="問題2"\nC\n:::\n\n:::solution for="q001"\n解答A\n:::\n\n:::solution for="q001"\n解答B\n:::\n\n:::solution for="missing"\n孤立解答\n:::`);
  const answers = core.createRenderDocument(parsed, "answers", true);
  const titles = parsed.issues.map((issue) => issue.title).join("\n");

  assert.match(titles, /問題ID「q001」が重複/u);
  assert.match(titles, /問題「q001」に複数の解答/u);
  assert.match(titles, /参照先「missing」が見つかりません/u);
  assert.match(titles, /問題「q002」の解答がありません/u);
  assert.equal(answers.blocks.some((block) => block.markdown === "孤立解答"), true);
});

test("each output mode is repaginated from its own render blocks", () => {
  const parsed = core.parseDocument(separatedEditionSource);
  const complete = core.paginateDocument(core.createRenderDocument(parsed, "complete", true).blocks);
  const questions = core.paginateDocument(core.createRenderDocument(parsed, "questions", true).blocks);
  const answers = core.paginateDocument(core.createRenderDocument(parsed, "answers", true).blocks);

  assert.ok(complete.pages.length >= questions.pages.length);
  assert.ok(answers.pages.length >= 1);
  assert.equal(questions.pages.flatMap((page) => page.blocks).some((block) => block.blockName === "solution"), false);
});

test("edition filenames use the requested suffix and sanitize forbidden characters", () => {
  const parsed = core.parseDocument(separatedEditionSource.replace("title: 分離テスト", "title: 分離/テスト"));
  assert.equal(core.sanitizeFilename(parsed.metadata, "pdf", "完全版"), "L01_分離_テスト_数学_基礎_完全版.pdf");
  assert.equal(core.sanitizeFilename(parsed.metadata, "pdf", "問題"), "L01_分離_テスト_数学_基礎_問題.pdf");
  assert.equal(core.sanitizeFilename(parsed.metadata, "pdf", "解答"), "L01_分離_テスト_数学_基礎_解答.pdf");
});

test("quick fix closes an unterminated教材 block without changing its body", () => {
  const source = `:::example title="例題"\n本文`;
  const fix = core.collectQuickFixes(source).find((item) => item.issueId.startsWith("extension-open-"));
  assert.ok(fix);
  const fixed = core.applyQuickFix(source, fix);
  assert.equal(fixed, `:::example title="例題"\n本文\n:::`);
  assert.equal(core.parseDocument(fixed).issues.some((issue) => issue.id.startsWith("extension-open-")), false);
});

test("quick fix closes an unterminated code fence", () => {
  const source = "```mermaid\nflowchart TD\n  A --> B";
  const fix = core.collectQuickFixes(source).find((item) => item.issueId.startsWith("fence-open-"));
  assert.ok(fix);
  assert.match(core.applyQuickFix(source, fix), /\n```$/u);
});

test("quick fix inserts a missing Front Matter terminator before content", () => {
  const source = `---\ntitle: 教材\nsubject: 数学\n# 本文`;
  const fix = core.collectQuickFixes(source).find((item) => item.issueId === "frontmatter-open");
  assert.ok(fix);
  assert.equal(core.applyQuickFix(source, fix), `---\ntitle: 教材\nsubject: 数学\n---\n# 本文`);
});

test("quick fix replaces only the duplicated exercise ID", () => {
  const source = `:::exercise id="q001"\nA\n:::\n\n:::exercise id="q001"\nB\n:::`;
  const fix = core.collectQuickFixes(source).find((item) => item.issueId.startsWith("exercise-duplicate-"));
  assert.ok(fix);
  const fixed = core.applyQuickFix(source, fix);
  assert.match(fixed, /:::exercise id="q002"\nB/u);
  assert.equal((fixed.match(/id="q001"/gu) ?? []).length, 1);
});

test("known attribute typo gets a reviewable fix while unknown attributes are preserved", () => {
  const source = `:::example tittle="例題" custom="keep"\n本文\n:::`;
  const parsed = core.parseDocument(source);
  assert.ok(parsed.issues.some((issue) => issue.id.includes("tittle")));
  assert.ok(parsed.issues.some((issue) => issue.id.includes("custom")));
  const fixes = core.collectQuickFixes(source);
  const typoFix = fixes.find((item) => item.issueId.includes("tittle"));
  assert.ok(typoFix);
  const fixed = core.applyQuickFix(source, typoFix);
  assert.match(fixed, /title="例題" custom="keep"/u);
  assert.equal(fixes.some((item) => item.issueId.includes("custom")), false);
});

test("orphan solution offers candidates but no unsafe automatic reference change", () => {
  const source = `:::exercise id="q001"\n問題\n:::\n\n:::solution for="missing"\n解答\n:::`;
  assert.ok(core.parseDocument(source).issues.some((issue) => issue.id.startsWith("solution-orphan-")));
  assert.equal(core.collectQuickFixes(source).some((item) => item.issueId.startsWith("solution-orphan-")), false);
  assert.deepEqual(core.listExerciseIds(source), ["q001"]);
});

test("math errors never receive automatic content fixes", () => {
  const source = `$$\n\\frac{1}{2}`;
  assert.ok(core.parseDocument(source).issues.some((issue) => issue.id.startsWith("math-open-")));
  assert.equal(core.collectQuickFixes(source).some((item) => item.issueId.startsWith("math-open-")), false);
});

test("clearly unclosed structured quote gets a closing-quote fix", () => {
  const source = `---\ntitle: "未完了\n---\n# 本文`;
  const fix = core.collectQuickFixes(source).find((item) => item.issueId.startsWith("quote-unclosed-"));
  assert.ok(fix);
  assert.match(core.applyQuickFix(source, fix), /title: "未完了"/u);
});

test("exercise ID helper fills the first available q-number", () => {
  const source = `:::exercise id="q001"\nA\n:::\n:::exercise id="q003"\nB\n:::`;
  assert.equal(core.nextExerciseId(source), "q002");
});

test("unknown block suggestions are advisory and the original block stays renderable", () => {
  const source = `:::explanaton\n本文\n:::`;
  const parsed = core.parseDocument(source);
  assert.ok(parsed.issues.some((issue) => issue.id.startsWith("unknown-block-")));
  assert.equal(parsed.blocks[0].markdown, "本文");
  assert.equal(core.suggestKnownBlockNames("explanaton")[0], "explanation");
});
