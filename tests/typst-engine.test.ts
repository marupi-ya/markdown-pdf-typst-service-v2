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
  assert.equal(answer?.policy.allowBreak, true);
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

test("request validation rejects arbitrary asset paths", () => {
  assert.throws(() => validateTypstCompileRequest({
    ...request("# Safe"),
    mermaidAssets: { "../../secret.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>" },
  }), /許可されていないMermaid資産パス/u);
});

