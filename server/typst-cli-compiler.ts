import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { generateTypstProject } from "../app/pdf-engine/typst/generator";
import { typstErrorPayload } from "../app/pdf-engine/typst/errors";
import { validateTypstCompileRequest } from "../app/pdf-engine/typst/request";
import type {
  GeneratedTypstProject,
  TypstCompileErrorPayload,
  TypstCompileRequest,
  TypstSourceMapEntry,
} from "../app/pdf-engine/typst/types";

const execFileAsync = promisify(execFile);
const COMPILE_TIMEOUT_MS = 45_000;
const MAX_DIAGNOSTIC_BYTES = 1_000_000;

export class TypstCompilerError extends Error {
  payload: TypstCompileErrorPayload;

  constructor(payload: TypstCompileErrorPayload) {
    super(payload.message);
    this.name = "TypstCompilerError";
    this.payload = payload;
  }
}

async function fileIsExecutable(path: string) {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveTypstBinary() {
  const configured = process.env.TYPST_BIN?.trim();
  if (configured) {
    if (!isAbsolute(configured)) {
      throw new TypstCompilerError({
        stage: "compiler",
        code: "TYPST_BINARY_INVALID",
        message: "TYPST_BINには絶対パスを指定してください。",
      });
    }
    if (!await fileIsExecutable(configured)) {
      throw new TypstCompilerError({
        stage: "compiler",
        code: "TYPST_BINARY_NOT_FOUND",
        message: `Typst実行ファイルを利用できません: ${configured}`,
      });
    }
    return configured;
  }

  try {
    await execFileAsync("typst", ["--version"], {
      timeout: 5_000,
      maxBuffer: 100_000,
      encoding: "utf8",
      windowsHide: true,
    });
    return "typst";
  } catch (error) {
    const value = error as NodeJS.ErrnoException;
    if (value.code !== "ENOENT") {
      throw new TypstCompilerError({
        stage: "compiler",
        code: "TYPST_BINARY_UNUSABLE",
        message: `PATH上のTypst CLIを起動できません: ${value.message}`,
      });
    }
  }

  const localBinary = resolve(process.cwd(), "node_modules", ".bin", process.platform === "win32" ? "typst.cmd" : "typst");
  if (await fileIsExecutable(localBinary)) return localBinary;
  return "typst";
}

async function run(command: string, args: string[], timeout = COMPILE_TIMEOUT_MS) {
  try {
    const environment: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: "1" };
    if (!environment.TYPST_PACKAGE_CACHE_PATH) delete environment.TYPST_PACKAGE_CACHE_PATH;
    return await execFileAsync(command, args, {
      timeout,
      maxBuffer: MAX_DIAGNOSTIC_BYTES,
      encoding: "utf8",
      windowsHide: true,
      env: environment,
    });
  } catch (error) {
    const value = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; killed?: boolean };
    if (value.code === "ENOENT") {
      throw new TypstCompilerError({
        stage: "compiler",
        code: "TYPST_BINARY_NOT_FOUND",
        message: "公式Typst CLIが見つかりません。TypstをインストールするかTYPST_BINを設定してください。",
      });
    }
    throw error;
  }
}

export async function getTypstCompilerStatus() {
  const binary = await resolveTypstBinary();
  try {
    const result = await run(binary, ["--version"], 8_000);
    return { available: true, binary, version: result.stdout.trim() || result.stderr.trim() };
  } catch (error) {
    if (error instanceof TypstCompilerError) throw error;
    throw new TypstCompilerError({
      stage: "compiler",
      code: "TYPST_BINARY_UNUSABLE",
      message: `Typst CLIを起動できません: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

function safeAssetTarget(root: string, assetPath: string) {
  if (!/^assets\/[a-z0-9][a-z0-9-]*\.svg$/u.test(assetPath)) {
    throw new TypstCompilerError({
      stage: "validation",
      code: "UNSAFE_ASSET_PATH",
      message: `安全でないSVG資産パスを拒否しました: ${assetPath}`,
    });
  }
  const target = resolve(root, assetPath);
  if (!target.startsWith(`${resolve(root)}${sep}`)) {
    throw new TypstCompilerError({ stage: "validation", code: "UNSAFE_ASSET_PATH", message: "SVG資産が作業領域外を参照しています。" });
  }
  return target;
}

function sourceMapEntry(project: GeneratedTypstProject, generatedLine?: number): TypstSourceMapEntry | undefined {
  if (!generatedLine) return undefined;
  return project.sourceMap.find((entry) => generatedLine >= entry.generatedStartLine && generatedLine <= entry.generatedEndLine);
}

function compilerError(stderr: string, project: GeneratedTypstProject) {
  const compact = stderr.trim().slice(0, 12_000);
  const location = compact.match(/(?:^|\n)(?:error:.*\n\s*)?[^\n]*main\.typ:(\d+):(\d+)/u)
    ?? compact.match(/main\.typ:(\d+):(\d+)/u);
  const generatedLine = location ? Number(location[1]) : undefined;
  const mapped = sourceMapEntry(project, generatedLine);
  const reason = compact.match(/error:\s*([^\n]+)/u)?.[1] ?? "Typstの組版処理に失敗しました。";
  return new TypstCompilerError({
    stage: "compiler",
    code: "TYPST_COMPILE_FAILED",
    message: mapped
      ? `Markdown ${mapped.sourceLine}行目の${mapped.nodeType}を組版できません: ${reason}`
      : `Typst PDFの組版に失敗しました: ${reason}`,
    sourceLine: mapped?.sourceLine,
    nodeType: mapped?.nodeType,
    details: compact ? compact.split("\n").slice(0, 24) : undefined,
  });
}

function assertNoGlyphWarnings(diagnostic: string, project: GeneratedTypstProject) {
  const dangerous = diagnostic.split("\n").filter((line) => /missing glyph|does not contain the glyph|failed to load font/iu.test(line));
  if (!dangerous.length) return;
  throw new TypstCompilerError({
    stage: "validation",
    code: "PDF_GLYPH_VALIDATION_FAILED",
    message: "PDFで文字が欠落する可能性があるため生成を中止しました。日本語対応フォントをTYPST_FONT_PATHSへ設定してください。",
    details: dangerous.slice(0, 12),
    sourceLine: project.ast.children[0]?.sourceLine,
  });
}

function approximatePageCount(pdf: Buffer) {
  const matches = pdf.toString("latin1").match(/\/Type\s*\/Page\b/gu);
  return Math.max(1, matches?.length ?? 1);
}

async function optionalTextValidation(pdfPath: string, project: GeneratedTypstProject) {
  try {
    const result = await run("pdftotext", ["-enc", "UTF-8", pdfPath, "-"], 12_000);
    const extracted = result.stdout.replace(/\s+/gu, "");
    if (!extracted) {
      throw new TypstCompilerError({ stage: "validation", code: "PDF_TEXT_MISSING", message: "生成PDFから文字を抽出できませんでした。" });
    }
    const expected = project.expectedText
      .map((value) => value.replace(/\s+/gu, ""))
      .filter((value) => value.length >= 4)
      .slice(0, 8);
    const missing = expected.filter((value) => !extracted.includes(value));
    if (expected.length && missing.length === expected.length) {
      throw new TypstCompilerError({
        stage: "validation",
        code: "PDF_TEXT_VALIDATION_FAILED",
        message: "生成PDFの本文検証に失敗しました。PDF内で教材本文を確認できません。",
        details: missing.slice(0, 4),
      });
    }
    return { performed: true, checkedSamples: expected.length, matchedSamples: expected.length - missing.length };
  } catch (error) {
    if (error instanceof TypstCompilerError) throw error;
    const value = error as NodeJS.ErrnoException;
    if (value.code === "ENOENT") return { performed: false, checkedSamples: 0, matchedSamples: 0 };
    throw error;
  }
}

export async function compileWithTypstCli(input: unknown) {
  let request: TypstCompileRequest;
  let project: GeneratedTypstProject;
  try {
    request = validateTypstCompileRequest(input);
    project = generateTypstProject(request);
  } catch (error) {
    throw new TypstCompilerError(typstErrorPayload(error));
  }

  const status = await getTypstCompilerStatus();
  const root = await mkdtemp(join(tmpdir(), "markdown-studio-typst-"));
  const sourcePath = join(root, "main.typ");
  const pdfPath = join(root, "output.pdf");
  try {
    await writeFile(sourcePath, project.source, "utf8");
    for (const asset of project.assets) {
      const target = safeAssetTarget(root, asset.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, asset.contents, "utf8");
    }

    const args = ["compile", "--root", root, "--diagnostic-format", "short"];
    for (const fontPath of (process.env.TYPST_FONT_PATHS ?? "").split(delimiter).filter(Boolean)) {
      args.push("--font-path", fontPath);
    }
    args.push(sourcePath, pdfPath);

    let diagnostics = "";
    try {
      const result = await run(status.binary, args);
      diagnostics = `${result.stdout}\n${result.stderr}`.trim();
    } catch (error) {
      if (error instanceof TypstCompilerError) throw error;
      const value = error as { stderr?: string; stdout?: string };
      throw compilerError(`${value.stderr ?? ""}\n${value.stdout ?? ""}`, project);
    }
    assertNoGlyphWarnings(diagnostics, project);

    const pdf = await readFile(pdfPath);
    if (pdf.length < 1000 || pdf.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new TypstCompilerError({ stage: "validation", code: "INVALID_PDF", message: "Typstの出力が有効なPDFではありません。" });
    }
    const textValidation = await optionalTextValidation(pdfPath, project);
    return {
      pdf,
      pageCount: approximatePageCount(pdf),
      typstVersion: status.version,
      textValidation,
      source: project.source,
    };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
