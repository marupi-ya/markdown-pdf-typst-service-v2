import type { OutputMode } from "./studio-core";
import type { StudioSettings } from "./theme-settings";

export type BatchJobStatus =
  | "waiting"
  | "processing"
  | "success"
  | "warning"
  | "failed"
  | "cancelled";

export type BatchMessage = {
  line?: number;
  title: string;
  detail: string;
};

export type BatchQaReport = Record<string, unknown>;

export type BatchJob = {
  id: string;
  fileName: string;
  sourceMarkdown: string;
  status: BatchJobStatus;
  startedAt: string | null;
  finishedAt: string | null;
  outputFiles: string[];
  warnings: BatchMessage[];
  errors: BatchMessage[];
  qaReport: BatchQaReport | null;
  pageCount: number;
};

export type BatchOptions = {
  outputMode: OutputMode;
  includeQuestionInAnswer: boolean;
  settings: StudioSettings;
};

export type BatchJobOutcome = {
  status: "success" | "warning";
  outputFiles: string[];
  warnings?: BatchMessage[];
  errors?: BatchMessage[];
  qaReport?: BatchQaReport | null;
  pageCount: number;
};

export type BatchProgress = {
  completed: number;
  total: number;
  currentIndex: number | null;
};

export type BatchRunHooks = {
  shouldStop?: () => boolean;
  cleanupJob?: (job: BatchJob) => void | Promise<void>;
  onJobsChange?: (jobs: BatchJob[], progress: BatchProgress) => void;
};

export type BatchResultReport = {
  generatedAt: string;
  total: number;
  success: number;
  warning: number;
  failed: number;
  cancelled: number;
  jobs: Array<{
    fileName: string;
    status: BatchJobStatus;
    pageCount: number;
    outputFiles: string[];
    warnings: BatchMessage[];
    errors: BatchMessage[];
    startedAt: string | null;
    finishedAt: string | null;
    qaReport: BatchQaReport | null;
  }>;
};

function cloneJobs(jobs: BatchJob[]) {
  return jobs.map((job) => ({
    ...job,
    outputFiles: [...job.outputFiles],
    warnings: [...job.warnings],
    errors: [...job.errors],
  }));
}

function errorMessage(error: unknown): BatchMessage {
  return {
    title: "PDF変換に失敗しました",
    detail: error instanceof Error ? error.message : String(error || "不明なエラー"),
  };
}

export function createBatchJobs(
  files: Array<{ fileName: string; sourceMarkdown: string }>,
): BatchJob[] {
  return files.map((file, index) => ({
    id: `batch-${Date.now().toString(36)}-${index + 1}`,
    fileName: file.fileName,
    sourceMarkdown: file.sourceMarkdown,
    status: "waiting",
    startedAt: null,
    finishedAt: null,
    outputFiles: [],
    warnings: [],
    errors: [],
    qaReport: null,
    pageCount: 0,
  }));
}

export function editionModesForOutput(outputMode: OutputMode) {
  return outputMode === "split"
    ? ["questions", "answers"] as const
    : [outputMode as Exclude<OutputMode, "split">];
}

export async function runBatchSequentially(
  initialJobs: BatchJob[],
  processJob: (job: BatchJob, index: number) => Promise<BatchJobOutcome>,
  hooks: BatchRunHooks = {},
) {
  const jobs = cloneJobs(initialJobs);
  const total = jobs.length;
  let completed = 0;

  const publish = (currentIndex: number | null) => {
    hooks.onJobsChange?.(cloneJobs(jobs), { completed, total, currentIndex });
  };

  publish(null);
  for (let index = 0; index < jobs.length; index += 1) {
    if (hooks.shouldStop?.()) {
      for (let pending = index; pending < jobs.length; pending += 1) {
        if (jobs[pending].status === "waiting") jobs[pending].status = "cancelled";
      }
      publish(null);
      break;
    }

    const job = jobs[index];
    job.status = "processing";
    job.startedAt = new Date().toISOString();
    job.finishedAt = null;
    job.outputFiles = [];
    job.warnings = [];
    job.errors = [];
    job.qaReport = null;
    job.pageCount = 0;
    publish(index);

    try {
      const outcome = await processJob({ ...job }, index);
      job.status = outcome.status;
      job.outputFiles = [...outcome.outputFiles];
      job.warnings = [...(outcome.warnings ?? [])];
      job.errors = [...(outcome.errors ?? [])];
      job.qaReport = outcome.qaReport ?? null;
      job.pageCount = outcome.pageCount;
    } catch (error) {
      job.status = "failed";
      job.errors = [errorMessage(error)];
    } finally {
      try {
        await hooks.cleanupJob?.({ ...job });
      } catch (cleanupError) {
        job.warnings.push({
          title: "後片付けの一部に失敗しました",
          detail: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
        });
        if (job.status === "success") job.status = "warning";
      }
      job.finishedAt = new Date().toISOString();
      completed += 1;
      publish(index);
    }
  }

  publish(null);
  return jobs;
}

export function uniqueOutputFilename(fileName: string, usedNames: Set<string>) {
  const normalized = fileName || "教材.pdf";
  if (!usedNames.has(normalized)) {
    usedNames.add(normalized);
    return normalized;
  }

  const dot = normalized.lastIndexOf(".");
  const stem = dot > 0 ? normalized.slice(0, dot) : normalized;
  const extension = dot > 0 ? normalized.slice(dot) : "";
  let suffix = 2;
  let candidate = `${stem}_${suffix}${extension}`;
  while (usedNames.has(candidate)) {
    suffix += 1;
    candidate = `${stem}_${suffix}${extension}`;
  }
  usedNames.add(candidate);
  return candidate;
}

export function createBatchResultReport(jobs: BatchJob[]): BatchResultReport {
  return {
    generatedAt: new Date().toISOString(),
    total: jobs.length,
    success: jobs.filter((job) => job.status === "success").length,
    warning: jobs.filter((job) => job.status === "warning").length,
    failed: jobs.filter((job) => job.status === "failed").length,
    cancelled: jobs.filter((job) => job.status === "cancelled").length,
    jobs: jobs.map((job) => ({
      fileName: job.fileName,
      status: job.status,
      pageCount: job.pageCount,
      outputFiles: [...job.outputFiles],
      warnings: [...job.warnings],
      errors: [...job.errors],
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      qaReport: job.qaReport,
    })),
  };
}

const STATUS_LABELS: Record<BatchJobStatus, string> = {
  waiting: "待機中",
  processing: "処理中",
  success: "成功",
  warning: "警告付き成功",
  failed: "失敗",
  cancelled: "停止",
};

export function formatBatchResultText(report: BatchResultReport) {
  const lines = [
    "Markdown教材PDF Studio 一括変換結果",
    `生成日時: ${report.generatedAt}`,
    `合計: ${report.total} / 成功: ${report.success} / 警告付き成功: ${report.warning} / 失敗: ${report.failed} / 停止: ${report.cancelled}`,
    "",
  ];
  for (const job of report.jobs) {
    lines.push(`[${STATUS_LABELS[job.status]}] ${job.fileName}`);
    lines.push(`  ページ数: ${job.pageCount}`);
    lines.push(`  生成PDF: ${job.outputFiles.length ? job.outputFiles.join(", ") : "なし"}`);
    for (const warning of job.warnings) {
      lines.push(`  警告${warning.line ? `（${warning.line}行目）` : ""}: ${warning.title} - ${warning.detail}`);
    }
    for (const error of job.errors) {
      lines.push(`  エラー${error.line ? `（${error.line}行目）` : ""}: ${error.title} - ${error.detail}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function batchZipFilename(date = new Date()) {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `教材PDF_${value("year")}-${value("month")}-${value("day")}.zip`;
}
