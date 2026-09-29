import assert from "node:assert/strict";
import test from "node:test";
import { buildTypstAst } from "../app/pdf-engine/typst/ast";
import { generateFigureSvg } from "../app/pdf-engine/typst/figure-svg";
import { functionGraphPlotBounds, parseFunctionGraphConfig } from "../app/studio-core";

test("equal-axis graph uses the same pixel length for x and y units", () => {
  const config = parseFunctionGraphConfig({
    functions: "y=2x+1; y=-0.5x+1",
    "x-range": "-6, 6",
    "y-range": "-2, 4",
    "axis-scale": "equal",
  });
  assert.equal(config.ok, true);
  const bounds = functionGraphPlotBounds(
    config.config.xRange,
    config.config.yRange,
    config.config.axisScale,
    { left: 54, right: 615, top: 30, bottom: 312 },
  );
  assert.ok(Math.abs((bounds.right - bounds.left) / 12 - (bounds.bottom - bounds.top) / 6) < 1e-9);
});

test("PDF function graph clips plotted curves to the equal-scale frame", () => {
  const ast = buildTypstAst(`\`\`\`figure function-graph
functions: y=2x+1 | 直線1 | solid; y=-0.5x+1 | 直線2 | dashed
x-range: -6, 6
y-range: -2, 4
axis-scale: equal
points: 0,1,P,closed
\`\`\``);
  const figure = ast.children.find((node) => node.type === "Figure");
  assert.ok(figure && figure.type === "Figure");
  const svg = generateFigureSvg(figure);
  const plot = svg.match(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="none" stroke="#657786"\/>/u);
  assert.ok(plot);
  const [left, top, width, height] = plot.slice(1).map(Number);
  const polylines = [...svg.matchAll(/<polyline class="line"[^>]+points="([^"]+)"\/>/gu)];
  assert.equal(polylines.length, 2);
  for (const polyline of polylines) {
    for (const pair of polyline[1].split(" ")) {
      const [x, y] = pair.split(",").map(Number);
      assert.ok(x >= left - 0.01 && x <= left + width + 0.01, `x outside plot: ${x}`);
      assert.ok(y >= top - 0.01 && y <= top + height + 0.01, `y outside plot: ${y}`);
    }
  }
  assert.doesNotMatch(svg, /clip-path=/u);
});

test("legacy graph scale stays automatic and unknown scales fail validation", () => {
  const legacy = parseFunctionGraphConfig({ formula: "y=x" });
  assert.equal(legacy.ok, true);
  assert.equal(legacy.config.axisScale, "auto");
  const invalid = parseFunctionGraphConfig({ formula: "y=x", "axis-scale": "stretched" });
  assert.equal(invalid.ok, false);
});
