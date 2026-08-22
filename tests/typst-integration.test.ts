import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import test from "node:test";
import { buildTypstAst } from "../app/pdf-engine/typst/ast";
import type { TypstBlockNode, TypstCompileRequest } from "../app/pdf-engine/typst/types";
import { DEFAULT_SETTINGS } from "../app/theme-settings";
import { SAMPLES } from "../app/studio-core";
import { compileWithTypstCli, getTypstCompilerStatus } from "../server/typst-cli-compiler";

const fixtureNames = [
  "test-1-japanese.md",
  "test-2-english.md",
  "test-3-mathematics.md",
  "test-4-physics.md",
  "test-5-long-explanation.md",
  "test-6-boundary.md",
] as const;

function collectMermaid(nodes: TypstBlockNode[]) {
  const paths: string[] = [];
  const visit = (node: TypstBlockNode) => {
    if (node.type === "Figure" && node.figureType === "mermaid") paths.push(node.assetPath);
    if (
      node.type === "Problem"
      || node.type === "Answer"
      || node.type === "Explanation"
      || node.type === "Point"
      || node.type === "Example"
      || node.type === "Warning"
    ) node.children.forEach(visit);
  };
  nodes.forEach(visit);
  return paths;
}

function request(markdown: string): TypstCompileRequest {
  const ast = buildTypstAst(markdown);
  const mermaidAssets = Object.fromEntries(collectMermaid(ast.children).map((path) => [path, `
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="180" viewBox="0 0 640 180">
  <rect width="640" height="180" fill="#f4f9fd"/>
  <path d="M90 90 H270 M370 90 H550" stroke="#1769aa" stroke-width="3"/>
  <path d="M260 82 L275 90 L260 98 M540 82 L555 90 L540 98" fill="none" stroke="#1769aa" stroke-width="3"/>
  <text x="80" y="70" font-family="Noto Sans Japanese" font-size="18">開始</text>
  <text x="300" y="70" font-family="Noto Sans Japanese" font-size="18">変化</text>
  <text x="560" y="70" font-family="Noto Sans Japanese" font-size="18">結果</text>
</svg>`]));
  return {
    markdown,
    outputMode: "complete",
    includeQuestionInAnswer: true,
    settings: DEFAULT_SETTINGS,
    theme: "standard-blue",
    mermaidAssets,
  };
}

test("official Typst CLI creates six QA PDFs and compiles ten教材 without loss warnings", async (context) => {
  assert.ok(process.env.TYPST_FONT_PATHS, "TYPST_FONT_PATHS must point to a Japanese-capable font directory");
  const status = await getTypstCompilerStatus();
  assert.match(status.version, /^typst 0\.15\./u);
  const outputDirectory = resolve("output/pdf");
  await mkdir(outputDirectory, { recursive: true });

  const fixtureResults: Array<{ name: string; pages: number; bytes: number }> = [];
  for (const fixtureName of fixtureNames) {
    await context.test(fixtureName, async () => {
      const markdown = await readFile(new URL(`./fixtures/typst/${fixtureName}`, import.meta.url), "utf8");
      const compileRequest = request(markdown);
      if (fixtureName === "test-2-english.md") {
        compileRequest.settings = { ...compileRequest.settings, fontSize: 11.5, lineHeight: 1.85 };
      }
      if (["test-1-japanese.md", "test-6-boundary.md"].includes(fixtureName)) {
        compileRequest.settings = { ...compileRequest.settings, fontSize: 16, lineHeight: 2 };
      }
      if (fixtureName === "test-5-long-explanation.md") {
        compileRequest.settings = { ...compileRequest.settings, fontSize: 12, lineHeight: 1.9 };
      }
      const result = await compileWithTypstCli(compileRequest);
      assert.ok(result.pdf.length > 10_000);
      assert.ok(result.pageCount >= 1);
      assert.equal(result.textValidation.performed, true);
      assert.ok(result.textValidation.matchedSamples >= 1);
      if (["test-1-japanese.md", "test-2-english.md", "test-5-long-explanation.md"].includes(fixtureName)) {
        assert.ok(result.pageCount > 1, `${fixtureName} must exercise automatic page breaking`);
      }
      if (fixtureName === "test-6-boundary.md") assert.ok(result.pageCount > 2, "boundary fixture must exercise automatic and explicit page breaks");
      const outputName = basename(fixtureName, ".md").replace(/^test-/u, "typst-test-") + ".pdf";
      await writeFile(resolve(outputDirectory, outputName), result.pdf);
      fixtureResults.push({ name: outputName, pages: result.pageCount, bytes: result.pdf.length });
    });
  }

  const paginationStress = await readFile(new URL("./fixtures/pagination-stress.md", import.meta.url), "utf8");
  const regressions = {
    math: SAMPLES.math.source,
    physics: SAMPLES.physics.source,
    english: SAMPLES.english.source,
    paginationStress,
  };
  for (const [sampleName, source] of Object.entries(regressions)) {
    await context.test(`existing-sample-${sampleName}`, async () => {
      const result = await compileWithTypstCli(request(source));
      assert.ok(result.pdf.length > 10_000);
      assert.ok(result.pageCount >= 1);
      assert.ok(result.textValidation.matchedSamples >= 1);
    });
  }

  assert.equal(fixtureResults.length, 6);
});
