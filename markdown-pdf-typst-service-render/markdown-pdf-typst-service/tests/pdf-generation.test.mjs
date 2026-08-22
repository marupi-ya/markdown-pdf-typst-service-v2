import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import JSZip from "jszip";
import ts from "typescript";

const source = await readFile(new URL("../app/pdf-generation.ts", import.meta.url), "utf8");
const stylesheet = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
const isolatedSource = source
  .replace(
    /import \{[\s\S]*?assertNoUnsafePagination[\s\S]*?\} from "\.\/pagination\/overflow";\s*/u,
    "const assertNoOrphanHeadings = () => {};\nconst assertNoPageOverflow = () => {};\nconst assertNoUnsafePagination = () => {};\n",
  )
  .replace(/import \{ waitForStableLayout \} from "\.\/pagination\/measure";\s*/u, "const waitForStableLayout = async () => {};\n");
const compiled = ts.transpileModule(isolatedSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText.replace(
  'import("jszip")',
  `import(${JSON.stringify(import.meta.resolve("jszip"))})`,
);
const pdf = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

test("PDF capture styles avoid color-mix values unsupported by html2canvas", () => {
  assert.doesNotMatch(stylesheet, /\bcolor-mix\(/i);
});

test("20-page教材 uses the bounded long-document capture scale", () => {
  assert.equal(pdf.pdfCaptureScaleFor(19), 1.5);
  assert.equal(pdf.pdfCaptureScaleFor(20), 1);
  assert.equal(pdf.pdfCaptureScaleFor(30), 1);
  assert.equal(pdf.pdfCaptureConcurrencyFor(19), 1);
  assert.equal(pdf.pdfCaptureConcurrencyFor(20), 3);
  assert.equal(pdf.pdfCaptureConcurrencyFor(30), 3);
});

test("PDF image readiness is parallel and html2canvas has no duplicate five-second wait", () => {
  assert.match(source, /await Promise\.all\(images\.map/u);
  assert.match(source, /imageTimeout:\s*500/u);
  assert.doesNotMatch(source, /imageTimeout:\s*5000/u);
});

test("PDF capture repairs html2canvas font-metric probes instead of offsetting math", () => {
  assert.match(source, /html2canvas-font-metrics/u);
  assert.match(stylesheet, /\.html2canvas-font-metrics[\s\S]*?img\[width="1"\]\[height="1"\][\s\S]*?display:\s*inline-block\s*!important;/u);
  assert.doesNotMatch(stylesheet, /\.inline-math[^}]*\b(?:top|transform):/su);
});

test("the latest generated PDF remains available for post-export verification", () => {
  assert.match(source, /data-last-generated-pdf/u);
  assert.match(source, /anchor\.dataset\.lastGeneratedPdf\s*=\s*"true"/u);
  assert.doesNotMatch(source, /setTimeout\(\(\)\s*=>\s*URL\.revokeObjectURL/u);
});

test("solution callouts keep a complete print-safe frame", () => {
  const rules = [...stylesheet.matchAll(/(?:^|\n)\.callout-solution\s*\{([\s\S]*?)\}/gu)];
  const rule = rules.at(-1)?.[1] ?? "";
  assert.match(rule, /border-color:\s*var\(--lesson-accent\)/u);
  assert.match(rule, /border-style:\s*solid/u);
  assert.match(rule, /border-width:\s*2px/u);
  assert.match(rule, /box-decoration-break:\s*clone/u);
  assert.doesNotMatch(rule, /border-style:\s*dashed/u);
});

test("boxed formulas use a stylesheet matching the KaTeX renderer", async () => {
  const require = createRequire(import.meta.url);
  const rendererEntry = require.resolve("rehype-katex");
  const rendererRequire = createRequire(rendererEntry);
  const rendererKatexEntry = rendererRequire.resolve("katex");
  const stylesheetKatexEntry = require.resolve("katex");
  const rendererKatex = rendererRequire(rendererKatexEntry);
  const rendered = rendererKatex.renderToString("\\boxed{7x+4}", { output: "html" });
  const katexStylesheet = await readFile(
    join(dirname(stylesheetKatexEntry), "katex.css"),
    "utf8",
  );

  const stretchyClass = /class="([^"]*\bstretchy\b[^"]*)"/u.exec(rendered)?.[1]
    ?.split(/\s+/u)
    .find((className) => className.includes("stretchy"));
  assert.ok(stretchyClass, "boxed formula must render a stretchy frame element");
  assert.match(
    katexStylesheet,
    new RegExp(`\\.katex \\.${stretchyClass}\\s*\\{`, "u"),
    `the imported KaTeX CSS must size .${stretchyClass}`,
  );
});

test("a report-only ZIP is produced when every material fails", async () => {
  const reportJson = JSON.stringify({ total: 2, success: 0, warning: 0, failed: 2 });
  const reportText = "2教材とも変換に失敗しました";
  const blob = await pdf.createBatchZip([], reportJson, reportText);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());

  assert.deepEqual(Object.keys(zip.files).sort(), [
    "reports/",
    "reports/batch-result.json",
    "reports/batch-result.txt",
  ]);
  assert.equal(await zip.file("reports/batch-result.json").async("string"), reportJson);
  assert.equal(await zip.file("reports/batch-result.txt").async("string"), reportText);
});

test("ZIP keeps generated PDFs beside both batch reports", async () => {
  const blob = await pdf.createBatchZip(
    [{ fileName: "001_速度_物理_L1_問題.pdf", blob: new TextEncoder().encode("pdf"), pageCount: 1 }],
    "{}",
    "完了",
  );
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());

  assert.ok(zip.file("001_速度_物理_L1_問題.pdf"));
  assert.ok(zip.file("reports/batch-result.json"));
  assert.ok(zip.file("reports/batch-result.txt"));
});
