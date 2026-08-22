import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const sourceUrl = new URL("../app/batch-core.ts", import.meta.url);
const source = await readFile(sourceUrl, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const batch = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

function jobs(count) {
  return batch.createBatchJobs(Array.from({ length: count }, (_, index) => ({
    fileName: `${String(index + 1).padStart(3, "0")}_教材.md`,
    sourceMarkdown: `# 教材${index + 1}`,
  })));
}

test("creates queues for 1, 5, 10, and 20 Markdown files", () => {
  for (const count of [1, 5, 10, 20]) {
    const created = jobs(count);
    assert.equal(created.length, count);
    assert.ok(created.every((job) => job.status === "waiting"));
    assert.equal(new Set(created.map((job) => job.id)).size, count);
  }
});

test("runs 20 materials strictly one at a time and preserves selection order", async () => {
  const created = jobs(20);
  const order = [];
  let active = 0;
  let maxActive = 0;

  const result = await batch.runBatchSequentially(created, async (job) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    order.push(job.fileName);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
    return { status: "success", outputFiles: [`${job.fileName}.pdf`], pageCount: 1 };
  });

  assert.equal(maxActive, 1);
  assert.deepEqual(order, created.map((job) => job.fileName));
  assert.ok(result.every((job) => job.status === "success"));
});

test("one failed material does not stop the remaining queue", async () => {
  const created = jobs(5);
  const visited = [];
  const result = await batch.runBatchSequentially(created, async (job, index) => {
    visited.push(index);
    if (index === 2) throw new Error("Front Matter解析エラー");
    return { status: index === 4 ? "warning" : "success", outputFiles: [`${index}.pdf`], pageCount: index + 1 };
  });

  assert.deepEqual(visited, [0, 1, 2, 3, 4]);
  assert.deepEqual(result.map((job) => job.status), ["success", "success", "failed", "success", "warning"]);
  assert.match(result[2].errors[0].detail, /Front Matter/u);
});

test("cleanup runs after both success and failure", async () => {
  const cleaned = [];
  await batch.runBatchSequentially(
    jobs(4),
    async (_job, index) => {
      if (index === 1) throw new Error("PDF生成エラー");
      return { status: "success", outputFiles: [`${index}.pdf`], pageCount: 1 };
    },
    { cleanupJob: (job) => cleaned.push([job.fileName, job.status]) },
  );

  assert.deepEqual(cleaned.map((item) => item[1]), ["success", "failed", "success", "success"]);
});

test("cleanup isolates page, SVG, math, and QA state before the next material", async () => {
  const renderState = {
    pageNumber: 0,
    svg: [],
    math: [],
    warnings: [],
  };
  const snapshots = [];

  const result = await batch.runBatchSequentially(
    jobs(5),
    async (_job, index) => {
      assert.deepEqual(renderState, {
        pageNumber: 0,
        svg: [],
        math: [],
        warnings: [],
      });
      renderState.pageNumber = 1;
      renderState.svg.push(`mermaid-${index}`);
      renderState.math.push(`math-${index}`);
      renderState.warnings.push(`qa-${index}`);
      snapshots.push(structuredClone(renderState));
      if (index === 2) throw new Error("図表エラー");
      return {
        status: "success",
        outputFiles: [`${index}.pdf`],
        warnings: [{ title: `qa-${index}`, detail: "教材固有" }],
        pageCount: 1,
      };
    },
    {
      cleanupJob: () => {
        renderState.pageNumber = 0;
        renderState.svg.length = 0;
        renderState.math.length = 0;
        renderState.warnings.length = 0;
      },
    },
  );

  assert.equal(snapshots.length, 5);
  assert.deepEqual(result.map((job) => job.status), ["success", "success", "failed", "success", "success"]);
  assert.ok(result.every((job, index) =>
    job.status === "failed" || job.warnings.every((warning) => warning.title === `qa-${index}`),
  ));
});

test("Markdown, math, Mermaid, and PDF failures each allow later jobs to continue", async () => {
  for (const [failureIndex, message] of [
    [2, "Front Matter解析エラー"],
    [4, "数式エラー"],
    [1, "Mermaidエラー"],
    [3, "PDF生成エラー"],
  ]) {
    const visited = [];
    const result = await batch.runBatchSequentially(jobs(6), async (_job, index) => {
      visited.push(index);
      if (index === failureIndex) throw new Error(message);
      return { status: "success", outputFiles: [`${index}.pdf`], pageCount: 1 };
    });

    assert.deepEqual(visited, [0, 1, 2, 3, 4, 5]);
    assert.equal(result[failureIndex].status, "failed");
    assert.match(result[failureIndex].errors[0].detail, new RegExp(message));
  }
});

test("a stop request waits for the current material and cancels only later jobs", async () => {
  let stop = false;
  const result = await batch.runBatchSequentially(
    jobs(4),
    async () => {
      stop = true;
      return { status: "success", outputFiles: ["first.pdf"], pageCount: 1 };
    },
    { shouldStop: () => stop },
  );

  assert.deepEqual(result.map((job) => job.status), ["success", "cancelled", "cancelled", "cancelled"]);
});

test("split output stays inside one material as question then answer", () => {
  assert.deepEqual(batch.editionModesForOutput("complete"), ["complete"]);
  assert.deepEqual(batch.editionModesForOutput("questions"), ["questions"]);
  assert.deepEqual(batch.editionModesForOutput("answers"), ["answers"]);
  assert.deepEqual(batch.editionModesForOutput("split"), ["questions", "answers"]);
});

test("duplicate PDF names are resolved without overwriting", () => {
  const used = new Set();
  assert.equal(batch.uniqueOutputFilename("001_速度.pdf", used), "001_速度.pdf");
  assert.equal(batch.uniqueOutputFilename("001_速度.pdf", used), "001_速度_2.pdf");
  assert.equal(batch.uniqueOutputFilename("001_速度.pdf", used), "001_速度_3.pdf");
});

test("batch reports contain counts, per-material times, outputs, warnings, and errors", async () => {
  const result = await batch.runBatchSequentially(jobs(3), async (_job, index) => {
    if (index === 2) throw new Error("Mermaidエラー");
    return {
      status: index === 1 ? "warning" : "success",
      outputFiles: [`lesson-${index}.pdf`],
      warnings: index === 1 ? [{ title: "数式を縮小", detail: "90%" }] : [],
      pageCount: 12 + index,
    };
  });
  const report = batch.createBatchResultReport(result);
  const text = batch.formatBatchResultText(report);

  assert.deepEqual(
    { total: report.total, success: report.success, warning: report.warning, failed: report.failed },
    { total: 3, success: 1, warning: 1, failed: 1 },
  );
  assert.ok(report.jobs.every((job) => job.startedAt && job.finishedAt));
  assert.match(text, /lesson-0\.pdf/u);
  assert.match(text, /数式を縮小/u);
  assert.match(text, /Mermaidエラー/u);
});

test("ZIP filename uses the Japan date", () => {
  const date = new Date("2026-08-06T15:30:00.000Z");
  assert.equal(batch.batchZipFilename(date), "教材PDF_2026-08-07.zip");
});

test("batch implementation contains no material-level Promise.all", async () => {
  const client = await readFile(new URL("../app/studio-client.tsx", import.meta.url), "utf8");
  const pdf = await readFile(new URL("../app/pdf-generation.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Promise\.all/u);
  assert.doesNotMatch(client, /Promise\.all/u);
  assert.match(client, /runBatchSequentially/u);
  assert.equal((client.match(/generateMaterialPdf\(container\)/gu) ?? []).length, 2);
  assert.match(client, /createBatchZip\(/u);
  assert.match(pdf, /pdfCaptureConcurrencyFor/u);
});
