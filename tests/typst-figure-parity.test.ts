import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { generateTypstProject } from "../app/pdf-engine/typst/generator";
import { DEFAULT_SETTINGS } from "../app/theme-settings";

const markdown = readFileSync(new URL("./fixtures/typst/figure-parity.md", import.meta.url), "utf8");
const project = generateTypstProject({
  markdown,
  outputMode: "complete",
  includeQuestionInAnswer: true,
  settings: DEFAULT_SETTINGS,
  theme: "prep-school-blue",
});
const figure = (type: string) => project.assets.find((asset) => asset.path.endsWith(`-${type}.svg`))?.contents ?? "";

test("triangle right-angle marker reaches the Typst SVG asset", () => {
  assert.match(figure("triangle"), /<polyline points="[^"]+" fill="none" stroke="#[0-9a-f]{6}" stroke-width="1\.8"\/>/u);
});

test("circle arc and its label reach the Typst SVG asset", () => {
  assert.match(figure("circle"), /<path d="M [^"]+ A 80 80 0 0 [01] [^"]+" fill="none"/u);
  assert.match(figure("circle"), />弧AB<\/text>/u);
});

test("Venn region numbers reach the Typst SVG asset", () => {
  const svg = figure("venn-diagram");
  for (const value of ["12", "5", "8", "3"]) assert.match(svg, new RegExp(`>${value}<\\/text>`, "u"));
});

test("number-line baseline and ticks remain in the Typst SVG asset", () => {
  const svg = figure("number-line");
  assert.match(svg, /<line class="axis" x1="55" y1="105" x2="585" y2="105"\/>/u);
  assert.match(svg, />-2<\/text>/u);
  assert.match(svg, />4<\/text>/u);
});

test("normal distribution shaded region reaches the Typst SVG asset", () => {
  const svg = figure("probability-distribution");
  assert.match(svg, /<polygon points="[^"]+" fill="#d8560a" fill-opacity="0\.28"\/>/u);
  assert.match(svg, /<polyline class="line"/u);
});

test("binomial shade highlights only requested bars", () => {
  const source = `# Binomial\n\n\`\`\`figure probability-distribution\ndistribution: binomial\nn: 4\np: 0.5\nshade: 1, 2\n\`\`\``;
  const result = generateTypstProject({ markdown: source, outputMode: "complete", includeQuestionInAnswer: true, settings: DEFAULT_SETTINGS, theme: "standard-blue" });
  const svg = result.assets[0].contents;
  assert.equal((svg.match(/fill="#d8560a"/gu) ?? []).length, 2);
  assert.equal((svg.match(/fill="#1769aa"/gu) ?? []).length, 3);
});
