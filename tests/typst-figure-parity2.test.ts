import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildTypstAst } from "../app/pdf-engine/typst/ast";
import { generateFigureSvg } from "../app/pdf-engine/typst/figure-svg";

const markdown = readFileSync(new URL("./fixtures/typst/figure-parity2.md", import.meta.url), "utf8");
const figures = buildTypstAst(markdown).children.filter((node) => node.type === "Figure");
const svg = (index: number) => {
  const figure = figures[index];
  assert.ok(figure && figure.type === "Figure");
  return generateFigureSvg(figure);
};

test("fixture survives input to Typst AST with all six figures", () => {
  assert.deepEqual(figures.map((figure) => figure.figureType), [
    "function-graph", "tree-diagram", "box-plot", "scatter-plot",
    "probability-distribution", "probability-distribution",
  ]);
  assert.equal(figures[0].params.legend, "true");
  assert.match(figures[1].params.results, /表・表/u);
  assert.equal(figures[2].params["axis-label"], "得点");
  assert.equal(figures[3].params["trend-label"], "右上がりの傾向");
  assert.equal(figures[4].params["show-parameters"], "true");
});

test("function graph legend reaches PDF SVG", () => {
  assert.match(svg(0), /class="graph-legend"/u);
  assert.match(svg(0), />放物線<\/text>/u);
  assert.match(svg(0), />直線<\/text>/u);
});

test("tree stages and terminal results reach PDF SVG", () => {
  const output = svg(1);
  for (const label of ["開始", "1回目", "2回目", "表・表", "裏・裏", "1/4"]) assert.match(output, new RegExp(`>${label}<\\/text>`, "u"));
});

test("box plot range, tick grid and axis label reach PDF SVG", () => {
  const output = svg(2);
  assert.match(output, /class="box-plot-grid"/u);
  assert.match(output, />20<\/text>/u);
  assert.match(output, />100<\/text>/u);
  assert.match(output, />得点<\/text>/u);
});

test("scatter axis labels, ticks, grid and trend label reach PDF SVG", () => {
  const output = svg(3);
  assert.match(output, /class="scatter-grid"/u);
  assert.match(output, />学習時間<\/text>/u);
  assert.match(output, />得点<\/text>/u);
  assert.match(output, />右上がりの傾向<\/text>/u);
  assert.match(output, />80<\/text>/u);
});

test("binomial ticks, axis label and parameter line reach PDF SVG", () => {
  const output = svg(4);
  assert.match(output, /class="probability-grid"/u);
  assert.match(output, />成功回数<\/text>/u);
  assert.match(output, /二項分布.*n=10.*p=0.4/u);
  assert.match(output, />10<\/text>/u);
});

test("normal ticks, axis label and parameter line reach PDF SVG", () => {
  const output = svg(5);
  assert.match(output, /class="probability-grid"/u);
  assert.match(output, />点数<\/text>/u);
  assert.match(output, /正規分布.*μ=50.*σ=10/u);
  assert.match(output, />80<\/text>/u);
});

test("legend and parameter labels respect explicit false settings", () => {
  const graph = buildTypstAst("```figure function-graph\nformula: y=x\nlegend: false\n```").children.find((node) => node.type === "Figure");
  const normal = buildTypstAst("```figure probability-distribution\ndistribution: normal\nmean: 0\nsd: 1\nshow-parameters: false\n```").children.find((node) => node.type === "Figure");
  assert.ok(graph && graph.type === "Figure");
  assert.ok(normal && normal.type === "Figure");
  assert.doesNotMatch(generateFigureSvg(graph), /class="graph-legend"/u);
  assert.doesNotMatch(generateFigureSvg(normal), /class="probability-parameter-label"/u);
});

test("long tree root and result labels wrap inside the SVG margins", () => {
  const tree = buildTypstAst("```figure tree-diagram\nroot: S | とても長い開始点の説明ラベル\nbranches: S>A | 表 | 1/2; S>B | 裏 | 1/2\nresults: A | とても長い終点結果の説明ラベルです | 1/2; B | 裏の結果 | 1/2\n```").children.find((node) => node.type === "Figure");
  assert.ok(tree && tree.type === "Figure");
  const output = generateFigureSvg(tree);
  assert.match(output, /x="101"[^>]*>とても長い開始点/u);
  assert.match(output, /x="457"[^>]*>とても長い終点結果の/u);
  assert.match(output, />1\/2<\/text>/u);
});
