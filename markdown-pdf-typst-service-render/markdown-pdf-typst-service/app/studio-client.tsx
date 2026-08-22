"use client";

import {
  AlertCircle,
  Archive,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Code2,
  Download,
  FileDown,
  Files,
  FilePlus2,
  FileText,
  FolderOpen,
  ImagePlus,
  Info,
  Lightbulb,
  ListChecks,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Square,
  Trash2,
  TriangleAlert,
  UploadCloud,
  X,
} from "lucide-react";
import React, {
  CSSProperties,
  ChangeEvent,
  Component,
  ErrorInfo,
  ReactNode,
  useEffect,
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BlockMeasurement,
  Issue,
  Metadata,
  OutputMode,
  PageModel,
  PaginationPageGeometry,
  QuickFix,
  SAMPLES,
  StudioBlock,
  applyQuickFix,
  collectQuickFixes,
  createRenderDocument,
  paginateMeasuredDocument,
  paginateDocument,
  evaluatePolynomialFormula,
  flattenStudioBlocks,
  hasPreferredBreakPoints,
  parseDocument,
  parseFunctionGraphConfig,
  prepareBlocksForPagination,
  paginationConstraintFor,
  parseNumberLineConfig,
  parseSignChartConfig,
  parseTriangleConfig,
  parseCircleConfig,
  parseVennDiagramConfig,
  parseTreeDiagramConfig,
  parseHistogramConfig,
  parseBoxPlotConfig,
  parseScatterPlotConfig,
  parseProbabilityDistributionConfig,
  listExerciseIds,
  nextExerciseId,
  sanitizeFilename,
  suggestKnownBlockNames,
} from "./studio-core";
import {
  ACADEMIC_COLOR_HEX,
  ACADEMIC_COLOR_LABELS,
  AcademicColorVariant,
  DEFAULT_SETTINGS,
  DESIGN_THEME_LABELS,
  DesignTheme,
  StudioSettings,
  THEME_PRESET_LABELS,
  ThemePreset,
  applyDesignTheme,
  applyThemePreset,
  designThemeSupportsColor,
  normalizeThemeSettings,
  serializeThemeSettings,
} from "./theme-settings";
import {
  BatchJob,
  BatchJobStatus,
  BatchMessage,
  BatchOptions,
  batchZipFilename,
  createBatchJobs,
  createBatchResultReport,
  editionModesForOutput,
  formatBatchResultText,
  runBatchSequentially,
  uniqueOutputFilename,
} from "./batch-core";
import {
  GeneratedPdfFile,
  createBatchZip,
  downloadGeneratedBlob,
  generateMaterialPdf,
} from "./pdf-generation";
import {
  collectBlockMeasurements,
  measurePageGeometry,
  waitForStableLayout,
} from "./pagination/measure";
import {
  inspectPageOverflow,
  inspectPaginationAnomalies,
  paginationAnomalyTitle,
} from "./pagination/overflow";
import { PAGINATION_CONFIG } from "./pagination/config";
import { InlineMarkdownContent, MarkdownContent } from "./inline-markdown";
import {
  compileTypstPdf,
  getTypstStatus,
  TypstClientError,
  type TypstGenerationPhase,
} from "./pdf-engine/typst/client";
import { TYPST_THEME_LABELS } from "./pdf-engine/typst/theme";
import type { TypstCompileErrorPayload, TypstThemeId } from "./pdf-engine/typst/types";

type MobileTab = "editor" | "preview" | "qa" | "settings";
type RightTab = "issues" | "qa" | "settings";
type StudioMode = "single" | "batch";
type PdfEngine = "legacy" | "typst";
type ProcessingState =
  | "idle"
  | "parsing"
  | "rendering"
  | "paginating"
  | "measuring"
  | "pdf"
  | "typst"
  | "complete";

type InsertTemplateKey = "learning-goals" | "explanation" | "definition" | "key-point" | "caution" | "example" | "exercise" | "solution" | "summary" | "page-break" | "display-math" | "aligned-math" | "table" | "mermaid" | "function-graph" | "data-chart" | "image";

type BatchEditionMode = Exclude<OutputMode, "split">;

type BatchRenderRequest = {
  token: string;
  jobId: string;
  fileName: string;
  sourceMarkdown: string;
  outputMode: BatchEditionMode;
  includeQuestionInAnswer: boolean;
  settings: StudioSettings;
};

type BatchRenderResult = {
  generatedFile: GeneratedPdfFile;
  warnings: BatchMessage[];
  errors: BatchMessage[];
  qaReport: Record<string, unknown>;
};

type TypstPdfPreview = {
  blob: Blob;
  fileName: string;
  key: string;
  outputMode: BatchEditionMode;
  pageCount: number;
  textValidation: string;
  typstVersion: string;
  url: string;
};

type TypstCompilerStatus = {
  checked: boolean;
  available: boolean;
  version: string;
  message: string;
};

const CSS_PIXELS_PER_MM = 96 / 25.4;
const A4_WIDTH_PX = 210 * CSS_PIXELS_PER_MM;
const A4_HEIGHT_PX = 297 * CSS_PIXELS_PER_MM;
const EMPTY_ID_SET = new Set<string>();
const CURSOR_TOKEN = "__STUDIO_CURSOR__";

const INSERT_TEMPLATE_LABELS: Array<[InsertTemplateKey, string]> = [
  ["learning-goals", "学習目標"], ["explanation", "解説"], ["definition", "定義"], ["key-point", "要点"], ["caution", "注意"], ["example", "例題"], ["exercise", "演習"], ["solution", "解答解説"], ["summary", "まとめ"], ["page-break", "改ページ"], ["display-math", "別行立て数式"], ["aligned-math", "aligned途中式"], ["table", "Markdown表"], ["mermaid", "Mermaid"], ["function-graph", "関数グラフ"], ["data-chart", "データグラフ"], ["image", "画像"],
];

function insertTemplate(key: InsertTemplateKey, source: string, selected: string, solutionId: string) {
  const body = selected || CURSOR_TOKEN;
  const simpleCallout = (name: string, title: string) => `:::${name} title="${title}"\n${body}\n:::`;
  switch (key) {
    case "learning-goals": return simpleCallout("learning-goals", "学習目標");
    case "explanation": return simpleCallout("explanation", "解説");
    case "definition": return simpleCallout("definition", "定義");
    case "key-point": return simpleCallout("key-point", "要点");
    case "caution": return simpleCallout("caution", "注意");
    case "example": return simpleCallout("example", "例題");
    case "exercise": return `:::exercise id="${nextExerciseId(source)}" title="演習"\n${body}\n:::`;
    case "solution": return `:::solution for="${solutionId || "q001"}" title="解答・解説"\n${body}\n:::`;
    case "summary": return simpleCallout("summary", "まとめ");
    case "page-break": return ":::page-break\n:::";
    case "display-math": return `$$\n${body}\n$$`;
    case "aligned-math": return `$$\n\\begin{aligned}\n${selected || `式1 &= ${CURSOR_TOKEN} \\\\\n式2 &=`}\n\\end{aligned}\n$$`;
    case "table": return selected || `| 項目 | 内容 |\n|---|---|\n| 1 | ${CURSOR_TOKEN} |`;
    case "mermaid": return `\`\`\`mermaid\n${selected || `flowchart TD\n  A[開始] --> B[${CURSOR_TOKEN}]`}\n\`\`\``;
    case "function-graph": return `\`\`\`figure function-graph\nformula: ${selected || `x^2${CURSOR_TOKEN}`}\nx-range: -5, 5\ny-range: -2, 10\nx-tick: 1\ny-tick: 2\nshow-grid: true\n\`\`\``;
    case "data-chart": return `\`\`\`figure data-chart\ntype: bar\nlabels: A, B, C\nseries: データ | 10, 20, ${selected || `30${CURSOR_TOKEN}`}\nx-label: 項目\ny-label: 値\n\`\`\``;
    case "image": return `![${selected || `画像の説明${CURSOR_TOKEN}`}](https://example.com/image.png)`;
  }
}

const BLOCK_LABELS: Record<string, string> = {
  "learning-goals": "学習目標",
  explanation: "解説",
  definition: "定義",
  "key-point": "ポイント",
  caution: "注意",
  example: "例題",
  exercise: "演習",
  solution: "解答・解説",
  "answer-question": "問題再掲",
  summary: "まとめ",
};

const OUTPUT_MODE_LABELS: Record<OutputMode, string> = {
  complete: "完全版",
  questions: "問題編",
  answers: "解答解説編",
  split: "問題編・解答解説編を別々に出力",
};

const BATCH_STATUS_LABELS: Record<BatchJobStatus, string> = {
  waiting: "待機中",
  processing: "処理中",
  success: "成功",
  warning: "警告付き成功",
  failed: "失敗",
  cancelled: "停止",
};

const BATCH_STATUS_ICONS: Record<BatchJobStatus, string> = {
  waiting: "○",
  processing: "▶",
  success: "✓",
  warning: "⚠",
  failed: "×",
  cancelled: "■",
};

function editionForMode(mode: OutputMode): "完全版" | "問題" | "解答" {
  if (mode === "answers") return "解答";
  if (mode === "questions" || mode === "split") return "問題";
  return "完全版";
}

function downloadBlob(contents: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function typstPreviewKey(
  markdown: string,
  mode: BatchEditionMode,
  includeQuestionInAnswer: boolean,
  settings: StudioSettings,
  theme: TypstThemeId,
) {
  return JSON.stringify({ markdown, mode, includeQuestionInAnswer, settings, theme });
}

function metadataStyle(settings: StudioSettings) {
  return {
    "--page-margin-top": `${settings.marginTop}mm`,
    "--page-margin-right": `${settings.marginRight}mm`,
    "--page-margin-bottom": `${settings.marginBottom}mm`,
    "--page-margin-left": `${settings.marginLeft}mm`,
    "--lesson-font-size": `${settings.fontSize}pt`,
    "--lesson-line-height": String(settings.lineHeight),
    "--paragraph-spacing": `${settings.paragraphSpacing}px`,
    "--heading-size": `${settings.headingSize}pt`,
    "--table-font-size": `${settings.tableFontSize}pt`,
    "--code-font-size": `${settings.codeFontSize}pt`,
    "--math-min-scale": "0.8",
    "--figure-min-scale": "0.7",
  } as CSSProperties;
}

function lessonThemeClass(settings: StudioSettings) {
  return [
    `theme-${settings.themePreset}`,
    `design-${settings.designTheme}`,
    designThemeSupportsColor(settings.designTheme) ? `academic-color-${settings.academicColor}` : "",
    settings.showExampleBox ? "" : "box-example-off",
    settings.showExerciseBox ? "" : "box-exercise-off",
    settings.showSolutionBox ? "" : "box-solution-off",
    settings.showNoticeBox ? "" : "box-notice-off",
  ].filter(Boolean).join(" ");
}

class RenderBoundary extends Component<
  { block: StudioBlock; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    void _error;
    void _info;
  }

  componentDidUpdate(previous: { block: StudioBlock }) {
    if (previous.block.id !== this.props.block.id && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="render-fallback">
          <AlertCircle size={17} />
          <div>
            <strong>この要素を表示できません</strong>
            <span>入力 {this.props.block.startLine}行目</span>
            <code>{this.props.block.raw ?? this.props.block.markdown}</code>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function MermaidFigure({ source }: { source: string }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const render = async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: {
            primaryColor: "#e7f4f2",
            primaryTextColor: "#173b39",
            primaryBorderColor: "#2d8a84",
            lineColor: "#317a76",
            secondaryColor: "#fff8e7",
            fontFamily: '"Yu Gothic UI", sans-serif',
          },
        });
        const result = await mermaid.render(
          `mermaid-${Math.random().toString(36).slice(2)}`,
          source,
        );
        if (active) setSvg(result.svg);
      } catch (renderError) {
        if (active) {
          setError(
            renderError instanceof Error ? renderError.message : "Mermaidの描画に失敗しました。",
          );
        }
      }
    };
    render();
    return () => {
      active = false;
    };
  }, [source]);

  if (error) {
    return (
      <div className="render-fallback">
        <AlertCircle size={17} />
        <div>
          <strong>Mermaid図を表示できません</strong>
          <span>{error.slice(0, 160)}</span>
          <code>{source}</code>
        </div>
      </div>
    );
  }
  return svg ? (
    <div className="mermaid-output" dangerouslySetInnerHTML={{ __html: svg }} />
  ) : (
    <div className="figure-loading">Mermaid図を描画中…</div>
  );
}

type SvgInlineLabelProps = {
  source: string;
  x: number;
  y: number;
  className?: string;
  textAnchor?: "start" | "middle" | "end";
  width?: number;
  height?: number;
  rotate?: number;
};

/**
 * SVG <text> treats `$...$` as ordinary characters. Figure labels therefore
 * use a small HTML surface inside the SVG so they can share the exact same
 * Markdown/KaTeX pipeline as headings, BOX titles, captions, and prose.
 */
function SvgInlineLabel({
  source,
  x,
  y,
  className = "",
  textAnchor = "start",
  width = 140,
  height = 30,
  rotate,
}: SvgInlineLabelProps) {
  if (!source) return null;
  const left = textAnchor === "middle" ? x - width / 2 : textAnchor === "end" ? x - width : x;
  const top = y - height * 0.67;
  return (
    <foreignObject
      className="svg-inline-label-object"
      height={height}
      transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
      width={width}
      x={left}
      y={top}
    >
      <div className={`svg-inline-label svg-inline-label--${textAnchor} ${className}`.trim()}>
        <InlineMarkdownContent kind="label" source={source} />
      </div>
    </foreignObject>
  );
}

function FunctionGraph({ block }: { block: StudioBlock }) {
  const result = parseFunctionGraphConfig(block.params);
  const clipId = `graph-clip-${useId().replace(/:/gu, "")}`;
  if (!result.ok) {
    return (
      <FigureFallback
        details={result.errors.join(" ")}
        raw={block.raw}
        title="関数グラフを表示できません"
      />
    );
  }

  const { xRange, yRange, series, points, guides, showGrid, showLegend } = result.config;
  const plotLeft = 58;
  const plotRight = 612;
  const plotTop = 60;
  const plotBottom = 316;
  const scaleX = (value: number) =>
    plotLeft + ((value - xRange[0]) / (xRange[1] - xRange[0])) * (plotRight - plotLeft);
  const scaleY = (value: number) =>
    plotBottom - ((value - yRange[0]) / (yRange[1] - yRange[0])) * (plotBottom - plotTop);
  const ticksFor = (range: [number, number], requested?: number) => {
    const step = requested ?? niceTickStep(range[1] - range[0]);
    const first = Math.ceil((range[0] - step * 1e-8) / step) * step;
    const values: number[] = [];
    for (let value = first; value <= range[1] + step * 1e-8 && values.length < 31; value += step) {
      values.push(Math.abs(value) < step * 1e-8 ? 0 : value);
    }
    return values;
  };
  const xTicks = ticksFor(xRange, result.config.xTick);
  const yTicks = ticksFor(yRange, result.config.yTick);
  const lineSegments = series.map((item) => {
    const segments: string[] = [];
    let segment = "";
    for (let index = 0; index <= 240; index += 1) {
      const x = xRange[0] + ((xRange[1] - xRange[0]) * index) / 240;
      const y = evaluatePolynomialFormula(item.formula, x);
      const sx = scaleX(x);
      const sy = scaleY(y);
      const valid = Number.isFinite(y) && Math.abs(sy) < 10000;
      if (!valid) {
        if (segment) segments.push(segment);
        segment = "";
      } else {
        segment += `${segment ? " " : ""}${sx.toFixed(1)},${sy.toFixed(1)}`;
      }
    }
    if (segment) segments.push(segment);
    return segments;
  });
  const xAxis = yRange[0] <= 0 && yRange[1] >= 0 ? scaleY(0) : null;
  const yAxis = xRange[0] <= 0 && xRange[1] >= 0 ? scaleX(0) : null;
  const ariaLabel = [
    ...series.map((item) => item.label),
    ...points.map((point) => point.label),
  ].join("、");

  return (
    <svg className="function-graph" viewBox="0 0 640 350" role="img" aria-label={`${ariaLabel || "座標平面"}の関数グラフ`}>
      <defs>
        <clipPath id={clipId}>
          <rect height={plotBottom - plotTop} width={plotRight - plotLeft} x={plotLeft} y={plotTop} />
        </clipPath>
      </defs>
      {showLegend && (
        <g className="graph-legend" aria-label="凡例">
          {series.map((item, index) => {
            const column = index % 3;
            const row = Math.floor(index / 3);
            const x = 62 + column * 188;
            const y = 18 + row * 20;
            return (
              <g key={`legend-${item.formula}-${index}`}>
                <line className={`graph-line graph-style-${item.style} graph-series-${index % 5}`} x1={x} x2={x + 28} y1={y} y2={y} />
                <SvgInlineLabel
                  className="graph-label graph-legend-label"
                  source={item.label}
                  width={145}
                  x={x + 35}
                  y={y + 4}
                />
              </g>
            );
          })}
        </g>
      )}
      <rect className="graph-frame" height={plotBottom - plotTop} width={plotRight - plotLeft} x={plotLeft} y={plotTop} />
      {showGrid && (
        <g className="grid-lines">
          {xTicks.map((value) => <line key={`grid-x-${value}`} x1={scaleX(value)} x2={scaleX(value)} y1={plotTop} y2={plotBottom} />)}
          {yTicks.map((value) => <line key={`grid-y-${value}`} x1={plotLeft} x2={plotRight} y1={scaleY(value)} y2={scaleY(value)} />)}
        </g>
      )}
      <g className="graph-ticks">
        {xTicks.map((value) => (
          <g key={`tick-x-${value}`}>
            <line x1={scaleX(value)} x2={scaleX(value)} y1={plotBottom} y2={plotBottom + 5} />
            <text textAnchor="middle" x={scaleX(value)} y={plotBottom + 17}>{formatFigureNumber(value)}</text>
          </g>
        ))}
        {yTicks.map((value) => (
          <g key={`tick-y-${value}`}>
            <line x1={plotLeft - 5} x2={plotLeft} y1={scaleY(value)} y2={scaleY(value)} />
            <text textAnchor="end" x={plotLeft - 9} y={scaleY(value) + 4}>{formatFigureNumber(value)}</text>
          </g>
        ))}
      </g>
      <g className="axis-lines">
        {xAxis !== null && <line x1={plotLeft} x2={plotRight} y1={xAxis} y2={xAxis} />}
        {yAxis !== null && <line x1={yAxis} x2={yAxis} y1={plotTop} y2={plotBottom} />}
      </g>
      <g clipPath={`url(#${clipId})`}>
        {guides.map((guide, index) => (
          <line
            className={`graph-guide graph-style-${guide.style}`}
            key={`guide-${guide.axis}-${guide.value}-${index}`}
            x1={guide.axis === "x" ? scaleX(guide.value) : plotLeft}
            x2={guide.axis === "x" ? scaleX(guide.value) : plotRight}
            y1={guide.axis === "y" ? scaleY(guide.value) : plotTop}
            y2={guide.axis === "y" ? scaleY(guide.value) : plotBottom}
          />
        ))}
        {lineSegments.flatMap((segments, seriesIndex) =>
          segments.map((segment, segmentIndex) => (
            <polyline
              className={`graph-line graph-style-${series[seriesIndex].style} graph-series-${seriesIndex % 5}`}
              key={`series-${seriesIndex}-${segmentIndex}`}
              points={segment}
            />
          )),
        )}
      </g>
      <g className="graph-guide-labels">
        {guides.map((guide, index) => (
          <SvgInlineLabel
            className="graph-label graph-guide-label"
            key={`guide-label-${guide.axis}-${guide.value}-${index}`}
            source={guide.label}
            textAnchor={guide.axis === "x" ? "middle" : "end"}
            width={150}
            x={guide.axis === "x" ? scaleX(guide.value) : plotRight - 5}
            y={guide.axis === "x" ? plotTop + 14 + (index % 2) * 13 : scaleY(guide.value) - 5}
          />
        ))}
      </g>
      <g className="graph-points">
        {points.map((point, index) => (
          <g key={`point-${point.x}-${point.y}-${index}`}>
            <circle className={`graph-point endpoint-${point.marker}`} cx={scaleX(point.x)} cy={scaleY(point.y)} r="5" />
            <SvgInlineLabel
              className="graph-label graph-point-label"
              source={point.label}
              width={100}
              x={scaleX(point.x) + 8}
              y={scaleY(point.y) - 8}
            />
          </g>
        ))}
      </g>
      <text className="graph-axis-label" x={plotRight + 8} y={(xAxis ?? plotBottom) + 4}>x</text>
      <text className="graph-axis-label" x={(yAxis ?? plotLeft) + 7} y={plotTop - 8}>y</text>
    </svg>
  );
}

function DataChart({ block }: { block: StudioBlock }) {
  const labels = (block.params?.labels ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const values = (block.params?.values ?? "").split(",").map(Number);
  if (!labels.length || labels.length !== values.length || values.some((value) => !Number.isFinite(value))) {
    return (
      <div className="render-fallback">
        <AlertCircle size={17} />
        <div>
          <strong>データグラフを表示できません</strong>
          <span>labelsとvaluesを同じ個数で指定してください。</span>
          <code>{block.raw}</code>
        </div>
      </div>
    );
  }
  const max = Math.max(...values, 1);
  const isLine = block.params?.type === "line";
  const points = values
    .map((value, index) => `${55 + index * (290 / Math.max(1, values.length - 1))},${175 - (value / max) * 130}`)
    .join(" ");
  return (
    <svg className="data-chart" viewBox="0 0 400 215" role="img" aria-label={block.params?.caption ?? "データグラフ"}>
      <line x1="42" y1="180" x2="365" y2="180" className="chart-axis" />
      <line x1="42" y1="28" x2="42" y2="180" className="chart-axis" />
      {isLine ? (
        <>
          <polyline points={points} className="chart-line" />
          {values.map((value, index) => (
            <circle key={index} cx={55 + index * (290 / Math.max(1, values.length - 1))} cy={175 - (value / max) * 130} r="4" />
          ))}
        </>
      ) : (
        values.map((value, index) => {
          const width = Math.min(52, 250 / values.length);
          const x = 58 + index * (290 / values.length);
          const height = (value / max) * 130;
          return <rect key={index} x={x} y={175 - height} width={width} height={height} rx="3" />;
        })
      )}
      {labels.map((label, index) => (
        <SvgInlineLabel
          className="data-chart-label"
          key={label}
          source={label}
          textAnchor="middle"
          width={90}
          x={isLine ? 55 + index * (290 / Math.max(1, labels.length - 1)) : 58 + index * (290 / labels.length) + 14}
          y={200}
        />
      ))}
    </svg>
  );
}

function FigureFallback({ title, details, raw }: { title: string; details: string; raw?: string }) {
  return (
    <div className="render-fallback">
      <AlertCircle size={17} />
      <div>
        <strong>{title}</strong>
        <span>{details}</span>
        {raw && <code>{raw}</code>}
      </div>
    </div>
  );
}

function niceTickStep(span: number) {
  const rough = span / 10;
  const power = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / power;
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return factor * power;
}

function formatFigureNumber(value: number) {
  if (Math.abs(value) < 1e-10) return "0";
  return Number(value.toPrecision(8)).toString();
}

function NumberLine({ block }: { block: StudioBlock }) {
  const result = parseNumberLineConfig(block.params);
  if (!result.ok) {
    return (
      <FigureFallback
        details={result.errors.join(" ")}
        raw={block.raw}
        title="数直線を表示できません"
      />
    );
  }

  const { min, max, interval, endpoints, points } = result.config;
  const left = 54;
  const right = 586;
  const axisY = 76;
  const scale = (value: number) => left + ((value - min) / (max - min)) * (right - left);
  const tickStep = result.config.tickStep ?? niceTickStep(max - min);
  const firstTick = Math.ceil(min / tickStep) * tickStep;
  const ticks: number[] = [];
  for (let value = firstTick; value <= max + tickStep * 1e-8 && ticks.length < 31; value += tickStep) {
    ticks.push(value);
  }

  return (
    <svg className="number-line" viewBox="0 0 640 150" role="img" aria-label={block.params?.caption ?? "数直線"}>
      <line className="number-line-axis" x1={left - 10} x2={right + 10} y1={axisY} y2={axisY} />
      <polygon className="number-line-arrow" points={`${left - 12},${axisY} ${left - 2},${axisY - 5} ${left - 2},${axisY + 5}`} />
      <polygon className="number-line-arrow" points={`${right + 12},${axisY} ${right + 2},${axisY - 5} ${right + 2},${axisY + 5}`} />
      {ticks.map((value) => {
        const x = scale(value);
        return (
          <g key={`tick-${value}`}>
            <line className="number-line-tick" x1={x} x2={x} y1={axisY - 6} y2={axisY + 6} />
            <text className="number-line-tick-label" textAnchor="middle" x={x} y={axisY + 23}>{formatFigureNumber(value)}</text>
          </g>
        );
      })}
      {interval && (
        <g>
          <line className="number-line-interval" x1={scale(interval[0])} x2={scale(interval[1])} y1={axisY} y2={axisY} />
          {[interval[0], interval[1]].map((value, index) => (
            <circle
              className={`number-line-endpoint endpoint-${endpoints[index]}`}
              cx={scale(value)}
              cy={axisY}
              key={`endpoint-${index}`}
              r="6"
            />
          ))}
        </g>
      )}
      {points.map((point, index) => {
        const x = scale(point.value);
        const labelY = index % 2 === 0 ? axisY - 19 : axisY + 43;
        return (
          <g key={`point-${point.value}-${index}`}>
            <circle className={`number-line-point endpoint-${point.marker}`} cx={x} cy={axisY} r="5" />
            <line className="number-line-guide" x1={x} x2={x} y1={axisY + (index % 2 === 0 ? -7 : 7)} y2={labelY + (index % 2 === 0 ? 5 : -12)} />
            <SvgInlineLabel
              className="number-line-point-label"
              source={point.label}
              textAnchor="middle"
              width={100}
              x={x}
              y={labelY}
            />
          </g>
        );
      })}
    </svg>
  );
}

function SignChart({ block }: { block: StudioBlock }) {
  const result = parseSignChartConfig(block.params);
  if (!result.ok) {
    return (
      <FigureFallback
        details={result.errors.join(" ")}
        raw={block.raw}
        title="符号表を表示できません"
      />
    );
  }

  const { variable, criticalPoints, rows } = result.config;
  const headers: string[] = [];
  criticalPoints.forEach((point, index) => {
    const previous = criticalPoints[index - 1];
    headers.push(index === 0 ? `−∞ < ${variable} < ${formatFigureNumber(point)}` : `${formatFigureNumber(previous)} < ${variable} < ${formatFigureNumber(point)}`);
    headers.push(`${variable} = ${formatFigureNumber(point)}`);
  });
  headers.push(`${variable} > ${formatFigureNumber(criticalPoints.at(-1) ?? 0)}`);

  return (
    <div className="sign-chart-wrap" role="img" aria-label={block.params?.caption ?? "符号表"}>
      <table className="sign-chart">
        <thead>
          <tr>
            <th scope="col"><InlineMarkdownContent kind="label" source={variable} /></th>
            {headers.map((header, index) => (
              <th className={index % 2 ? "critical-cell" : "interval-cell"} key={`${header}-${index}`} scope="col">
                <InlineMarkdownContent kind="label" source={header} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row"><InlineMarkdownContent kind="label" source={row.label} /></th>
              {row.cells.map((cell, index) => (
                <td className={`${index % 2 ? "critical-cell" : "interval-cell"} sign-${cell === "+" ? "positive" : cell === "-" || cell === "−" ? "negative" : cell === "0" ? "zero" : "other"}`} key={`${row.label}-${index}`}>
                  <InlineMarkdownContent kind="label" source={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TriangleFigure({ block }: { block: StudioBlock }) {
  const result = parseTriangleConfig(block.params);
  if (!result.ok) {
    return <FigureFallback details={result.errors.join(" ")} raw={block.raw} title="三角形を表示できません" />;
  }

  const { vertices, sides, angles, rightAngles } = result.config;
  const pointMap = new Map(vertices.map((point) => [point.label, point]));
  const centroid = {
    x: vertices.reduce((sum, point) => sum + point.x, 0) / 3,
    y: vertices.reduce((sum, point) => sum + point.y, 0) / 3,
  };
  const normalize = (x: number, y: number) => {
    const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  };
  const sideLabelPosition = (from: string, to: string) => {
    const a = pointMap.get(from)!;
    const b = pointMap.get(to)!;
    const midpoint = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    let normal = normalize(-(b.y - a.y), b.x - a.x);
    if ((midpoint.x - centroid.x) * normal.x + (midpoint.y - centroid.y) * normal.y < 0) {
      normal = { x: -normal.x, y: -normal.y };
    }
    return { x: midpoint.x + normal.x * 15, y: midpoint.y + normal.y * 15 };
  };

  return (
    <svg className="geometry-figure triangle-figure" viewBox="0 0 420 260" role="img" aria-label={block.params?.caption ?? "三角形"}>
      <polygon className="geometry-outline" points={vertices.map((point) => `${point.x},${point.y}`).join(" ")} />
      {sides.map((side, index) => {
        const position = sideLabelPosition(side.from, side.to);
        return side.label ? (
          <SvgInlineLabel
            className="geometry-side-label"
            key={`side-${index}`}
            source={side.label}
            textAnchor="middle"
            width={90}
            x={position.x}
            y={position.y}
          />
        ) : null;
      })}
      {angles.map((angle) => {
        const point = pointMap.get(angle.vertex)!;
        const direction = normalize(centroid.x - point.x, centroid.y - point.y);
        return (
          <SvgInlineLabel
            className="geometry-angle-label"
            key={`angle-${angle.vertex}`}
            source={angle.label}
            textAnchor="middle"
            width={90}
            x={point.x + direction.x * 30}
            y={point.y + direction.y * 30 + 4}
          />
        );
      })}
      {rightAngles.map((vertex) => {
        const point = pointMap.get(vertex)!;
        const others = vertices.filter((candidate) => candidate.label !== vertex);
        const first = normalize(others[0].x - point.x, others[0].y - point.y);
        const second = normalize(others[1].x - point.x, others[1].y - point.y);
        const size = 18;
        const p1 = { x: point.x + first.x * size, y: point.y + first.y * size };
        const p2 = { x: p1.x + second.x * size, y: p1.y + second.y * size };
        const p3 = { x: point.x + second.x * size, y: point.y + second.y * size };
        return <polyline className="geometry-right-angle" key={`right-${vertex}`} points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`} />;
      })}
      {vertices.map((point) => {
        const direction = normalize(point.x - centroid.x, point.y - centroid.y);
        return (
          <g key={point.label}>
            <circle className="geometry-point" cx={point.x} cy={point.y} r="3.6" />
            <SvgInlineLabel
              className="geometry-point-label"
              source={point.label}
              textAnchor="middle"
              width={90}
              x={point.x + direction.x * 17}
              y={point.y + direction.y * 17 + 4}
            />
          </g>
        );
      })}
    </svg>
  );
}

function CircleFigure({ block }: { block: StudioBlock }) {
  const result = parseCircleConfig(block.params);
  if (!result.ok) {
    return <FigureFallback details={result.errors.join(" ")} raw={block.raw} title="円を表示できません" />;
  }

  const { center, radius, points, segments, arcs, showCenter } = result.config;
  const centerPoint = { x: 210, y: 130 };
  const pointMap = new Map<string, { x: number; y: number; angle: number }>();
  pointMap.set(center, { ...centerPoint, angle: 0 });
  for (const point of points) {
    const radians = point.angle * Math.PI / 180;
    pointMap.set(point.label, {
      x: centerPoint.x + Math.cos(radians) * radius,
      y: centerPoint.y - Math.sin(radians) * radius,
      angle: point.angle,
    });
  }
  const arcGeometry = (from: string, to: string, kind: "minor" | "major") => {
    const start = pointMap.get(from)!;
    const end = pointMap.get(to)!;
    let delta = ((end.angle - start.angle) % 360 + 360) % 360;
    if (kind === "minor" && delta > 180) delta -= 360;
    if (kind === "major" && delta <= 180) delta -= 360;
    return {
      path: `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${kind === "major" ? 1 : 0} ${delta > 0 ? 0 : 1} ${end.x} ${end.y}`,
      middleAngle: start.angle + delta / 2,
    };
  };

  return (
    <svg className="geometry-figure circle-figure" viewBox="0 0 420 260" role="img" aria-label={block.params?.caption ?? "円"}>
      <circle className="geometry-outline" cx={centerPoint.x} cy={centerPoint.y} r={radius} />
      {arcs.map((arc, index) => {
        const geometry = arcGeometry(arc.from, arc.to, arc.kind);
        const radians = geometry.middleAngle * Math.PI / 180;
        const labelRadius = radius + 19;
        return (
          <g key={`arc-${index}`}>
            <path className="geometry-arc" d={geometry.path} />
            {arc.label && (
              <SvgInlineLabel
                className="geometry-arc-label"
                source={arc.label}
                textAnchor="middle"
                width={100}
                x={centerPoint.x + Math.cos(radians) * labelRadius}
                y={centerPoint.y - Math.sin(radians) * labelRadius + 4}
              />
            )}
          </g>
        );
      })}
      {segments.map((segment, index) => {
        const from = pointMap.get(segment.from)!;
        const to = pointMap.get(segment.to)!;
        const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
        const outwardX = midpoint.x - centerPoint.x;
        const outwardY = midpoint.y - centerPoint.y;
        const outwardLength = Math.hypot(outwardX, outwardY) || 1;
        return (
          <g key={`segment-${index}`}>
            <line className="geometry-segment" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
            {segment.label && (
              <SvgInlineLabel
                className="geometry-side-label"
                source={segment.label}
                textAnchor="middle"
                width={100}
                x={midpoint.x + outwardX / outwardLength * 12}
                y={midpoint.y + outwardY / outwardLength * 12 + 4}
              />
            )}
          </g>
        );
      })}
      {showCenter && (
        <g>
          <circle className="geometry-point" cx={centerPoint.x} cy={centerPoint.y} r="3.6" />
          <SvgInlineLabel className="geometry-point-label" source={center} width={90} x={centerPoint.x + 8} y={centerPoint.y - 7} />
        </g>
      )}
      {points.map((point) => {
        const position = pointMap.get(point.label)!;
        const radians = point.angle * Math.PI / 180;
        return (
          <g key={point.label}>
            <circle className="geometry-point" cx={position.x} cy={position.y} r="3.6" />
            <SvgInlineLabel
              className="geometry-point-label"
              source={point.label}
              textAnchor="middle"
              width={90}
              x={centerPoint.x + Math.cos(radians) * (radius + 16)}
              y={centerPoint.y - Math.sin(radians) * (radius + 16) + 4}
            />
          </g>
        );
      })}
    </svg>
  );
}

function VennDiagram({ block }: { block: StudioBlock }) {
  const result = parseVennDiagramConfig(block.params);
  const instanceId = useId().replace(/:/gu, "");
  if (!result.ok) {
    return <FigureFallback details={result.errors.join(" ")} raw={block.raw} title="ベン図を表示できません" />;
  }

  const { sets, universe, showUniverse, shaded, regions } = result.config;
  const isThree = sets.length === 3;
  const circles = isThree
    ? [
        { cx: 170, cy: 105, r: 76 },
        { cx: 250, cy: 105, r: 76 },
        { cx: 210, cy: 170, r: 76 },
      ]
    : [
        { cx: 165, cy: 130, r: 90 },
        { cx: 255, cy: 130, r: 90 },
      ];
  const circleById = new Map(sets.map((set, index) => [set.id, circles[index]]));
  const outsideMaskId = `venn-outside-${instanceId}`;

  const intersectionPoints = (ids: string[]) => {
    const selected = ids.map((id) => circleById.get(id)!).filter(Boolean);
    const candidates: Array<{ x: number; y: number }> = [];
    for (const circle of selected) {
      for (let step = 0; step < 240; step += 1) {
        const angle = step / 240 * Math.PI * 2;
        const point = { x: circle.cx + Math.cos(angle) * circle.r, y: circle.cy + Math.sin(angle) * circle.r };
        if (selected.every((other) => Math.hypot(point.x - other.cx, point.y - other.cy) <= other.r + 0.8)) candidates.push(point);
      }
    }
    if (candidates.length < 3) return "";
    const center = {
      x: candidates.reduce((sum, point) => sum + point.x, 0) / candidates.length,
      y: candidates.reduce((sum, point) => sum + point.y, 0) / candidates.length,
    };
    candidates.sort((a, b) => Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x));
    return candidates.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ") + " Z";
  };

  const regionPosition = (key: string) => {
    const [a, b, c] = sets.map((set) => set.id);
    const positions: Record<string, { x: number; y: number }> = isThree
      ? {
          [`${a}-only`]: { x: 137, y: 105 },
          [`${b}-only`]: { x: 283, y: 105 },
          [`${c}-only`]: { x: 210, y: 205 },
          [`${a}&${b}`]: { x: 210, y: 79 },
          [`${a}&${c}`]: { x: 177, y: 150 },
          [`${b}&${c}`]: { x: 243, y: 150 },
          [`${a}&${b}&${c}`]: { x: 210, y: 126 },
          outside: { x: 51, y: 224 },
        }
      : {
          [`${a}-only`]: { x: 122, y: 135 },
          [`${b}-only`]: { x: 298, y: 135 },
          [`${a}&${b}`]: { x: 210, y: 135 },
          outside: { x: 51, y: 224 },
        };
    return positions[key] ?? (circleById.has(key) ? { x: circleById.get(key)!.cx, y: circleById.get(key)!.cy } : null);
  };

  return (
    <svg className="venn-diagram" viewBox="0 0 420 260" role="img" aria-label={block.params?.caption ?? `${sets.length}集合のベン図`}>
      <defs>
        <mask id={outsideMaskId}>
          <rect width="420" height="260" fill="white" />
          {circles.map((circle, index) => <circle fill="black" key={`mask-${index}`} {...circle} />)}
        </mask>
      </defs>
      {showUniverse && <rect className="venn-universe" x="24" y="18" width="372" height="224" rx="4" />}
      {shaded.map((region, index) => {
        if (region === "outside") return <rect className="venn-shade" key={`shade-${index}`} x="24" y="18" width="372" height="224" mask={`url(#${outsideMaskId})`} />;
        const ids = region.split("&");
        if (ids.length === 1) return <circle className="venn-shade" key={`shade-${index}`} {...circleById.get(ids[0])!} />;
        return <path className="venn-shade venn-intersection-shade" d={intersectionPoints(ids)} key={`shade-${index}`} />;
      })}
      {circles.map((circle, index) => <circle className="venn-set" key={sets[index].id} {...circle} />)}
      {showUniverse && <SvgInlineLabel className="venn-universe-label" source={universe} width={180} x={37} y={39} />}
      {sets.map((set, index) => {
        const positions = isThree
          ? [{ x: 112, y: 55 }, { x: 308, y: 55 }, { x: 210, y: 247 }]
          : [{ x: 108, y: 46 }, { x: 312, y: 46 }];
        return <SvgInlineLabel className="venn-set-label" key={`label-${set.id}`} source={set.label} textAnchor="middle" width={120} x={positions[index].x} y={positions[index].y} />;
      })}
      {regions.map((region) => {
        const position = regionPosition(region.key);
        return position ? <SvgInlineLabel className="venn-region-label" key={`region-${region.key}`} source={region.label} textAnchor="middle" width={120} x={position.x} y={position.y} /> : null;
      })}
    </svg>
  );
}

function TreeDiagram({ block }: { block: StudioBlock }) {
  const result = parseTreeDiagramConfig(block.params);
  if (!result.ok) {
    return <FigureFallback details={result.errors.join(" ")} raw={block.raw} title="樹形図を表示できません" />;
  }

  const { root, nodes, branches, results, stages, showNodeLabels } = result.config;
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const branchByParent = new Map<string, typeof branches>();
  for (const branch of branches) {
    const siblings = branchByParent.get(branch.from) ?? [];
    siblings.push(branch);
    branchByParent.set(branch.from, siblings);
  }

  const depths = new Map<string, number>([[root.id, 0]]);
  const queue = [root.id];
  for (let index = 0; index < queue.length; index += 1) {
    const node = queue[index];
    for (const branch of branchByParent.get(node) ?? []) {
      depths.set(branch.to, (depths.get(node) ?? 0) + 1);
      queue.push(branch.to);
    }
  }
  const maxDepth = Math.max(1, ...depths.values());
  const leaves: string[] = [];
  const collectLeaves = (node: string) => {
    const children = branchByParent.get(node) ?? [];
    if (!children.length) {
      leaves.push(node);
      return;
    }
    children.forEach((branch) => collectLeaves(branch.to));
  };
  collectLeaves(root.id);

  const viewHeight = Math.max(220, Math.min(380, leaves.length * 42 + 60));
  const top = 48;
  const bottom = viewHeight - 28;
  const yByNode = new Map<string, number>();
  leaves.forEach((leaf, index) => {
    const y = leaves.length === 1
      ? (top + bottom) / 2
      : top + index * ((bottom - top) / (leaves.length - 1));
    yByNode.set(leaf, y);
  });
  const placeParent = (node: string): number => {
    const existing = yByNode.get(node);
    if (existing !== undefined) return existing;
    const children = (branchByParent.get(node) ?? []).map((branch) => placeParent(branch.to));
    const y = children.reduce((sum, value) => sum + value, 0) / Math.max(1, children.length);
    yByNode.set(node, y);
    return y;
  };
  placeParent(root.id);

  const left = 68;
  const right = 492;
  const xFor = (node: string) => left + ((depths.get(node) ?? 0) / maxDepth) * (right - left);
  const resultByNode = new Map(results.map((item) => [item.node, item]));

  return (
    <svg
      className="tree-diagram"
      style={{ height: `${Math.min(318, viewHeight)}px` }}
      viewBox={`0 0 660 ${viewHeight}`}
      role="img"
      aria-label={block.params?.caption ?? "樹形図"}
    >
      {stages.map((stage, index) => (
        <SvgInlineLabel
          className="tree-stage-label"
          key={`stage-${index}`}
          source={stage}
          textAnchor="middle"
          width={120}
          x={left + (index / maxDepth) * (right - left)}
          y={19}
        />
      ))}
      {branches.map((branch) => {
        const x1 = xFor(branch.from);
        const y1 = yByNode.get(branch.from) ?? 0;
        const x2 = xFor(branch.to);
        const y2 = yByNode.get(branch.to) ?? 0;
        const labelRatio = 0.7;
        const labelX = x1 + (x2 - x1) * labelRatio;
        const labelY = y1 + (y2 - y1) * labelRatio;
        return (
          <g key={`${branch.from}-${branch.to}`}>
            <line className="tree-branch" x1={x1} y1={y1} x2={x2} y2={y2} />
            {branch.label && (
              <SvgInlineLabel
                className="tree-branch-label"
                source={branch.label}
                textAnchor="middle"
                width={110}
                x={labelX}
                y={labelY - 4}
              />
            )}
            {branch.probability && (
              <SvgInlineLabel
                className="tree-probability"
                source={branch.probability}
                textAnchor="middle"
                width={110}
                x={labelX}
                y={labelY - 4 + (branch.label ? 13 : 0)}
              />
            )}
          </g>
        );
      })}
      {nodes.map((node) => {
        const x = xFor(node.id);
        const y = yByNode.get(node.id) ?? 0;
        const isRoot = node.id === root.id;
        const isLeaf = leaves.includes(node.id);
        const showLabel = isRoot || (showNodeLabels && !isLeaf);
        return (
          <g key={node.id}>
            <circle className={`tree-node${isLeaf ? " tree-leaf" : ""}`} cx={x} cy={y} r={isRoot ? 4.8 : 4} />
            {showLabel && (
              <SvgInlineLabel
                className="tree-node-label"
                source={node.label}
                textAnchor={isRoot ? "end" : "start"}
                width={110}
                x={x + (isRoot ? -10 : 8)}
                y={y - 7}
              />
            )}
          </g>
        );
      })}
      {leaves.map((leaf) => {
        const item = resultByNode.get(leaf);
        const label = item?.label ?? (showNodeLabels ? nodeById.get(leaf)?.label : "");
        if (!label && !item?.probability) return null;
        const x = xFor(leaf) + 12;
        const y = yByNode.get(leaf) ?? 0;
        return (
          <g key={`result-${leaf}`}>
            {label && (
              <SvgInlineLabel
                className="tree-result-label"
                source={label}
                width={135}
                x={x}
                y={y - (item?.probability ? 3 : -4)}
              />
            )}
            {item?.probability && (
              <SvgInlineLabel
                className="tree-result-probability"
                source={item.probability}
                width={135}
                x={x}
                y={y - 3 + (label ? 13 : 0)}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Histogram({ block }: { block: StudioBlock }) {
  const result = parseHistogramConfig(block.params);
  if (!result.ok) {
    return <FigureFallback details={result.errors.join(" ")} raw={block.raw} title="ヒストグラムを表示できません" />;
  }

  const { boundaries, frequencies, xLabel, yLabel, yMax, yTick, showValues } = result.config;
  const left = 62;
  const right = 620;
  const top = 24;
  const bottom = 218;
  const scaleX = (value: number) => left + ((value - boundaries[0]) / (boundaries.at(-1)! - boundaries[0])) * (right - left);
  const scaleY = (value: number) => bottom - (value / yMax) * (bottom - top);
  const yTicks: number[] = [];
  for (let value = 0; value <= yMax + yTick * 0.001; value += yTick) yTicks.push(value);
  if (Math.abs((yTicks.at(-1) ?? 0) - yMax) > yTick * 0.001) yTicks.push(yMax);

  return (
    <svg className="histogram" viewBox="0 0 660 270" role="img" aria-label={block.params?.caption ?? "ヒストグラム"}>
      <g className="stat-grid">
        {yTicks.map((value) => (
          <line key={`grid-${value}`} x1={left} x2={right} y1={scaleY(value)} y2={scaleY(value)} />
        ))}
      </g>
      <g className="histogram-bars">
        {frequencies.map((frequency, index) => {
          const x = scaleX(boundaries[index]);
          const width = scaleX(boundaries[index + 1]) - x;
          const y = scaleY(frequency);
          return (
            <g key={`bar-${index}`}>
              <rect x={x} y={y} width={width} height={bottom - y} />
              {showValues && frequency > 0 && (
                <text className="stat-value-label" textAnchor="middle" x={x + width / 2} y={Math.max(top + 11, y - 6)}>{formatFigureNumber(frequency)}</text>
              )}
            </g>
          );
        })}
      </g>
      <g className="stat-axes">
        <line x1={left} x2={right} y1={bottom} y2={bottom} />
        <line x1={left} x2={left} y1={top} y2={bottom} />
        {boundaries.map((value) => (
          <g key={`x-${value}`}>
            <line x1={scaleX(value)} x2={scaleX(value)} y1={bottom} y2={bottom + 5} />
            <text textAnchor="middle" x={scaleX(value)} y={bottom + 19}>{formatFigureNumber(value)}</text>
          </g>
        ))}
        {yTicks.map((value) => (
          <g key={`y-${value}`}>
            <line x1={left - 5} x2={left} y1={scaleY(value)} y2={scaleY(value)} />
            <text textAnchor="end" x={left - 9} y={scaleY(value) + 4}>{formatFigureNumber(value)}</text>
          </g>
        ))}
      </g>
      <SvgInlineLabel className="stat-axis-label" source={xLabel} textAnchor="middle" width={260} x={(left + right) / 2} y={263} />
      <SvgInlineLabel className="stat-axis-label" rotate={-90} source={yLabel} textAnchor="middle" width={180} x={15} y={(top + bottom) / 2} />
    </svg>
  );
}

function BoxPlot({ block }: { block: StudioBlock }) {
  const result = parseBoxPlotConfig(block.params);
  if (!result.ok) {
    return <FigureFallback details={result.errors.join(" ")} raw={block.raw} title="箱ひげ図を表示できません" />;
  }

  const { series, range, tickStep, axisLabel, showValues } = result.config;
  const left = 92;
  const right = 625;
  const axisY = 50 + series.length * 58;
  const viewHeight = axisY + 45;
  const scaleX = (value: number) => left + ((value - range[0]) / (range[1] - range[0])) * (right - left);
  const ticks: number[] = [];
  const firstTick = Math.ceil(range[0] / tickStep) * tickStep;
  for (let value = firstTick; value <= range[1] + tickStep * 0.001; value += tickStep) ticks.push(value);

  return (
    <svg className="box-plot" style={{ height: `${Math.min(315, viewHeight)}px` }} viewBox={`0 0 660 ${viewHeight}`} role="img" aria-label={block.params?.caption ?? "箱ひげ図"}>
      <g className="box-plot-grid">
        {ticks.map((value) => <line key={`grid-${value}`} x1={scaleX(value)} x2={scaleX(value)} y1="18" y2={axisY} />)}
      </g>
      {series.map((item, index) => {
        const [min, q1, median, q3, max] = item.fiveNumber;
        const y = 42 + index * 58;
        const uniqueValues = [...new Set(item.fiveNumber)];
        return (
          <g className="box-plot-series" key={`${item.label}-${index}`}>
            <SvgInlineLabel className="box-plot-series-label" source={item.label} textAnchor="end" width={135} x={left - 12} y={y + 4} />
            <line className="box-whisker" x1={scaleX(min)} x2={scaleX(max)} y1={y} y2={y} />
            <line className="box-cap" x1={scaleX(min)} x2={scaleX(min)} y1={y - 11} y2={y + 11} />
            <line className="box-cap" x1={scaleX(max)} x2={scaleX(max)} y1={y - 11} y2={y + 11} />
            <rect className="box-body" x={scaleX(q1)} y={y - 17} width={Math.max(1, scaleX(q3) - scaleX(q1))} height="34" />
            <line className="box-median" x1={scaleX(median)} x2={scaleX(median)} y1={y - 17} y2={y + 17} />
            {item.outliers.map((value, outlierIndex) => (
              <circle className="box-outlier" key={`outlier-${outlierIndex}`} cx={scaleX(value)} cy={y} r="4" />
            ))}
            {showValues && uniqueValues.map((value, valueIndex) => (
              <text className="box-value-label" key={`value-${value}`} textAnchor="middle" x={scaleX(value)} y={y + 31 + (valueIndex % 2) * 11}>{formatFigureNumber(value)}</text>
            ))}
          </g>
        );
      })}
      <g className="stat-axes">
        <line x1={left} x2={right} y1={axisY} y2={axisY} />
        {ticks.map((value) => (
          <g key={`tick-${value}`}>
            <line x1={scaleX(value)} x2={scaleX(value)} y1={axisY} y2={axisY + 5} />
            <text textAnchor="middle" x={scaleX(value)} y={axisY + 19}>{formatFigureNumber(value)}</text>
          </g>
        ))}
      </g>
      <SvgInlineLabel className="stat-axis-label" source={axisLabel} textAnchor="middle" width={260} x={(left + right) / 2} y={axisY + 39} />
    </svg>
  );
}

function ScatterPlot({ block }: { block: StudioBlock }) {
  const instanceId = useId().replace(/:/g, "");
  const result = parseScatterPlotConfig(block.params);
  if (!result.ok) {
    return <FigureFallback details={result.errors.join(" ")} raw={block.raw} title="散布図を表示できません" />;
  }

  const { points, xRange, yRange, xTick, yTick, xLabel, yLabel, showGrid, showLabels, trend } = result.config;
  const clipId = `scatter-clip-${instanceId}`;
  const left = 62;
  const right = 620;
  const top = 24;
  const bottom = 226;
  const scaleX = (value: number) => left + ((value - xRange[0]) / (xRange[1] - xRange[0])) * (right - left);
  const scaleY = (value: number) => bottom - ((value - yRange[0]) / (yRange[1] - yRange[0])) * (bottom - top);
  const ticksFor = (range: [number, number], step: number) => {
    const ticks: number[] = [];
    const first = Math.ceil(range[0] / step) * step;
    for (let value = first; value <= range[1] + step * 0.001; value += step) {
      ticks.push(Number(value.toPrecision(12)));
    }
    return ticks;
  };
  const xTicks = ticksFor(xRange, xTick);
  const yTicks = ticksFor(yRange, yTick);

  return (
    <svg className="scatter-plot" viewBox="0 0 660 280" role="img" aria-label={block.params?.caption ?? "散布図"}>
      <defs>
        <clipPath id={clipId}><rect x={left} y={top} width={right - left} height={bottom - top} /></clipPath>
      </defs>
      {showGrid && (
        <g className="scatter-grid">
          {xTicks.map((value) => <line key={`grid-x-${value}`} x1={scaleX(value)} x2={scaleX(value)} y1={top} y2={bottom} />)}
          {yTicks.map((value) => <line key={`grid-y-${value}`} x1={left} x2={right} y1={scaleY(value)} y2={scaleY(value)} />)}
        </g>
      )}
      <g className="stat-axes">
        <line x1={left} x2={right} y1={bottom} y2={bottom} />
        <line x1={left} x2={left} y1={top} y2={bottom} />
        {xTicks.map((value) => (
          <g key={`x-${value}`}>
            <line x1={scaleX(value)} x2={scaleX(value)} y1={bottom} y2={bottom + 5} />
            <text textAnchor="middle" x={scaleX(value)} y={bottom + 19}>{formatFigureNumber(value)}</text>
          </g>
        ))}
        {yTicks.map((value) => (
          <g key={`y-${value}`}>
            <line x1={left - 5} x2={left} y1={scaleY(value)} y2={scaleY(value)} />
            <text textAnchor="end" x={left - 9} y={scaleY(value) + 4}>{formatFigureNumber(value)}</text>
          </g>
        ))}
      </g>
      <g clipPath={`url(#${clipId})`}>
        {trend && (
          <line
            className="scatter-trend"
            x1={scaleX(xRange[0])}
            x2={scaleX(xRange[1])}
            y1={scaleY(trend.slope * xRange[0] + trend.intercept)}
            y2={scaleY(trend.slope * xRange[1] + trend.intercept)}
          />
        )}
        {points.map((point, index) => (
          <g className="scatter-point" key={`point-${index}`}>
            <circle cx={scaleX(point.x)} cy={scaleY(point.y)} r="4.5" />
            {showLabels && point.label && (
              <SvgInlineLabel className="scatter-point-label" source={point.label} width={100} x={scaleX(point.x) + 7} y={scaleY(point.y) - 7} />
            )}
          </g>
        ))}
      </g>
      {trend && <SvgInlineLabel className="scatter-trend-label" source={trend.label} textAnchor="end" width={180} x={right} y={top + 13} />}
      <SvgInlineLabel className="stat-axis-label" source={xLabel} textAnchor="middle" width={260} x={(left + right) / 2} y={274} />
      <SvgInlineLabel className="stat-axis-label" rotate={-90} source={yLabel} textAnchor="middle" width={180} x={15} y={(top + bottom) / 2} />
    </svg>
  );
}

function ProbabilityDistribution({ block }: { block: StudioBlock }) {
  const result = parseProbabilityDistributionConfig(block.params);
  if (!result.ok) {
    return <FigureFallback details={result.errors.join(" ")} raw={block.raw} title="確率分布図を表示できません" />;
  }

  const { distribution, n, p, mean, standardDeviation, xRange, xTick, xLabel, shade, showParameters } = result.config;
  const left = 62;
  const right = 620;
  const top = 34;
  const bottom = 226;
  const scaleX = (value: number) => left + ((value - xRange[0]) / (xRange[1] - xRange[0])) * (right - left);
  const ticks: number[] = [];
  const firstTick = Math.ceil(xRange[0] / xTick) * xTick;
  for (let value = firstTick; value <= xRange[1] + xTick * 0.001; value += xTick) ticks.push(Number(value.toPrecision(12)));
  const isShaded = (value: number) => !shade
    ? false
    : shade.kind === "left"
      ? value <= (shade.upper ?? -Infinity)
      : shade.kind === "right"
        ? value >= (shade.lower ?? Infinity)
        : value >= (shade.lower ?? -Infinity) && value <= (shade.upper ?? Infinity);
  const parameterLabel = distribution === "binomial"
    ? `二項分布  n=${n}, p=${formatFigureNumber(p ?? 0)}　μ=${formatFigureNumber(mean)}　σ=${formatFigureNumber(standardDeviation)}`
    : `正規分布  μ=${formatFigureNumber(mean)}　σ=${formatFigureNumber(standardDeviation)}`;

  if (distribution === "binomial") {
    const count = n ?? 1;
    const probability = p ?? 0.5;
    const pmf: number[] = [];
    let current = (1 - probability) ** count;
    for (let k = 0; k <= count; k += 1) {
      if (k === 0) pmf.push(current);
      else {
        current *= ((count - k + 1) / k) * (probability / (1 - probability));
        pmf.push(current);
      }
    }
    const visible = pmf.map((value, k) => ({ k, value })).filter(({ k }) => k >= xRange[0] && k <= xRange[1]);
    const yMax = Math.max(...visible.map(({ value }) => value), 0.01) * 1.18;
    const scaleY = (value: number) => bottom - (value / yMax) * (bottom - top);
    const unit = (right - left) / Math.max(1, xRange[1] - xRange[0] + 1);
    const barWidth = Math.max(2, Math.min(24, unit * 0.72));
    return (
      <svg className="probability-distribution" viewBox="0 0 660 280" role="img" aria-label={block.params?.caption ?? "二項分布"}>
        {showParameters && <SvgInlineLabel className="probability-parameter-label" source={parameterLabel} width={440} x={left} y={17} />}
        <g className="probability-grid">{ticks.map((value) => <line key={`grid-${value}`} x1={scaleX(value)} x2={scaleX(value)} y1={top} y2={bottom} />)}</g>
        <g className="probability-bars">
          {visible.map(({ k, value }) => (
            <rect className={isShaded(k) ? "is-shaded" : ""} key={`bar-${k}`} x={scaleX(k) - barWidth / 2} y={scaleY(value)} width={barWidth} height={bottom - scaleY(value)} />
          ))}
        </g>
        <g className="stat-axes">
          <line x1={left} x2={right} y1={bottom} y2={bottom} />
          <line x1={left} x2={left} y1={top} y2={bottom} />
          {ticks.map((value) => <g key={`tick-${value}`}><line x1={scaleX(value)} x2={scaleX(value)} y1={bottom} y2={bottom + 5} /><text textAnchor="middle" x={scaleX(value)} y={bottom + 19}>{formatFigureNumber(value)}</text></g>)}
        </g>
        <SvgInlineLabel className="stat-axis-label" source={xLabel} textAnchor="middle" width={260} x={(left + right) / 2} y={274} />
      </svg>
    );
  }

  const density = (value: number) => Math.exp(-0.5 * ((value - mean) / standardDeviation) ** 2);
  const scaleY = (value: number) => bottom - value * (bottom - top - 12);
  const samples = Array.from({ length: 181 }, (_, index) => xRange[0] + ((xRange[1] - xRange[0]) * index) / 180);
  const linePath = samples.map((value, index) => `${index ? "L" : "M"}${scaleX(value)},${scaleY(density(value))}`).join(" ");
  const shadedSamples = samples.filter(isShaded);
  const shadePath = shadedSamples.length > 1
    ? `M${scaleX(shadedSamples[0])},${bottom} ${shadedSamples.map((value) => `L${scaleX(value)},${scaleY(density(value))}`).join(" ")} L${scaleX(shadedSamples.at(-1) ?? shadedSamples[0])},${bottom} Z`
    : "";
  return (
    <svg className="probability-distribution" viewBox="0 0 660 280" role="img" aria-label={block.params?.caption ?? "正規分布"}>
      {showParameters && <SvgInlineLabel className="probability-parameter-label" source={parameterLabel} width={440} x={left} y={17} />}
      <g className="probability-grid">{ticks.map((value) => <line key={`grid-${value}`} x1={scaleX(value)} x2={scaleX(value)} y1={top} y2={bottom} />)}</g>
      {shadePath && <path className="probability-area" d={shadePath} />}
      <path className="probability-curve" d={linePath} />
      {mean >= xRange[0] && mean <= xRange[1] && <line className="probability-mean" x1={scaleX(mean)} x2={scaleX(mean)} y1={scaleY(1)} y2={bottom} />}
      <g className="stat-axes">
        <line x1={left} x2={right} y1={bottom} y2={bottom} />
        {ticks.map((value) => <g key={`tick-${value}`}><line x1={scaleX(value)} x2={scaleX(value)} y1={bottom} y2={bottom + 5} /><text textAnchor="middle" x={scaleX(value)} y={bottom + 19}>{formatFigureNumber(value)}</text></g>)}
      </g>
      <SvgInlineLabel className="stat-axis-label" source={xLabel} textAnchor="middle" width={260} x={(left + right) / 2} y={274} />
    </svg>
  );
}

function FigureRenderer({ block }: { block: StudioBlock }) {
  let content: ReactNode;
  if (block.figureType === "mermaid") content = <MermaidFigure source={block.raw ?? ""} />;
  else if (block.figureType === "function-graph") content = <FunctionGraph block={block} />;
  else if (block.figureType === "data-chart") content = <DataChart block={block} />;
  else if (block.figureType === "number-line") content = <NumberLine block={block} />;
  else if (block.figureType === "sign-chart") content = <SignChart block={block} />;
  else if (block.figureType === "triangle") content = <TriangleFigure block={block} />;
  else if (block.figureType === "circle") content = <CircleFigure block={block} />;
  else if (block.figureType === "venn-diagram") content = <VennDiagram block={block} />;
  else if (block.figureType === "tree-diagram") content = <TreeDiagram block={block} />;
  else if (block.figureType === "histogram") content = <Histogram block={block} />;
  else if (block.figureType === "box-plot") content = <BoxPlot block={block} />;
  else if (block.figureType === "scatter-plot") content = <ScatterPlot block={block} />;
  else if (block.figureType === "probability-distribution") content = <ProbabilityDistribution block={block} />;
  else if (block.figureType === "image") {
    const src = block.params?.src ?? "";
    const safe = src.startsWith("data:image/") || src.startsWith("blob:") || src.startsWith("/");
    content = safe ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img className="figure-image" src={src} alt={block.params?.alt ?? block.params?.caption ?? ""} />
    ) : (
      <div className="render-fallback">
        <AlertCircle size={17} />
        <div><strong>画像を表示できません</strong><span>ローカル画像を選択して挿入してください。</span></div>
      </div>
    );
  } else {
    content = (
      <div className="render-fallback">
        <AlertCircle size={17} />
        <div><strong>未対応の図表です</strong><code>{block.raw}</code></div>
      </div>
    );
  }
  return (
    <figure className="lesson-figure">
      {content}
      {block.params?.caption && (
        <figcaption>
          <InlineMarkdownContent kind="caption" source={block.params.caption} />
        </figcaption>
      )}
    </figure>
  );
}

function BlockRenderer({
  block,
  measurement = false,
  onSelectLine,
}: {
  block: StudioBlock;
  measurement?: boolean;
  onSelectLine: (line: number) => void;
}) {
  if (block.type === "heading") {
    const Tag = `h${Math.min(block.level ?? 2, 4)}` as keyof React.JSX.IntrinsicElements;
    return <Tag><InlineMarkdownContent kind="heading" source={block.markdown} /></Tag>;
  }
  if (block.type === "figure") return <FigureRenderer block={block} />;
  if (block.type === "callout") {
    const label = block.title || BLOCK_LABELS[block.blockName ?? ""] || block.blockName;
    const icon =
      block.blockName === "caution" ? <TriangleAlert size={15} /> :
      block.blockName === "key-point" ? <Lightbulb size={15} /> :
      block.blockName === "exercise" ? <ListChecks size={15} /> :
      block.blockName === "answer-question" ? <BookOpen size={15} /> :
      block.blockName === "solution" ? <CheckCircle2 size={15} /> :
      <Info size={15} />;
    return (
      <section className={`lesson-callout callout-${block.blockName ?? "generic"} box-fragment--${block.fragmentRole ?? "single"}`} data-fragment-role={block.fragmentRole ?? "single"}>
        <div className="callout-title">
          {icon}
          <span>
            <InlineMarkdownContent kind="title" source={label ?? ""} />
            {block.continuation ? "（続き）" : ""}
          </span>
        </div>
        <div className="callout-content">
          {block.children?.length ? block.children.map((child) => (
            <RenderedStudioBlock
              block={child}
              key={child.id}
              measurement={measurement}
              nested
              onSelectLine={onSelectLine}
            />
          )) : <MarkdownContent source={block.markdown || "（空のブロック）"} />}
        </div>
        {(block.fragmentRole === "first" || block.fragmentRole === "middle") && (
          <div aria-hidden="true" className="box-continuation-marker">次ページへ続く</div>
        )}
      </section>
    );
  }
  if (block.type === "code") {
    return (
      <div className="lesson-code">
        {block.continuation && <strong>コード（続き）</strong>}
        <pre><code>{block.raw}</code></pre>
      </div>
    );
  }
  if (block.type === "math" && block.renderStatus === "fallback") {
    return (
      <div className="render-fallback" onClick={() => onSelectLine(block.startLine)}>
        <AlertCircle size={17} />
        <div><strong>数式を表示できません</strong><span>入力 {block.startLine}行目</span><code>{block.raw}</code></div>
      </div>
    );
  }
  return <MarkdownContent source={block.markdown} />;
}

function RenderedStudioBlock({
  block,
  measurement = false,
  nested = false,
  onSelectLine,
}: {
  block: StudioBlock;
  measurement?: boolean;
  nested?: boolean;
  onSelectLine: (line: number) => void;
}) {
  const paginationConstraint = paginationConstraintFor(block);
  const scale = block.paginationScale ?? 1;
  const scaled = scale < 0.999 && Boolean(block.paginationOriginalHeight);
  const wrapperStyle = scaled
    ? {
        height: `${Math.max(1, (block.paginationOriginalHeight ?? 1) * scale)}px`,
        overflow: "hidden",
      } as CSSProperties
    : undefined;
  const frameStyle = scaled
    ? {
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        width: `${100 / scale}%`,
      } as CSSProperties
    : undefined;
  const rendered = (
    <RenderBoundary block={block}>
      <BlockRenderer block={block} measurement={measurement} onSelectLine={onSelectLine} />
    </RenderBoundary>
  );

  return (
    <div
      className={`preview-block preview-block-${block.type}${nested ? " preview-block-nested" : ""}${scaled ? " pagination-scaled" : ""}`}
      data-block-id={block.id}
      data-fragment-role={block.fragmentRole}
      data-measure={measurement ? undefined : "block"}
      data-pagination-block-id={measurement ? block.id : undefined}
      data-pagination-node-type={block.type}
      data-pagination-role={paginationConstraint.role}
      data-pagination-strategy={paginationConstraint.strategy}
      data-pagination-origin-block-id={block.originBlockId}
      data-pagination-fragment-index={block.fragmentIndex}
      data-pagination-fragment-count={block.fragmentCount}
      data-pagination-line-count={block.paginationLineCount}
      data-source-line={block.startLine}
      onDoubleClick={measurement ? undefined : () => onSelectLine(block.startLine)}
      style={wrapperStyle}
    >
      {scaled ? <div className="pagination-scale-frame" style={frameStyle}>{rendered}</div> : rendered}
    </div>
  );
}

function PaperHeader({ metadata }: { metadata: Metadata }) {
  return (
    <div className="paper-header" data-pagination-header>
      <span>
        <InlineMarkdownContent
          kind="metadata"
          source={`${metadata.subject}${metadata.difficulty ? `｜${metadata.difficulty}` : ""}`}
        />
      </span>
      <span><InlineMarkdownContent kind="metadata" source={metadata.lesson_id || metadata.title} /></span>
    </div>
  );
}

function PaperFooter({
  cover = false,
  metadata,
  pageNumber,
  settings,
}: {
  cover?: boolean;
  metadata: Metadata;
  pageNumber: number;
  settings: StudioSettings;
}) {
  if (!settings.showFooter) return null;
  return (
    <footer
      className={`paper-footer page-number-${settings.pageNumberPosition}`}
      data-pagination-footer
    >
      <span className="footer-copyright">
        <InlineMarkdownContent kind="metadata" source={settings.copyright || metadata.copyright} />
      </span>
      <span className="footer-page-number">{cover ? 1 : pageNumber}</span>
      <span className="footer-title">
        {cover ? null : (
          <InlineMarkdownContent
            kind="metadata"
            source={`${metadata.lesson_id ? `${metadata.lesson_id}｜` : ""}${metadata.title}`}
          />
        )}
      </span>
    </footer>
  );
}

function debugMetric(value: number | undefined) {
  return value === undefined || !Number.isFinite(value) ? "—" : value.toFixed(1);
}

function PaginationDebugOverlay({
  actual,
  page,
}: {
  actual: PaginationPageGeometry;
  page: PageModel;
}) {
  const debug = page.paginationDebug;
  return (
    <aside aria-hidden="true" className="pagination-debug-overlay">
      <span className="pagination-debug-line is-actual" data-label="実DOM本文下端" style={{ top: actual.contentBottom }} />
      {debug?.engineContentBottom !== undefined ? (
        <span className="pagination-debug-line is-engine" data-label="Engine本文下端" style={{ top: debug.engineContentBottom }} />
      ) : null}
      {actual.footerTop !== undefined ? (
        <span className="pagination-debug-line is-footer" data-label="footer上端" style={{ top: actual.footerTop }} />
      ) : null}
      <dl className="pagination-debug-panel">
        <div><dt>pageNumber</dt><dd>{page.number}</dd></div>
        <div><dt>pageHeight</dt><dd>{debugMetric(actual.pageHeight)}</dd></div>
        <div><dt>contentTop</dt><dd>{debugMetric(actual.contentTop)}</dd></div>
        <div><dt>contentBottom</dt><dd>{debugMetric(actual.contentBottom)}</dd></div>
        <div><dt>footerTop</dt><dd>{debugMetric(actual.footerTop)}</dd></div>
        <div><dt>usableHeight</dt><dd>{debugMetric(actual.usableHeight)}</dd></div>
        <div><dt>usedHeight</dt><dd>{debugMetric(debug?.usedHeight)}</dd></div>
        <div><dt>remainingHeight</dt><dd>{debugMetric(debug?.remainingHeight)}</dd></div>
        <div><dt>nextNodeType</dt><dd>{debug?.nextNodeType ?? "—"}</dd></div>
        <div><dt>nextNodeHeight</dt><dd>{debugMetric(debug?.nextNodeHeight)}</dd></div>
        <div><dt>minimumFragmentHeight</dt><dd>{debugMetric(debug?.minimumFragmentHeight)}</dd></div>
        <div><dt>breakReason</dt><dd>{debug?.breakReason ?? "—"}</dd></div>
      </dl>
    </aside>
  );
}

function LessonPage({
  active = true,
  debugPagination = false,
  page,
  metadata,
  settings,
  onSelectLine,
  cover,
}: {
  active?: boolean;
  debugPagination?: boolean;
  page: PageModel;
  metadata: Metadata;
  settings: StudioSettings;
  onSelectLine: (line: number) => void;
  cover?: boolean;
}) {
  const pageRef = useRef<HTMLElement>(null);
  const [actualGeometry, setActualGeometry] = useState<PaginationPageGeometry | null>(null);

  useLayoutEffect(() => {
    const article = pageRef.current;
    if (!article || !debugPagination || cover) {
      setActualGeometry(null);
      return;
    }
    let frame = 0;
    const update = () => {
      const next = measurePageGeometry(article);
      setActualGeometry((current) => (
        current &&
        Math.abs(current.contentTop - next.contentTop) < 0.05 &&
        Math.abs(current.contentBottom - next.contentBottom) < 0.05 &&
        Math.abs((current.footerTop ?? -1) - (next.footerTop ?? -1)) < 0.05
          ? current
          : next
      ));
    };
    frame = window.requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(article);
    document.fonts?.ready.then(update).catch(() => {});
    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [cover, debugPagination, page.blocks, settings.showFooter, settings.showHeader]);

  const footer = (
    <PaperFooter
      cover={cover}
      metadata={metadata}
      pageNumber={page.number}
      settings={settings}
    />
  );
  if (cover) {
    return (
      <article aria-hidden={!active} className={`paper lesson-paper ${lessonThemeClass(settings)}${active ? " is-active" : ""}`} data-pagination-page ref={pageRef} style={metadataStyle(settings)}>
        <div className="cover-page">
          <span><InlineMarkdownContent kind="metadata" source={metadata.subject} /></span>
          <h2><InlineMarkdownContent kind="metadata" source={metadata.title} /></h2>
          <p><InlineMarkdownContent kind="metadata" source={metadata.difficulty} /></p>
          <small><InlineMarkdownContent kind="metadata" source={metadata.author} /></small>
        </div>
        {footer}
      </article>
    );
  }
  return (
    <article
      className={`paper lesson-paper ${lessonThemeClass(settings)}${active ? " is-active" : ""}`}
      aria-hidden={!active}
      style={metadataStyle(settings)}
      data-pagination-page
      data-page-number={page.number}
      data-pagination-break-reason={page.paginationDebug?.breakReason}
      data-pagination-remaining-height={page.paginationDebug?.remainingHeight}
      data-pagination-next-node={page.paginationDebug?.nextNode}
      data-pagination-next-node-type={page.paginationDebug?.nextNodeType}
      data-pagination-next-node-height={page.paginationDebug?.nextNodeHeight}
      data-pagination-minimum-fragment-height={page.paginationDebug?.minimumFragmentHeight}
      data-pagination-keep-with-next={page.paginationDebug?.keepWithNext}
      data-pagination-keep-with-previous={page.paginationDebug?.keepWithPrevious}
      data-pagination-atomic={page.paginationDebug?.atomic}
      data-pagination-splittable={page.paginationDebug?.splittable}
      data-pagination-container={page.paginationDebug?.container}
      data-pagination-page-height={page.paginationDebug?.pageHeight}
      data-pagination-content-top={page.paginationDebug?.contentTop}
      data-pagination-content-bottom={page.paginationDebug?.contentBottom}
      data-pagination-footer-top={page.paginationDebug?.footerTop}
      data-pagination-usable-height={page.paginationDebug?.usableHeight}
      data-pagination-used-height={page.paginationDebug?.usedHeight}
      ref={pageRef}
    >
      <div className="paper-content" data-measure="page-content" data-pagination-content>
        {settings.showHeader && <PaperHeader metadata={metadata} />}
        {page.blocks.length ? page.blocks.map((block) => (
          <RenderedStudioBlock
            block={block}
            key={block.id}
            onSelectLine={onSelectLine}
          />
        )) : (
          <div className="empty-page"><FileText size={30} /><span>Markdownを入力すると教材が表示されます</span></div>
        )}
      </div>
      {footer}
      {debugPagination && actualGeometry ? (
        <PaginationDebugOverlay actual={actualGeometry} page={page} />
      ) : null}
    </article>
  );
}

const PageDocument = React.forwardRef<HTMLDivElement, {
  activePageIndex?: number;
  className: string;
  metadata: Metadata;
  onSelectLine: (line: number) => void;
  pages: PageModel[];
  settings: StudioSettings;
  debugPagination?: boolean;
}>(({
  activePageIndex,
  className,
  metadata,
  onSelectLine,
  pages,
  settings,
  debugPagination = false,
}, ref) => (
  <div className={className} data-page-dom ref={ref}>
    {pages.map((page, index) => (
      <LessonPage
        active={activePageIndex === undefined || activePageIndex === index}
        cover={settings.includeCover && index === 0}
        debugPagination={debugPagination}
        key={`page-dom-${page.number}`}
        metadata={metadata}
        onSelectLine={onSelectLine}
        page={page}
        settings={settings}
      />
    ))}
  </div>
));
PageDocument.displayName = "PageDocument";

function useMaterialLayout(
  sourceMarkdown: string,
  outputMode: OutputMode,
  includeQuestionInAnswer: boolean,
  settings: StudioSettings,
  enabled = true,
) {
  const parsed = useMemo(() => parseDocument(sourceMarkdown), [sourceMarkdown]);
  const renderDocument = useMemo(
    () => createRenderDocument(parsed, outputMode, includeQuestionInAnswer),
    [includeQuestionInAnswer, outputMode, parsed],
  );
  const measurementBasis = useMemo(
    () => [
      sourceMarkdown,
      outputMode,
      includeQuestionInAnswer,
      // Academic color variants are token-only and must not invalidate the
      // measured page model. Their border widths, spacing and typography are
      // identical by contract.
      JSON.stringify(Object.fromEntries(
        Object.entries(settings).filter(([key]) => key !== "academicColor"),
      )),
    ].join("|"),
    [includeQuestionInAnswer, outputMode, settings, sourceMarkdown],
  );
  const fallbackPagination = useMemo(
    () => enabled
      ? paginateDocument(renderDocument.blocks, settings.includeCover)
      : { pages: [], splitIds: new Set<string>() },
    [enabled, renderDocument.blocks, settings.includeCover],
  );
  const [forcedFlowSplits, setForcedFlowSplits] = useState<{
    basis: string;
    ids: Set<string>;
  }>({ basis: "", ids: new Set() });
  const [flowSplitMeasurements, setFlowSplitMeasurements] = useState<{
    basis: string;
    contentHeight: number;
    measurements: Map<string, BlockMeasurement>;
  }>({ basis: "", contentHeight: 0, measurements: new Map() });
  const forcedFlowSplitIds = forcedFlowSplits.basis === measurementBasis
    ? forcedFlowSplits.ids
    : EMPTY_ID_SET;
  const activeFlowMeasurements = flowSplitMeasurements.basis === measurementBasis
    ? flowSplitMeasurements
    : null;
  const preparedPagination = useMemo(
    () => enabled ? prepareBlocksForPagination(
      renderDocument.blocks,
      forcedFlowSplitIds,
      activeFlowMeasurements?.measurements,
      activeFlowMeasurements?.contentHeight,
    ) : { blocks: [] as StudioBlock[], splitIds: new Set<string>() },
    [activeFlowMeasurements, enabled, renderDocument.blocks, forcedFlowSplitIds],
  );
  const forcedSplitSignature = [...forcedFlowSplitIds].sort().join(",");
  const layoutKey = useMemo(
    () => [measurementBasis, settings.includeCover, forcedSplitSignature].join("|"),
    [forcedSplitSignature, measurementBasis, settings.includeCover],
  );
  const [measuredPagination, setMeasuredPagination] = useState<{
    key: string;
    pages: PageModel[];
  } | null>(null);
  // Measure the smallest safe fragments, then let the paginator account for
  // one container frame per page. Re-measuring already merged groups can hide
  // their child boundaries and cause a late oversized merge.
  const measurementBlocks = preparedPagination.blocks;
  const pagination = measuredPagination?.key === layoutKey
    ? { pages: measuredPagination.pages, splitIds: preparedPagination.splitIds }
    : fallbackPagination;
  const measurementRef = useRef<HTMLDivElement>(null);
  const layoutPassRef = useRef({
    basis: "",
    attempts: 0,
    lastSignature: "",
    frozen: false,
  });

  useLayoutEffect(() => {
    if (!enabled) return;
    const rack = measurementRef.current;
    if (!rack) return;

    let disposed = false;
    let running = false;
    let queued = false;
    const measure = () => {
      if (disposed) return;
      if (running) {
        queued = true;
        return;
      }
      running = true;
      void (async () => {
        try {
          await waitForStableLayout(rack);
          if (disposed) return;
          const measurementPage = rack.querySelector<HTMLElement>("[data-pagination-page]");
          if (!measurementPage) return;
          const pageGeometry = measurePageGeometry(measurementPage);
          const availableHeight = Math.max(1, pageGeometry.usableHeight);
          const measurements = collectBlockMeasurements(rack);
          if (layoutPassRef.current.basis !== layoutKey) {
            layoutPassRef.current = {
              basis: layoutKey,
              attempts: 0,
              lastSignature: "",
              frozen: false,
            };
          }
          layoutPassRef.current.attempts += 1;
          const newlySplittableIds = measurementBlocks
            .filter((block) =>
              (
                block.type === "callout" ||
                block.type === "paragraph" ||
                block.type === "list" ||
                block.type === "table" ||
                block.type === "code" ||
                (block.type === "math" && (block.raw ?? "").includes("\\\\"))
              ) &&
              block.fragmentCount === undefined &&
              !block.continuation &&
              (
                (measurements.get(block.id)?.height ?? 0) > availableHeight + PAGINATION_CONFIG.overflowTolerancePx ||
                hasPreferredBreakPoints(block, measurements.get(block.id))
              ),
            )
            .map((block) => block.id)
            .filter((id) => !forcedFlowSplitIds.has(id));
          if (newlySplittableIds.length) {
            setFlowSplitMeasurements({
              basis: measurementBasis,
              contentHeight: availableHeight,
              measurements,
            });
            setForcedFlowSplits({
              basis: measurementBasis,
              ids: new Set([...forcedFlowSplitIds, ...newlySplittableIds]),
            });
            return;
          }
          const nextPages = paginateMeasuredDocument(
            measurementBlocks,
            measurements,
            availableHeight,
            settings.includeCover,
            { pageGeometry },
          );
          setMeasuredPagination((current) => {
            const currentSignature = current?.pages
              .map((page) => page.blocks.map((block) => `${block.id}@${block.paginationScale ?? 1}`).join(","))
              .join("|");
            const nextSignature = nextPages
              .map((page) => page.blocks.map((block) => `${block.id}@${block.paginationScale ?? 1}`).join(","))
              .join("|");
            if (current?.key === layoutKey && currentSignature === nextSignature) return current;
            if (layoutPassRef.current.frozen) {
              return current?.key === layoutKey ? current : { key: layoutKey, pages: nextPages };
            }
            if (
              layoutPassRef.current.attempts >= PAGINATION_CONFIG.maxLayoutPasses &&
              layoutPassRef.current.lastSignature &&
              layoutPassRef.current.lastSignature !== nextSignature
            ) {
              layoutPassRef.current.frozen = true;
            }
            layoutPassRef.current.lastSignature = nextSignature;
            return { key: layoutKey, pages: nextPages };
          });
        } finally {
          running = false;
          if (queued && !disposed) {
            queued = false;
            measure();
          }
        }
      })();
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(rack);
    for (const element of Array.from(
      rack.querySelectorAll<HTMLElement>("[data-pagination-block-id]"),
    )) observer.observe(element);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [
    forcedFlowSplitIds,
    enabled,
    layoutKey,
    measurementBlocks,
    measurementBasis,
    settings.includeCover,
  ]);

  return {
    fallbackPagination,
    layoutKey,
    measuredPagination,
    measurementBlocks,
    measurementRef,
    pages: pagination.pages,
    pagination,
    parsed,
    renderDocument,
  };
}

function LayoutMeasurement({
  blocks,
  metadata,
  measurementRef,
  settings,
}: {
  blocks: StudioBlock[];
  metadata: Metadata;
  measurementRef: React.RefObject<HTMLDivElement | null>;
  settings: StudioSettings;
}) {
  return (
    <div className="pagination-measurement" aria-hidden="true" ref={measurementRef}>
      <article className={`paper lesson-paper ${lessonThemeClass(settings)}`} data-pagination-page style={metadataStyle(settings)}>
        <div className="paper-content" data-pagination-content>
          {settings.showHeader && <PaperHeader metadata={metadata} />}
          {blocks
            .filter((block) => block.type !== "page-break")
            .map((block) => (
              <RenderedStudioBlock
                block={block}
                key={`measure-${block.id}`}
                measurement
                onSelectLine={() => {}}
              />
            ))}
        </div>
        <PaperFooter metadata={metadata} pageNumber={1} settings={settings} />
      </article>
    </div>
  );
}

async function waitForRenderedContent(container: HTMLElement) {
  await waitForStableLayout(container);
}

function renderedWarnings(container: HTMLElement): BatchMessage[] {
  const warnings: BatchMessage[] = [];
  for (const element of Array.from(container.querySelectorAll<HTMLElement>("[data-measure='block']"))) {
    if (element.scrollWidth > element.clientWidth + 2) {
      warnings.push({
        line: Number(element.dataset.sourceLine ?? 1),
        title: "横方向のオーバーフロー",
        detail: `実幅 ${element.scrollWidth}px / 有効幅 ${element.clientWidth}px`,
      });
    }
  }
  for (const fallback of Array.from(container.querySelectorAll<HTMLElement>(".render-fallback"))) {
    const line = fallback.closest<HTMLElement>("[data-source-line]")?.dataset.sourceLine;
    warnings.push({
      line: line ? Number(line) : undefined,
      title: fallback.querySelector("strong")?.textContent?.trim() || "代替表示を使用しました",
      detail: fallback.querySelector("span")?.textContent?.trim() || "図表または数式を代替表示しました。",
    });
  }
  if (container.querySelector(".figure-loading")) {
    warnings.push({ title: "図表描画が完了しませんでした", detail: "待機上限後も描画中だったため代替状態で出力しました。" });
  }
  for (const overflow of inspectPageOverflow(container)) {
    warnings.push({
      title: `${overflow.page}ページ目の縦方向オーバーフロー`,
      detail: `${overflow.nodeType}（${overflow.nodeId}）: ${overflow.overflowPx.toFixed(1)}px。${overflow.reason}`,
    });
  }
  for (const anomaly of inspectPaginationAnomalies(container)) {
    warnings.push({
      line: anomaly.line,
      title: paginationAnomalyTitle(anomaly.kind),
      detail: `${anomaly.page}ページ目: ${anomaly.reason}`,
    });
  }
  return warnings;
}

function BatchRenderSurface({
  request,
  onComplete,
  onFailure,
}: {
  request: BatchRenderRequest;
  onComplete: (result: BatchRenderResult) => void;
  onFailure: (error: Error) => void;
}) {
  const layout = useMaterialLayout(
    request.sourceMarkdown,
    request.outputMode,
    request.includeQuestionInAnswer,
    request.settings,
  );
  const pagesRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    if (completedRef.current || layout.measuredPagination?.key !== layout.layoutKey) return;
    const container = pagesRef.current;
    if (!container) return;
    let disposed = false;
    completedRef.current = true;

    const generate = async () => {
      try {
        await waitForRenderedContent(container);
        if (disposed) return;
        const parseErrors = layout.parsed.issues
          .filter((issue) => issue.severity === "error")
          .map((issue) => ({ line: issue.line, title: issue.title, detail: issue.reason }));
        const warnings = [
          ...layout.parsed.issues
            .filter((issue) => issue.severity !== "error")
            .map((issue) => ({ line: issue.line, title: issue.title, detail: issue.reason })),
          ...renderedWarnings(container),
        ];
        if (!request.settings.tolerant && parseErrors.length) {
          throw new Error(`厳格モードのため、${parseErrors[0].line ?? 1}行目のエラーでPDF生成を中止しました。`);
        }
        const generated = await generateMaterialPdf(container);
        if (disposed) return;
        const fileName = sanitizeFilename(
          layout.parsed.metadata,
          "pdf",
          editionForMode(request.outputMode),
        );
        const qaReport = {
          source_file: request.fileName,
          lesson_id: layout.parsed.metadata.lesson_id,
          title: layout.parsed.metadata.title,
          output_mode: request.outputMode,
          output_mode_label: OUTPUT_MODE_LABELS[request.outputMode],
          include_question_in_answer: request.includeQuestionInAnswer,
          theme_preset: request.settings.themePreset,
          theme_preset_label: THEME_PRESET_LABELS[request.settings.themePreset],
          design_theme: request.settings.designTheme,
          design_theme_label: DESIGN_THEME_LABELS[request.settings.designTheme],
          academic_color: designThemeSupportsColor(request.settings.designTheme) ? request.settings.academicColor : null,
          status: parseErrors.length || warnings.length ? "warning" : "passed",
          pages: generated.pageCount,
          errors: parseErrors,
          warnings,
          math_blocks: flattenStudioBlocks(layout.renderDocument.blocks).filter((block) => block.type === "math").length,
          figures: flattenStudioBlocks(layout.renderDocument.blocks).filter((block) => block.type === "figure").length,
          split_block_count: layout.pagination.splitIds.size,
          blank_page_count: layout.pages.filter((page) => !page.blocks.length).length,
          generated_at: new Date().toISOString(),
        };
        onComplete({
          generatedFile: { fileName, blob: generated.blob, pageCount: generated.pageCount },
          warnings,
          errors: parseErrors,
          qaReport,
        });
      } catch (error) {
        if (!disposed) onFailure(error instanceof Error ? error : new Error(String(error)));
      }
    };
    void generate();
    return () => {
      disposed = true;
    };
  }, [
    layout.layoutKey,
    layout.measuredPagination?.key,
    layout.pages,
    layout.pagination.splitIds,
    layout.parsed.issues,
    layout.parsed.metadata,
    layout.renderDocument.blocks,
    onComplete,
    onFailure,
    request.fileName,
    request.includeQuestionInAnswer,
    request.outputMode,
    request.settings.academicColor,
    request.settings.designTheme,
    request.settings.themePreset,
    request.settings.tolerant,
    request.token,
  ]);

  return (
    <div className="batch-render-host" data-batch-render-token={request.token}>
      <LayoutMeasurement
        blocks={layout.measurementBlocks}
        metadata={layout.parsed.metadata}
        measurementRef={layout.measurementRef}
        settings={request.settings}
      />
      <PageDocument
        className="batch-print-pages"
        metadata={layout.parsed.metadata}
        onSelectLine={() => {}}
        pages={layout.pages}
        ref={pagesRef}
        settings={request.settings}
      />
    </div>
  );
}

function IconButton({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return <button aria-label={label} title={label} type="button" onClick={onClick} disabled={disabled}>{children}</button>;
}

function IssueCard({ issue, onClick, quickFix, onPreviewFix, onUnknownChoice }: {
  issue: Issue;
  onClick: () => void;
  quickFix?: QuickFix;
  onPreviewFix: (fix: QuickFix) => void;
  onUnknownChoice: (choice: "keep" | "candidates" | "edit", issue: Issue) => void;
}) {
  const Icon = issue.severity === "error" ? AlertCircle : issue.severity === "warning" ? TriangleAlert : Info;
  const isUnknown = issue.id.startsWith("unknown-block-") || issue.id.startsWith("attribute-unknown-");
  return (
    <article className={`issue-card issue-${issue.severity}`}>
      <button className="issue-card-main" onClick={onClick} type="button">
        <Icon size={19} />
        <span>
          <strong>{issue.line}行目：{issue.title}</strong>
          <small>{issue.reason}</small>
          <em>修正例：{issue.fix}</em>
          {issue.history?.length ? <span className="fallback-history">{issue.history.join(" → ")}</span> : null}
        </span>
      </button>
      {(quickFix || isUnknown) && <div className="issue-actions">
        {quickFix && <button className="quick-fix-button" onClick={() => onPreviewFix(quickFix)} type="button">修正を確認</button>}
        {isUnknown && <>
          <button onClick={() => onUnknownChoice("keep", issue)} type="button">汎用表示のまま</button>
          <button onClick={() => onUnknownChoice("candidates", issue)} type="button">候補を見る</button>
          <button onClick={() => onUnknownChoice("edit", issue)} type="button">入力で修正</button>
        </>}
      </div>}
    </article>
  );
}

function RangeSetting({ label, value, min, max, step, unit, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  return <label>{label} <span>{value}{unit ? ` ${unit}` : ""}</span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
  </label>;
}

function AcademicColorPicker({
  disabled = false,
  onChange,
  value,
}: {
  disabled?: boolean;
  onChange: (value: AcademicColorVariant) => void;
  value: AcademicColorVariant;
}) {
  return (
    <fieldset className="academic-color-picker">
      <legend>カラー</legend>
      <div>
        {(Object.keys(ACADEMIC_COLOR_LABELS) as AcademicColorVariant[]).map((variant) => (
          <button
            aria-label={ACADEMIC_COLOR_LABELS[variant]}
            aria-pressed={value === variant}
            disabled={disabled}
            key={variant}
            onClick={() => onChange(variant)}
            title={ACADEMIC_COLOR_LABELS[variant]}
            type="button"
          >
            <span aria-hidden="true" style={{ background: ACADEMIC_COLOR_HEX[variant] }} />
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function SettingsPanel({
  settings,
  setSettings,
  clearAutosave,
  outputMode,
  setOutputMode,
  includeQuestionInAnswer,
  setIncludeQuestionInAnswer,
  exportThemeJson,
  openThemeJson,
}: {
  settings: StudioSettings;
  setSettings: React.Dispatch<React.SetStateAction<StudioSettings>>;
  clearAutosave: () => void;
  outputMode: OutputMode;
  setOutputMode: React.Dispatch<React.SetStateAction<OutputMode>>;
  includeQuestionInAnswer: boolean;
  setIncludeQuestionInAnswer: React.Dispatch<React.SetStateAction<boolean>>;
  exportThemeJson: () => void;
  openThemeJson: () => void;
}) {
  const update = <K extends keyof StudioSettings>(key: K, value: StudioSettings[K]) =>
    setSettings((current) => ({ ...current, [key]: value }));
  const toggle = (key: keyof StudioSettings, label: string, note: string) => {
    const enabled = Boolean(settings[key]);
    return <div className="setting-toggle" key={String(key)}>
      <span><strong>{label}</strong><small>{note}</small></span>
      <button aria-pressed={enabled} className={`switch ${enabled ? "is-on" : ""}`} onClick={() => update(key, !enabled as StudioSettings[typeof key])} type="button"><span /></button>
    </div>;
  };
  return (
    <div className="settings-panel">
      <h3>出力設定</h3>
      <label>出力内容
        <select value={outputMode} onChange={(event) => setOutputMode(event.target.value as OutputMode)}>
          {(Object.keys(OUTPUT_MODE_LABELS) as OutputMode[]).map((mode) => (
            <option key={mode} value={mode}>{OUTPUT_MODE_LABELS[mode]}</option>
          ))}
        </select>
      </label>
      <div className="setting-toggle">
        <span><strong>解答解説編に問題文を再掲</strong><small>対応する問題を解答の直前へ表示</small></span>
        <button aria-pressed={includeQuestionInAnswer} className={`switch ${includeQuestionInAnswer ? "is-on" : ""}`} onClick={() => setIncludeQuestionInAnswer((current) => !current)} type="button"><span /></button>
      </div>

      <h3>テーマプリセット</h3>
      <label>デザイン
        <select value={settings.designTheme} onChange={(event) => setSettings((current) => applyDesignTheme(current, event.target.value as DesignTheme))}>
          {(Object.keys(DESIGN_THEME_LABELS) as DesignTheme[]).map((theme) => (
            <option key={theme} value={theme}>{DESIGN_THEME_LABELS[theme]}</option>
          ))}
        </select>
      </label>
      {designThemeSupportsColor(settings.designTheme) ? (
        <AcademicColorPicker
          onChange={(academicColor) => setSettings((current) => ({ ...current, academicColor }))}
          value={settings.academicColor}
        />
      ) : null}
      <label>用途
        <select value={settings.themePreset} onChange={(event) => setSettings((current) => applyThemePreset(current, event.target.value as ThemePreset))}>
          {(Object.keys(THEME_PRESET_LABELS) as ThemePreset[]).map((preset) => (
            <option key={preset} value={preset}>{THEME_PRESET_LABELS[preset]}</option>
          ))}
        </select>
      </label>
      <p className="settings-note">プリセット選択後も、下の値を個別に調整できます。</p>

      <details className="settings-group" open>
        <summary>文字・間隔</summary>
        <RangeSetting label="基本文字サイズ" value={settings.fontSize} min={8} max={16} step={0.5} unit="pt" onChange={(value) => update("fontSize", value)} />
        <RangeSetting label="行間" value={settings.lineHeight} min={1.1} max={2} step={0.05} onChange={(value) => update("lineHeight", value)} />
        <RangeSetting label="段落間隔" value={settings.paragraphSpacing} min={0} max={16} step={1} unit="px" onChange={(value) => update("paragraphSpacing", value)} />
        <RangeSetting label="見出しサイズ" value={settings.headingSize} min={10} max={24} step={0.5} unit="pt" onChange={(value) => update("headingSize", value)} />
        <RangeSetting label="表の文字サイズ" value={settings.tableFontSize} min={7} max={14} step={0.5} unit="pt" onChange={(value) => update("tableFontSize", value)} />
        <RangeSetting label="コードの文字サイズ" value={settings.codeFontSize} min={7} max={14} step={0.5} unit="pt" onChange={(value) => update("codeFontSize", value)} />
      </details>

      <details className="settings-group">
        <summary>ページ余白</summary>
        <RangeSetting label="上" value={settings.marginTop} min={8} max={30} step={1} unit="mm" onChange={(value) => update("marginTop", value)} />
        <RangeSetting label="右" value={settings.marginRight} min={8} max={30} step={1} unit="mm" onChange={(value) => update("marginRight", value)} />
        <RangeSetting label="下" value={settings.marginBottom} min={8} max={30} step={1} unit="mm" onChange={(value) => update("marginBottom", value)} />
        <RangeSetting label="左" value={settings.marginLeft} min={8} max={30} step={1} unit="mm" onChange={(value) => update("marginLeft", value)} />
      </details>

      <details className="settings-group">
        <summary>表紙・ヘッダー・フッター</summary>
        {toggle("includeCover", "表紙", "教材の先頭へ表紙を追加")}
        {toggle("showHeader", "ヘッダー", "科目・難易度・講番号を表示")}
        {toggle("showFooter", "フッター", "著作権・ページ番号・教材名を表示")}
        <label>ページ番号の位置
          <select value={settings.pageNumberPosition} onChange={(event) => update("pageNumberPosition", event.target.value as StudioSettings["pageNumberPosition"])}>
            <option value="left">左</option><option value="center">中央</option><option value="right">右</option>
          </select>
        </label>
        <label>著作権表記
          <input type="text" value={settings.copyright} onChange={(event) => update("copyright", event.target.value.slice(0, 120))} />
        </label>
      </details>

      <details className="settings-group">
        <summary>教材ボックス</summary>
        {toggle("showExampleBox", "例題ボックス", "OFFでも例題本文は残します")}
        {toggle("showExerciseBox", "演習ボックス", "OFFでも問題本文は残します")}
        {toggle("showSolutionBox", "解答ボックス", "OFFでも解答本文は残します")}
        {toggle("showNoticeBox", "注意・要点ボックス", "OFFでも内容は残します")}
      </details>

      <div className="setting-toggle">
        <span><strong>寛容モード</strong><small>局所エラーを代替表示して出力継続</small></span>
        <button aria-pressed={settings.tolerant} className={`switch ${settings.tolerant ? "is-on" : ""}`} onClick={() => update("tolerant", !settings.tolerant)} type="button"><span /></button>
      </div>
      <div className="settings-actions-grid">
        <button className="secondary-action" onClick={exportThemeJson} type="button"><Download size={15} />設定JSONを保存</button>
        <button className="secondary-action" onClick={openThemeJson} type="button"><FolderOpen size={15} />設定JSONを読込</button>
      </div>
      <button className="secondary-action" onClick={() => setSettings(DEFAULT_SETTINGS)} type="button"><RotateCcw size={15} />初期設定へ戻す</button>
      <button className="danger-action" onClick={clearAutosave} type="button">自動保存データを削除</button>
    </div>
  );
}

function BatchWorkspace({
  jobs,
  running,
  progress,
  outputMode,
  setOutputMode,
  includeQuestionInAnswer,
  setIncludeQuestionInAnswer,
  settings,
  setSettings,
  snapshot,
  expandedJob,
  setExpandedJob,
  zipReady,
  onChooseFiles,
  onDropFiles,
  onRemoveJob,
  onClear,
  onStart,
  onStop,
  onRetryFailed,
  onDownloadZip,
}: {
  jobs: BatchJob[];
  running: boolean;
  progress: { completed: number; total: number; currentIndex: number | null };
  outputMode: OutputMode;
  setOutputMode: React.Dispatch<React.SetStateAction<OutputMode>>;
  includeQuestionInAnswer: boolean;
  setIncludeQuestionInAnswer: React.Dispatch<React.SetStateAction<boolean>>;
  settings: StudioSettings;
  setSettings: React.Dispatch<React.SetStateAction<StudioSettings>>;
  snapshot: BatchOptions | null;
  expandedJob: string | null;
  setExpandedJob: React.Dispatch<React.SetStateAction<string | null>>;
  zipReady: boolean;
  onChooseFiles: () => void;
  onDropFiles: (files: FileList) => void;
  onRemoveJob: (id: string) => void;
  onClear: () => void;
  onStart: () => void;
  onStop: () => void;
  onRetryFailed: () => void;
  onDownloadZip: () => void;
}) {
  const percent = progress.total ? Math.round((progress.completed / progress.total) * 100) : 0;
  const failedCount = jobs.filter((job) => job.status === "failed").length;
  const completedCount = jobs.filter((job) => job.status === "success" || job.status === "warning" || job.status === "failed").length;
  const activeOptions = snapshot ?? { outputMode, includeQuestionInAnswer, settings };

  return (
    <section className="batch-workspace">
      <div className="batch-heading">
        <span>
          <small>完全逐次処理</small>
          <h2>Markdown教材をまとめてPDFへ</h2>
          <p>教材ごとに描画・PDF生成・後片付けを完了してから、次の教材へ進みます。</p>
        </span>
        <div className="batch-safety-badge"><ShieldCheck size={18} /><span>同時変換なし<strong>最大20教材</strong></span></div>
      </div>

      <div className="batch-grid">
        <div className="batch-main-column">
          <div
            className={`batch-dropzone ${jobs.length ? "has-files" : ""}`}
            onDragEnter={(event) => event.preventDefault()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (!running && event.dataTransfer.files.length) onDropFiles(event.dataTransfer.files);
            }}
          >
            <UploadCloud size={jobs.length ? 24 : 36} />
            <span><strong>.mdファイルをドロップ</strong><small>またはファイルを選択（20件まで）</small></span>
            <button disabled={running} onClick={onChooseFiles} type="button"><Files size={16} />ファイルを選択</button>
          </div>

          {jobs.length ? <div className="batch-queue-card">
            <div className="batch-card-title">
              <span><strong>変換キュー</strong><small>{jobs.length}教材・選択順に処理</small></span>
              <button className="batch-text-button" disabled={running} onClick={onClear} type="button"><Trash2 size={14} />すべて外す</button>
            </div>

            {running || completedCount ? <div className="batch-progress-block" aria-live="polite">
              <div><strong>{progress.completed} / {progress.total || jobs.length}</strong><span>{running ? "処理中" : "処理完了"}</span><em>{percent}%</em></div>
              <div className="batch-progress-track"><span style={{ width: `${percent}%` }} /></div>
            </div> : null}

            <div className="batch-job-list">
              {jobs.map((job, index) => {
                const detailsOpen = expandedJob === job.id;
                const hasDetails = Boolean(job.warnings.length || job.errors.length || job.outputFiles.length);
                return <article className={`batch-job batch-job-${job.status}`} key={job.id}>
                  <button
                    aria-label={`${job.fileName}の詳細`}
                    className="batch-job-main"
                    disabled={!hasDetails}
                    onClick={() => setExpandedJob(detailsOpen ? null : job.id)}
                    type="button"
                  >
                    <span className="batch-job-index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="batch-job-status" aria-hidden="true">{BATCH_STATUS_ICONS[job.status]}</span>
                    <span className="batch-job-name"><strong>{job.fileName}</strong><small>{BATCH_STATUS_LABELS[job.status]}{job.pageCount ? `・${job.pageCount}ページ` : ""}</small></span>
                    {hasDetails ? <ChevronDown className={detailsOpen ? "is-open" : ""} size={16} /> : null}
                  </button>
                  {!running && job.status === "waiting" ? <button aria-label={`${job.fileName}を外す`} className="batch-remove-job" onClick={() => onRemoveJob(job.id)} type="button"><X size={14} /></button> : null}
                  {detailsOpen ? <div className="batch-job-details">
                    {job.outputFiles.length ? <p><CheckCircle2 size={14} /><span>生成PDF：{job.outputFiles.join("、")}</span></p> : null}
                    {job.warnings.map((warning, warningIndex) => <p className="warning" key={`w-${warningIndex}`}><TriangleAlert size={14} /><span>{warning.line ? `${warning.line}行目：` : ""}{warning.title}<small>{warning.detail}</small></span></p>)}
                    {job.errors.map((error, errorIndex) => <p className="error" key={`e-${errorIndex}`}><AlertCircle size={14} /><span>{error.line ? `${error.line}行目：` : ""}{error.title}<small>{error.detail}</small></span></p>)}
                  </div> : null}
                </article>;
              })}
            </div>
          </div> : null}
        </div>

        <aside className="batch-settings-card">
          <div className="batch-card-title"><span><strong>一括設定</strong><small>{running ? "処理終了まで固定" : "全教材へ共通で適用"}</small></span><Settings size={17} /></div>
          <label>出力内容
            <select disabled={running} onChange={(event) => setOutputMode(event.target.value as OutputMode)} value={activeOptions.outputMode}>
              {(Object.keys(OUTPUT_MODE_LABELS) as OutputMode[]).map((mode) => <option key={mode} value={mode}>{OUTPUT_MODE_LABELS[mode]}</option>)}
            </select>
          </label>
          <label>テーマ
            <select disabled={running} onChange={(event) => setSettings((current) => applyThemePreset(current, event.target.value as ThemePreset))} value={activeOptions.settings.themePreset}>
              {(Object.keys(THEME_PRESET_LABELS) as ThemePreset[]).map((preset) => <option key={preset} value={preset}>{THEME_PRESET_LABELS[preset]}</option>)}
            </select>
          </label>
          <label>デザイン
            <select disabled={running} onChange={(event) => setSettings((current) => applyDesignTheme(current, event.target.value as DesignTheme))} value={activeOptions.settings.designTheme}>
              {(Object.keys(DESIGN_THEME_LABELS) as DesignTheme[]).map((theme) => <option key={theme} value={theme}>{DESIGN_THEME_LABELS[theme]}</option>)}
            </select>
          </label>
          {designThemeSupportsColor(activeOptions.settings.designTheme) ? (
            <AcademicColorPicker
              disabled={running}
              onChange={(academicColor) => setSettings((current) => ({ ...current, academicColor }))}
              value={activeOptions.settings.academicColor}
            />
          ) : null}
          <div className="setting-toggle batch-setting-toggle">
            <span><strong>解答に問題文を再掲</strong><small>解答編へ問題文を付けます</small></span>
            <button aria-pressed={activeOptions.includeQuestionInAnswer} className={`switch ${activeOptions.includeQuestionInAnswer ? "is-on" : ""}`} disabled={running} onClick={() => setIncludeQuestionInAnswer((current) => !current)} type="button"><span /></button>
          </div>
          <div className="batch-run-actions">
            {!running ? <button className="batch-start-button" disabled={!jobs.length} onClick={onStart} type="button"><Archive size={17} />一括変換を開始</button> : <button className="batch-stop-button" onClick={onStop} type="button"><Square size={15} />現在の教材後に停止</button>}
            {failedCount && !running ? <button className="secondary-action" onClick={onRetryFailed} type="button"><RefreshCw size={15} />失敗した{failedCount}件だけ再実行</button> : null}
            {zipReady && !running ? <button className="secondary-action" onClick={onDownloadZip} type="button"><FileDown size={15} />ZIPをもう一度保存</button> : null}
          </div>
          <div className="batch-flow-note">
            <span>1</span>解析・描画
            <i />
            <span>2</span>PDF生成
            <i />
            <span>3</span>完全破棄
          </div>
          <p className="batch-lock-note">途中で失敗しても、残りの教材はそのまま続行します。</p>
        </aside>
      </div>
    </section>
  );
}

export default function Home() {
  const [studioMode, setStudioMode] = useState<StudioMode>("single");
  const [pdfEngine, setPdfEngine] = useState<PdfEngine>("legacy");
  const [typstTheme, setTypstTheme] = useState<TypstThemeId>("standard-blue");
  const [typstPreview, setTypstPreview] = useState<TypstPdfPreview | null>(null);
  const [typstError, setTypstError] = useState<TypstCompileErrorPayload | null>(null);
  const [typstCompilerStatus, setTypstCompilerStatus] = useState<TypstCompilerStatus>({
    checked: false,
    available: false,
    version: "",
    message: "Typst Compiler Serviceを確認していません。",
  });
  const [source, setSource] = useState<string>(SAMPLES.math.source);
  const [previewSource, setPreviewSource] = useState<string>(SAMPLES.math.source);
  const [settings, setSettings] = useState<StudioSettings>(DEFAULT_SETTINGS);
  const [outputMode, setOutputMode] = useState<OutputMode>("complete");
  const [includeQuestionInAnswer, setIncludeQuestionInAnswer] = useState(true);
  const [pdfExportQueue, setPdfExportQueue] = useState<BatchEditionMode[]>([]);
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ completed: 0, total: 0, currentIndex: null as number | null });
  const [batchRenderRequest, setBatchRenderRequest] = useState<BatchRenderRequest | null>(null);
  const [batchExpandedJob, setBatchExpandedJob] = useState<string | null>(null);
  const [batchZipReady, setBatchZipReady] = useState(false);
  const [batchSettingsSnapshot, setBatchSettingsSnapshot] = useState<BatchOptions | null>(null);
  const [saved, setSaved] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(50);
  const [debugPagination, setDebugPagination] = useState(false);
  const [processing, setProcessing] = useState<ProcessingState>("idle");
  const [rightTab, setRightTab] = useState<RightTab>("issues");
  const [mobileTab, setMobileTab] = useState<MobileTab>("editor");
  const [sampleOpen, setSampleOpen] = useState(false);
  const [insertOpen, setInsertOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [postIssues, setPostIssues] = useState<Issue[]>([]);
  const [toast, setToast] = useState("");
  const [cursor, setCursor] = useState({ line: 1, column: 1 });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [selectedQuickFix, setSelectedQuickFix] = useState<QuickFix | null>(null);
  const [quickFixHistory, setQuickFixHistory] = useState<Array<{ id: string; line: number; title: string; appliedAt: string }>>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const printPagesRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const themeSettingsInputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<string[]>([]);
  const redoRef = useRef<string[]>([]);
  const processingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pdfExportActiveRef = useRef(false);
  const batchStopRequestedRef = useRef(false);
  const batchGeneratedFilesRef = useRef<GeneratedPdfFile[]>([]);
  const batchRenderResolverRef = useRef<{
    resolve: (result: BatchRenderResult) => void;
    reject: (error: Error) => void;
  } | null>(null);

  const sourceQuickFixes = useMemo(() => collectQuickFixes(source), [source]);
  const quickFixByIssue = useMemo(() => new Map(sourceQuickFixes.map((fix) => [fix.issueId, fix])), [sourceQuickFixes]);
  const exerciseIds = useMemo(() => listExerciseIds(source), [source]);
  const [solutionId, setSolutionId] = useState("");
  const selectedSolutionId = solutionId && exerciseIds.includes(solutionId) ? solutionId : exerciseIds[0] || "q001";
  const activeOutputMode: OutputMode = pdfExportQueue[0] ?? outputMode;
  const layout = useMaterialLayout(
    previewSource,
    activeOutputMode,
    includeQuestionInAnswer,
    settings,
    pdfEngine === "legacy",
  );
  const {
    layoutKey,
    measuredPagination,
    measurementBlocks,
    measurementRef,
    pages,
    pagination,
    parsed,
    renderDocument,
  } = layout;
  const issues = useMemo(() => [...parsed.issues, ...postIssues], [parsed.issues, postIssues]);
  const errorCount = issues.filter((issue) => issue.severity === "error").length;
  const warningCount = issues.filter((issue) => issue.severity === "warning").length;
  const flattenedRenderBlocks = useMemo(() => flattenStudioBlocks(renderDocument.blocks), [renderDocument.blocks]);
  const mathCount = flattenedRenderBlocks.filter((block) => block.type === "math").length;
  const figureCount = flattenedRenderBlocks.filter((block) => block.type === "figure").length;
  const fallbackCount = flattenedRenderBlocks.filter((block) => block.renderStatus === "fallback").length;
  const orphanHeadingCount = postIssues.filter((issue) =>
    issue.blockType === "orphan-heading" ||
    issue.blockType === "orphan-problem-title" ||
    issue.blockType === "orphan-box-title"
  ).length;
  const tinyFragmentCount = postIssues.filter((issue) =>
    issue.blockType === "tiny-text-fragment" || issue.blockType === "widow-line"
  ).length;
  const qaStatus = errorCount ? "不合格" : warningCount ? "警告付き合格" : "合格";
  const visiblePageIndex = Math.max(0, Math.min(currentPage, pages.length - 1));
  const typstPreviewMode: BatchEditionMode = outputMode === "split" ? "questions" : outputMode;
  const currentTypstKey = typstPreviewKey(source, typstPreviewMode, includeQuestionInAnswer, settings, typstTheme);
  const typstPreviewIsCurrent = typstPreview?.key === currentTypstKey;
  const typstBusy = pdfEngine === "typst" && processing !== "idle" && processing !== "complete";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebugPagination(new URLSearchParams(window.location.search).get("paginationDebug") === "1");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (pdfEngine !== "typst") return;
    let active = true;
    void getTypstStatus().then((status) => {
      if (!active) return;
      setTypstCompilerStatus({ checked: true, ...status });
    }).catch((error) => {
      if (!active) return;
      setTypstCompilerStatus({
        checked: true,
        available: false,
        version: "",
        message: error instanceof Error ? error.message : "Typst Compiler Serviceを確認できません。",
      });
    });
    return () => { active = false; };
  }, [pdfEngine]);

  useEffect(() => () => {
    if (typstPreview?.url) URL.revokeObjectURL(typstPreview.url);
  }, [typstPreview?.url]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem("markdown-studio-autosave");
        const storedSettings = localStorage.getItem("markdown-studio-settings");
        const storedOutput = localStorage.getItem("markdown-studio-output");
        if (stored) {
          setSource(stored);
          setPreviewSource(stored);
          setSaved(true);
        }
        if (storedSettings) {
          const normalized = normalizeThemeSettings(JSON.parse(storedSettings));
          setSettings(normalized.settings);
          if (normalized.warnings.length) setToast(`保存設定を補正しました（${normalized.warnings.length}件）`);
        }
        if (storedOutput) {
          const output = JSON.parse(storedOutput) as {
            mode?: OutputMode;
            includeQuestionInAnswer?: boolean;
            pdfEngine?: PdfEngine;
            typstTheme?: TypstThemeId;
          };
          if (output.mode && output.mode in OUTPUT_MODE_LABELS) setOutputMode(output.mode);
          if (typeof output.includeQuestionInAnswer === "boolean") {
            setIncludeQuestionInAnswer(output.includeQuestionInAnswer);
          }
          if (output.pdfEngine === "legacy" || output.pdfEngine === "typst") setPdfEngine(output.pdfEngine);
          if (output.typstTheme && output.typstTheme in TYPST_THEME_LABELS) setTypstTheme(output.typstTheme);
        }
      } catch {}
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem("markdown-studio-autosave", source);
        localStorage.setItem("markdown-studio-settings", JSON.stringify(settings));
        setSaved(true);
      } catch {}
    }, 650);
    return () => window.clearTimeout(timer);
  }, [source, settings]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "markdown-studio-output",
        JSON.stringify({ mode: outputMode, includeQuestionInAnswer, pdfEngine, typstTheme }),
      );
    } catch {}
    const timer = window.setTimeout(() => {
      setCurrentPage(0);
      setPostIssues([]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [includeQuestionInAnswer, outputMode, pdfEngine, typstTheme]);

  useEffect(() => {
    if (!settings.autoUpdate) return;
    const timer = window.setTimeout(() => {
      setProcessing("parsing");
      setPreviewSource(source);
      window.setTimeout(() => setProcessing("idle"), 380);
    }, 520);
    return () => window.clearTimeout(timer);
  }, [source, settings.autoUpdate]);

  useLayoutEffect(() => {
    if (pdfEngine !== "legacy") return;
    const pageDom = printPagesRef.current;
    if (!pageDom) return;
    setProcessing("measuring");
    let disposed = false;
    void (async () => {
      await waitForStableLayout(pageDom);
      if (disposed) return;
      const measured = Array.from(pageDom.querySelectorAll<HTMLElement>("[data-measure='block']"));
      const found: Issue[] = [];
      for (const element of measured) {
        if (element.scrollWidth > element.clientWidth + 2) {
          const page = Number(element.closest<HTMLElement>(".paper")?.dataset.pageNumber ?? 1);
          found.push({
            id: `dom-overflow-${page}-${element.dataset.blockId}`,
            severity: "warning",
            line: Number(element.dataset.sourceLine ?? 1),
            blockType: "overflow",
            title: "横方向のオーバーフローを検出しました",
            reason: `実幅 ${element.scrollWidth}px / 有効幅 ${element.clientWidth}px`,
            fix: "長い式・URL・表を分割してください。PDFでは代替表示候補になります。",
            page,
            history: ["DOM実寸検査", "折返しを適用", "再計測"],
          });
        }
      }
      for (const overflow of inspectPageOverflow(pageDom)) {
        found.push({
          id: `page-overflow-${overflow.page}-${overflow.nodeId}`,
          severity: "error",
          line: Number(pageDom.querySelector<HTMLElement>(`[data-block-id="${CSS.escape(overflow.nodeId)}"]`)?.dataset.sourceLine ?? 1),
          blockType: overflow.nodeType,
          title: `${overflow.page}ページ目で本文領域を超えています`,
          reason: `${overflow.overflowPx.toFixed(1)}px超過。${overflow.reason}`,
          fix: "自動再分割で解消しない要素です。該当ノードの入力または表示倍率を確認してください。",
          page: overflow.page,
          history: ["Page DOM再計測", "自動再分割", "最終Overflow検査"],
        });
      }
      for (const anomaly of inspectPaginationAnomalies(pageDom)) {
        found.push({
          id: `${anomaly.kind}-${anomaly.page}-${anomaly.nodeId}`,
          severity: anomaly.severity,
          line: anomaly.line,
          blockType: anomaly.kind,
          title: paginationAnomalyTitle(anomaly.kind),
          reason: anomaly.reason,
          fix: "前後の要素を再計測し、同じページへまとめてください。",
          page: anomaly.page,
          history: ["Page DOM行境界検査", "孤立判定"],
        });
      }
      setPostIssues((current) => {
        const previous = current.map((issue) => issue.id).join("|");
        const next = found.map((issue) => issue.id).join("|");
        return previous === next ? current : found;
      });
      setProcessing("idle");
    })();
    return () => { disposed = true; };
  }, [activeOutputMode, includeQuestionInAnswer, layoutKey, measuredPagination?.key, pdfEngine, previewSource, settings]);

  useEffect(() => {
    if (pdfEngine !== "legacy") return;
    const mode = pdfExportQueue[0];
    const container = printPagesRef.current;
    if (!mode || !container || measuredPagination?.key !== layoutKey || pdfExportActiveRef.current) return;
    pdfExportActiveRef.current = true;
    setProcessing("pdf");

    const createPdf = async () => {
      try {
        await waitForRenderedContent(container);
        const generated = await generateMaterialPdf(container);
        const fileName = sanitizeFilename(parsed.metadata, "pdf", editionForMode(mode));
        downloadGeneratedBlob(generated.blob, fileName);
        setPdfExportQueue((current) => current.slice(1));
        showToast(`${fileName}を保存しました（${generated.pageCount}ページ）`);
      } catch (error) {
        setPdfExportQueue([]);
        window.alert(`PDFを生成できませんでした。\n\n${error instanceof Error ? error.message : String(error)}`);
      } finally {
        pdfExportActiveRef.current = false;
        setProcessing("idle");
      }
    };
    void createPdf();
  }, [layoutKey, measuredPagination?.key, parsed.metadata, pdfEngine, pdfExportQueue]);

  const pulseProcessing = (state: ProcessingState, callback?: () => void) => {
    if (processingTimer.current) window.clearTimeout(processingTimer.current);
    setProcessing(state);
    processingTimer.current = setTimeout(() => {
      callback?.();
      setProcessing("idle");
    }, 420);
  };

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  const updateSource = (value: string) => {
    if (value === source) return;
    historyRef.current = [...historyRef.current.slice(-79), source];
    redoRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
    setSource(value);
    setSaved(false);
  };

  const undo = () => {
    const previous = historyRef.current.pop();
    if (previous === undefined) return;
    redoRef.current.push(source);
    setSource(previous);
    setSaved(false);
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
  };

  const redo = () => {
    const next = redoRef.current.pop();
    if (next === undefined) return;
    historyRef.current.push(source);
    setSource(next);
    setSaved(false);
    setCanUndo(true);
    setCanRedo(redoRef.current.length > 0);
  };

  const replaceEditorRange = (start: number, end: number, replacement: string, cursorOffset = replacement.length) => {
    updateSource(`${source.slice(0, start)}${replacement}${source.slice(end)}`);
    window.setTimeout(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const nextPosition = start + cursorOffset;
      textarea.focus();
      textarea.setSelectionRange(nextPosition, nextPosition);
      updateCursor(textarea);
    }, 0);
  };

  const insertBlock = (key: InsertTemplateKey) => {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? source.length;
    const end = textarea?.selectionEnd ?? start;
    const selected = source.slice(start, end);
    const rawSnippet = insertTemplate(key, source, selected, selectedSolutionId);
    const tokenIndex = rawSnippet.indexOf(CURSOR_TOKEN);
    const snippet = rawSnippet.replace(CURSOR_TOKEN, "");
    const leading = start > 0 && source[start - 1] !== "\n" ? "\n\n" : start > 1 && source[start - 2] !== "\n" ? "\n" : "";
    const trailing = end < source.length && source[end] !== "\n" ? "\n\n" : end < source.length - 1 && source[end + 1] !== "\n" ? "\n" : "";
    replaceEditorRange(start, end, `${leading}${snippet}${trailing}`, leading.length + (tokenIndex >= 0 ? tokenIndex : snippet.length));
    setInsertOpen(false);
    showToast(`${INSERT_TEMPLATE_LABELS.find(([id]) => id === key)?.[1]}を挿入しました`);
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo(); else undo();
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
      event.preventDefault();
      setSearchOpen(true);
      return;
    }
    if (event.key === "Tab") {
      event.preventDefault();
      replaceEditorRange(start, end, "  ", 2);
      return;
    }
    if (event.key === "Enter" && start === end) {
      const lineStart = source.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
      const currentLine = source.slice(lineStart, start).trim();
      let closer = "";
      if (/^:::[\w-]+(?:\s.*)?$/u.test(currentLine) && currentLine !== ":::page-break") closer = ":::";
      else if (/^```[^`]*$/u.test(currentLine)) closer = "```";
      else if (currentLine === "$$") closer = "$$";
      else if (currentLine === "\\[") closer = "\\]";
      if (closer) {
        event.preventDefault();
        replaceEditorRange(start, end, `\n\n${closer}`, 1);
        return;
      }
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}", "\"": "\"", "$": "$" };
    const closingKeys = new Set(Object.values(pairs));
    if (closingKeys.has(event.key) && source[start] === event.key && start === end) {
      event.preventDefault();
      window.setTimeout(() => {
        target.setSelectionRange(start + 1, start + 1);
        updateCursor(target);
      }, 0);
      return;
    }
    const closing = pairs[event.key];
    if (!closing) return;
    event.preventDefault();
    const selected = source.slice(start, end);
    replaceEditorRange(start, end, `${event.key}${selected}${closing}`, selected ? selected.length + 2 : 1);
  };

  const confirmQuickFix = () => {
    if (!selectedQuickFix) return;
    const next = applyQuickFix(source, selectedQuickFix);
    if (next === source) {
      setSelectedQuickFix(null);
      showToast("入力が変わったため修正を適用できませんでした");
      return;
    }
    updateSource(next);
    setPreviewSource(next);
    setQuickFixHistory((current) => [...current, { id: selectedQuickFix.id, line: selectedQuickFix.line, title: selectedQuickFix.title, appliedAt: new Date().toISOString() }]);
    setSelectedQuickFix(null);
    showToast("修正を適用しました。元に戻すこともできます");
  };

  const handleUnknownChoice = (choice: "keep" | "candidates" | "edit", issue: Issue) => {
    if (choice === "keep") {
      showToast("未知の記法を削除せず、汎用表示を維持します");
      return;
    }
    if (choice === "edit") {
      goToLine(issue.line);
      return;
    }
    const candidates = issue.id.startsWith("unknown-block-") ? suggestKnownBlockNames(issue.blockType).join("、") : "title、id、for";
    showToast(`候補：${candidates}（自動変更はしません）`);
  };

  const goToLine = useCallback((line: number) => {
    const textarea = document.querySelector<HTMLTextAreaElement>("#studio-markdown-editor");
    if (!textarea) return;
    const lines = source.split("\n");
    const start = lines.slice(0, Math.max(0, line - 1)).reduce((sum, value) => sum + value.length + 1, 0);
    const end = start + (lines[line - 1]?.length ?? 0);
    textarea.focus();
    textarea.setSelectionRange(start, end);
    const ratio = Math.max(0, line - 2) / Math.max(1, lines.length);
    textarea.scrollTop = ratio * textarea.scrollHeight;
    const numbers = document.querySelector<HTMLDivElement>("#studio-line-numbers");
    if (numbers) numbers.scrollTop = textarea.scrollTop;
    setCursor({ line, column: 1 });
    setMobileTab("editor");
  }, [source]);

  const updateCursor = (textarea: HTMLTextAreaElement) => {
    const position = textarea.selectionStart;
    const before = source.slice(0, position);
    const line = before.split("\n").length;
    const column = position - before.lastIndexOf("\n");
    setCursor({ line, column });
  };

  const findNext = () => {
    if (!searchTerm || !textareaRef.current) return;
    const startAt = textareaRef.current.selectionEnd;
    let index = source.indexOf(searchTerm, startAt);
    if (index === -1) index = source.indexOf(searchTerm);
    if (index >= 0) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(index, index + searchTerm.length);
    } else showToast("一致する文字列がありません");
  };

  const replaceOne = () => {
    const textarea = textareaRef.current;
    if (!textarea || !searchTerm) return;
    const selected = source.slice(textarea.selectionStart, textarea.selectionEnd);
    if (selected !== searchTerm) {
      findNext();
      return;
    }
    const next = `${source.slice(0, textarea.selectionStart)}${replaceTerm}${source.slice(textarea.selectionEnd)}`;
    updateSource(next);
    window.setTimeout(findNext, 0);
  };

  const replaceAll = () => {
    if (!searchTerm) return;
    const count = source.split(searchTerm).length - 1;
    updateSource(source.split(searchTerm).join(replaceTerm));
    showToast(`${count}件を置換しました`);
  };

  const openFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    if (file.type.startsWith("image/")) {
      reader.onload = () => {
        const snippet = `\n\n![${file.name}](${String(reader.result)})\n`;
        const textarea = textareaRef.current;
        const position = textarea?.selectionStart ?? source.length;
        updateSource(`${source.slice(0, position)}${snippet}${source.slice(position)}`);
        showToast("ローカル画像をMarkdownへ挿入しました");
      };
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => {
        updateSource(String(reader.result ?? ""));
        setPreviewSource(String(reader.result ?? ""));
        setCurrentPage(0);
        showToast(`${file.name}を読み込みました`);
      };
      reader.readAsText(file, "utf-8");
    }
    event.target.value = "";
  };

  const loadSample = (key: keyof typeof SAMPLES) => {
    updateSource(SAMPLES[key].source);
    setPreviewSource(SAMPLES[key].source);
    setCurrentPage(0);
    setSampleOpen(false);
    showToast(`${SAMPLES[key].label}を読み込みました`);
  };

  const saveMarkdown = () => {
    downloadBlob(source, "text/markdown;charset=utf-8", sanitizeFilename(parsed.metadata, "md"));
    setSaved(true);
    showToast("Markdownを保存しました");
  };

  const exportThemeJson = () => {
    downloadBlob(
      serializeThemeSettings(settings),
      "application/json;charset=utf-8",
      `markdown-studio-theme-${settings.designTheme}-${designThemeSupportsColor(settings.designTheme) ? settings.academicColor : settings.themePreset}.json`,
    );
    showToast("テーマ設定JSONを保存しました");
  };

  const importThemeJson = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const normalized = normalizeThemeSettings(JSON.parse(String(reader.result ?? "")));
        setSettings(normalized.settings);
        setCurrentPage(0);
        setPostIssues([]);
        showToast(normalized.warnings.length ? `設定を補正して読み込みました（${normalized.warnings.length}件）` : "テーマ設定を読み込みました");
        if (normalized.warnings.length) window.alert(`読み込めなかった設定があります。\n\n- ${normalized.warnings.join("\n- ")}`);
      } catch {
        window.alert("設定JSONを読み込めませんでした。JSONの形式を確認してください。");
      }
      event.target.value = "";
    };
    reader.readAsText(file, "utf-8");
  };

  const exportHtml = () => {
    const styles = Array.from(document.styleSheets)
      .map((sheet) => {
        try { return Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n"); }
        catch { return ""; }
      })
      .join("\n");
    const pagesHtml = previewRef.current?.innerHTML ?? "";
    const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>${parsed.metadata.title}</title><style>${styles}</style></head><body><main class="exported-pages">${pagesHtml}</main></body></html>`;
    downloadBlob(
      html,
      "text/html;charset=utf-8",
      sanitizeFilename(parsed.metadata, "html", editionForMode(activeOutputMode)),
    );
    showToast("同一レイアウトのHTMLを保存しました");
  };

  const exportQa = () => {
    const report = {
      lesson_id: parsed.metadata.lesson_id,
      title: parsed.metadata.title,
      output_mode: activeOutputMode,
      output_mode_label: OUTPUT_MODE_LABELS[outputMode],
      include_question_in_answer: includeQuestionInAnswer,
      theme_preset: settings.themePreset,
      theme_preset_label: THEME_PRESET_LABELS[settings.themePreset],
      design_theme: settings.designTheme,
      design_theme_label: DESIGN_THEME_LABELS[settings.designTheme],
      academic_color: designThemeSupportsColor(settings.designTheme) ? settings.academicColor : null,
      theme_settings: settings,
      status: errorCount ? "failed" : warningCount ? "warning" : "passed",
      pages: pdfEngine === "typst" ? typstPreview?.pageCount ?? 0 : pages.length,
      pdf_engine: pdfEngine,
      typst_theme: pdfEngine === "typst" ? typstTheme : null,
      errors: errorCount,
      warnings: warningCount,
      math_blocks: mathCount,
      figures: figureCount,
      source_exercise_count: parsed.blocks.filter((block) => block.blockName === "exercise").length,
      source_solution_count: parsed.blocks.filter((block) => block.blockName === "solution").length,
      rendered_exercise_count: flattenedRenderBlocks.filter((block) =>
        block.blockName === "exercise" || block.blockName === "answer-question"
      ).length,
      rendered_solution_count: flattenedRenderBlocks.filter((block) => block.blockName === "solution").length,
      overflow_count: postIssues.length,
      split_block_count: pagination.splitIds.size,
      scaled_math_count: issues.filter((issue) => issue.id.startsWith("long-math")).length,
      scaled_figure_count: 0,
      fallback_render_count: fallbackCount,
      blank_page_count: pages.filter((page) => !page.blocks.length).length,
      orphan_heading_count: 0,
      quick_fix_count: quickFixHistory.length,
      quick_fix_history: quickFixHistory,
      issues,
      generated_at: new Date().toISOString(),
    };
    downloadBlob(
      JSON.stringify(report, null, 2),
      "application/json",
      sanitizeFilename(parsed.metadata, "json", editionForMode(activeOutputMode)),
    );
    showToast("QAレポートを保存しました");
  };

  const setTypstGenerationPhase = (phase: TypstGenerationPhase) => {
    const state: Record<TypstGenerationPhase, ProcessingState> = {
      markdown: "parsing",
      typst: "typst",
      pdf: "pdf",
      complete: "complete",
    };
    setProcessing(state[phase]);
    if (phase === "complete") {
      if (processingTimer.current) window.clearTimeout(processingTimer.current);
      processingTimer.current = setTimeout(() => setProcessing("idle"), 900);
    }
  };

  const compileTypstEdition = async (
    sourceMarkdown: string,
    mode: BatchEditionMode,
    nextSettings: StudioSettings,
    theme: TypstThemeId,
    updatePreview: boolean,
  ): Promise<GeneratedPdfFile> => {
    setTypstError(null);
    try {
      const result = await compileTypstPdf({
        markdown: sourceMarkdown,
        outputMode: mode,
        includeQuestionInAnswer,
        settings: nextSettings,
        theme,
      }, setTypstGenerationPhase);
      const metadata = parseDocument(sourceMarkdown).metadata;
      const fileName = sanitizeFilename(metadata, "pdf", editionForMode(mode));
      const key = typstPreviewKey(sourceMarkdown, mode, includeQuestionInAnswer, nextSettings, theme);
      if (updatePreview) {
        setPreviewSource(sourceMarkdown);
        setTypstPreview({
          blob: result.blob,
          fileName,
          key,
          outputMode: mode,
          pageCount: result.pageCount,
          textValidation: result.textValidation,
          typstVersion: result.typstVersion,
          url: URL.createObjectURL(result.blob),
        });
      }
      return { blob: result.blob, fileName, pageCount: result.pageCount };
    } catch (error) {
      const payload = error instanceof TypstClientError
        ? error.payload
        : {
            stage: "compiler" as const,
            code: "TYPST_PDF_FAILED",
            message: error instanceof Error ? error.message : String(error),
          };
      setTypstError(payload);
      setProcessing("idle");
      throw error;
    }
  };

  const generateTypstPreview = async () => {
    if (typstBusy) return;
    setMobileTab("preview");
    setCurrentPage(0);
    try {
      const generated = await compileTypstEdition(source, typstPreviewMode, settings, typstTheme, true);
      showToast(`PDFプレビューを更新しました（${generated.pageCount}ページ）`);
    } catch {}
  };

  const exportPdf = () => {
    if (pdfEngine === "typst") {
      if (typstBusy) return;
      if (!settings.tolerant && errorCount) {
        setRightTab("issues");
        setMobileTab("qa");
        showToast("厳格モードではエラーを解消してから出力してください");
        return;
      }
      const modes: BatchEditionMode[] = outputMode === "split" ? ["questions", "answers"] : [outputMode];
      void (async () => {
        try {
          for (const mode of modes) {
            const key = typstPreviewKey(source, mode, includeQuestionInAnswer, settings, typstTheme);
            const existing = typstPreview?.key === key ? typstPreview : null;
            const generated = existing
              ? { blob: existing.blob, fileName: existing.fileName, pageCount: existing.pageCount }
              : await compileTypstEdition(source, mode, settings, typstTheme, mode === typstPreviewMode);
            downloadGeneratedBlob(generated.blob, generated.fileName);
            showToast(`${generated.fileName}を保存しました（${generated.pageCount}ページ）`);
          }
        } catch {}
      })();
      return;
    }
    if (pdfExportQueue.length) return;
    if (!settings.tolerant && errorCount) {
      setRightTab("issues");
      setMobileTab("qa");
      showToast("厳格モードではエラーを解消してから出力してください");
      return;
    }
    setCurrentPage(0);
    setPdfExportQueue(outputMode === "split" ? ["questions", "answers"] : [outputMode]);
    showToast(outputMode === "split" ? "問題PDF→解答PDFの順に生成します" : "PDFを生成します");
  };

  const resolveBatchRender = useCallback((result: BatchRenderResult) => {
    const resolver = batchRenderResolverRef.current;
    if (!resolver) return;
    batchRenderResolverRef.current = null;
    setBatchRenderRequest(null);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolver.resolve(result)));
  }, []);

  const rejectBatchRender = useCallback((error: Error) => {
    const resolver = batchRenderResolverRef.current;
    if (!resolver) return;
    batchRenderResolverRef.current = null;
    setBatchRenderRequest(null);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolver.reject(error)));
  }, []);

  const renderBatchEdition = useCallback((request: BatchRenderRequest) => (
    new Promise<BatchRenderResult>((resolve, reject) => {
      if (batchRenderResolverRef.current) {
        reject(new Error("別の教材を処理中です。逐次キューが空くまで待ってください。"));
        return;
      }
      batchRenderResolverRef.current = { resolve, reject };
      setBatchRenderRequest(request);
    })
  ), []);

  const addBatchFiles = async (fileList: FileList | File[]) => {
    if (batchRunning) return;
    const markdownFiles = Array.from(fileList).filter((file) =>
      file.name.toLowerCase().endsWith(".md") || file.type === "text/markdown",
    );
    if (!markdownFiles.length) {
      showToast(".mdファイルを選択してください");
      return;
    }
    if (markdownFiles.length > 20) {
      window.alert("初期版では安全のため、先頭20教材だけを読み込みます。残りは次のバッチに分けてください。");
    }
    const inputs: Array<{ fileName: string; sourceMarkdown: string }> = [];
    for (const file of markdownFiles.slice(0, 20)) {
      inputs.push({ fileName: file.name, sourceMarkdown: await file.text() });
    }
    setBatchJobs(createBatchJobs(inputs));
    batchGeneratedFilesRef.current = [];
    setBatchZipReady(false);
    setBatchProgress({ completed: 0, total: inputs.length, currentIndex: null });
    showToast(`${inputs.length}教材を一括キューへ追加しました`);
  };

  const runBatch = async (target: "all" | "failed" = "all") => {
    if (batchRunning) return;
    const selected: BatchJob[] = (target === "failed"
      ? batchJobs.filter((job) => job.status === "failed")
      : batchJobs
    ).map((job) => ({
      ...job,
      status: "waiting" as const,
      startedAt: null,
      finishedAt: null,
      outputFiles: [],
      warnings: [],
      errors: [],
      qaReport: null,
      pageCount: 0,
    }));
    if (!selected.length) {
      showToast(target === "failed" ? "再実行する失敗教材がありません" : "Markdown教材を追加してください");
      return;
    }

    const options: BatchOptions = {
      outputMode,
      includeQuestionInAnswer,
      settings: { ...settings },
    };
    const baseJobs = target === "all" ? selected : batchJobs;
    const existingFiles = target === "all"
      ? []
      : batchGeneratedFilesRef.current.filter((file) =>
          !selected.some((job) => job.outputFiles.includes(file.fileName)),
        );
    batchGeneratedFilesRef.current = existingFiles;
    const usedNames = new Set(existingFiles.map((file) => file.fileName));
    batchStopRequestedRef.current = false;
    setBatchRunning(true);
    setBatchZipReady(false);
    setBatchSettingsSnapshot(options);
    setBatchProgress({ completed: 0, total: selected.length, currentIndex: null });

    const mergeJobs = (updates: BatchJob[]) => {
      if (target === "all") return updates;
      const byId = new Map(updates.map((job) => [job.id, job]));
      return baseJobs.map((job) => byId.get(job.id) ?? job);
    };

    try {
      const completedSubset = await runBatchSequentially(
        selected,
        async (job, jobIndex) => {
          const modes: BatchEditionMode[] = [...editionModesForOutput(options.outputMode)];
          const outputFiles: string[] = [];
          const warnings: BatchMessage[] = [];
          const errors: BatchMessage[] = [];
          const reports: Record<string, unknown>[] = [];
          const generatedFilesForJob: GeneratedPdfFile[] = [];
          let pageCount = 0;

          for (const mode of modes) {
            const result = pdfEngine === "typst"
              ? await (async (): Promise<BatchRenderResult> => {
                  const batchDocument = parseDocument(job.sourceMarkdown);
                  const parseErrors = batchDocument.issues
                    .filter((issue) => issue.severity === "error")
                    .map((issue) => ({ line: issue.line, title: issue.title, detail: issue.reason }));
                  const parseWarnings = batchDocument.issues
                    .filter((issue) => issue.severity !== "error")
                    .map((issue) => ({ line: issue.line, title: issue.title, detail: issue.reason }));
                  if (!options.settings.tolerant && parseErrors.length) {
                    throw new Error(`厳格モードのため、${parseErrors[0].line ?? 1}行目のエラーでPDF生成を中止しました。`);
                  }
                  const generatedFile = await compileTypstEdition(
                    job.sourceMarkdown,
                    mode,
                    options.settings,
                    typstTheme,
                    false,
                  );
                  return {
                    generatedFile,
                    warnings: parseWarnings,
                    errors: parseErrors,
                    qaReport: {
                      source_file: job.fileName,
                      lesson_id: batchDocument.metadata.lesson_id,
                      title: batchDocument.metadata.title,
                      output_mode: mode,
                      output_mode_label: OUTPUT_MODE_LABELS[mode],
                      pdf_engine: "typst",
                      typst_theme: typstTheme,
                      status: parseErrors.length || parseWarnings.length ? "warning" : "passed",
                      pages: generatedFile.pageCount,
                      errors: parseErrors,
                      warnings: parseWarnings,
                      generated_at: new Date().toISOString(),
                    },
                  };
                })()
              : await renderBatchEdition({
                  token: `${job.id}-${mode}-${Date.now().toString(36)}`,
                  jobId: job.id,
                  fileName: job.fileName,
                  sourceMarkdown: job.sourceMarkdown,
                  outputMode: mode,
                  includeQuestionInAnswer: options.includeQuestionInAnswer,
                  settings: options.settings,
                });
            const uniqueName = uniqueOutputFilename(result.generatedFile.fileName, usedNames);
            const generatedFile = { ...result.generatedFile, fileName: uniqueName };
            generatedFilesForJob.push(generatedFile);
            outputFiles.push(uniqueName);
            warnings.push(...result.warnings);
            errors.push(...result.errors);
            reports.push(result.qaReport);
            pageCount += result.generatedFile.pageCount;
          }
          batchGeneratedFilesRef.current.push(...generatedFilesForJob);

          return {
            status: warnings.length || errors.length ? "warning" : "success",
            outputFiles,
            warnings,
            errors,
            pageCount,
            qaReport: {
              source_file: job.fileName,
              output_mode: options.outputMode,
              pdf_engine: pdfEngine,
              typst_theme: pdfEngine === "typst" ? typstTheme : null,
              theme_preset: options.settings.themePreset,
              design_theme: options.settings.designTheme,
              academic_color: designThemeSupportsColor(options.settings.designTheme) ? options.settings.academicColor : null,
              editions: reports,
              processed_index: jobIndex + 1,
            },
          };
        },
        {
          shouldStop: () => batchStopRequestedRef.current,
          cleanupJob: async () => {
            setBatchRenderRequest(null);
            await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
            document.querySelectorAll(".pdf-capture-host").forEach((element) => element.remove());
          },
          onJobsChange: (jobs, progress) => {
            setBatchJobs(mergeJobs(jobs));
            setBatchProgress(progress);
          },
        },
      );
      const allJobs = mergeJobs(completedSubset);
      setBatchJobs(allJobs);
      const successfulFiles = batchGeneratedFilesRef.current;
      const report = createBatchResultReport(allJobs);
      const zip = await createBatchZip(
        successfulFiles,
        JSON.stringify(report, null, 2),
        formatBatchResultText(report),
      );
      downloadGeneratedBlob(zip, batchZipFilename());
      setBatchZipReady(true);
      showToast(successfulFiles.length
        ? `一括処理完了：${successfulFiles.length}PDFをZIPへまとめました`
        : "PDF生成は0件です。失敗内容を結果レポートへまとめました");
    } catch (error) {
      window.alert(`一括処理の結果をまとめられませんでした。\n\n${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBatchRenderRequest(null);
      batchRenderResolverRef.current = null;
      setBatchRunning(false);
      setBatchSettingsSnapshot(null);
    }
  };

  const downloadBatchZip = async () => {
    if (!batchJobs.length) return;
    const report = createBatchResultReport(batchJobs);
    const zip = await createBatchZip(
      batchGeneratedFilesRef.current,
      JSON.stringify(report, null, 2),
      formatBatchResultText(report),
    );
    downloadGeneratedBlob(zip, batchZipFilename());
    showToast("一括PDFのZIPを保存しました");
  };

  const clearBatch = () => {
    if (batchRunning) return;
    batchGeneratedFilesRef.current = [];
    setBatchJobs([]);
    setBatchZipReady(false);
    setBatchProgress({ completed: 0, total: 0, currentIndex: null });
  };

  const clearAutosave = () => {
    localStorage.removeItem("markdown-studio-autosave");
    localStorage.removeItem("markdown-studio-settings");
    localStorage.removeItem("markdown-studio-output");
    showToast("自動保存データを削除しました");
  };

  const processingLabel: Record<ProcessingState, string> = {
    idle: "",
    parsing: "Markdown解析中",
    rendering: "数式・図表描画中",
    paginating: "ページ組版中",
    measuring: "オーバーフロー検査中",
    pdf: "PDF生成中",
    typst: "Typst生成中",
    complete: "完了",
  };

  const lines = source.split("\n");

  return (
    <main className="studio-shell">
      <header className="studio-header">
        <div className="brand-block">
          <h1>Markdown教材PDF Studio</h1>
          <div className="save-status">
            <span className={`status-dot ${saved ? "" : "dirty"}`} />
            <span>{saved ? "保存済み" : "未保存"}</span>
            <span className="status-separator" />
            {processing !== "idle" ? <span className="processing-label">{processingLabel[processing]}</span> : <span>自動更新</span>}
            <button
              aria-label="自動更新を切り替える"
              className={`switch ${settings.autoUpdate ? "is-on" : ""}`}
              onClick={() => setSettings((current) => ({ ...current, autoUpdate: !current.autoUpdate }))}
              type="button"
            ><span /></button>
          </div>
          <div className="studio-mode-switch" aria-label="変換モード">
            <button className={studioMode === "single" ? "active" : ""} disabled={batchRunning} onClick={() => setStudioMode("single")} type="button"><FileText size={15} />単体変換</button>
            <button className={studioMode === "batch" ? "active" : ""} disabled={batchRunning} onClick={() => setStudioMode("batch")} type="button"><Files size={15} />一括変換</button>
          </div>
          <div className="pdf-engine-switch" aria-label="PDF Engine">
            <span>PDF Engine</span>
            <button className={pdfEngine === "legacy" ? "active" : ""} disabled={batchRunning || typstBusy} onClick={() => { setPdfEngine("legacy"); setPostIssues([]); }} type="button">Legacy</button>
            <button className={pdfEngine === "typst" ? "active" : ""} disabled={batchRunning || typstBusy} onClick={() => { setPdfEngine("typst"); setPostIssues([]); }} type="button">Typst</button>
            {pdfEngine === "typst" ? (
              <small className={typstCompilerStatus.available ? "compiler-online" : "compiler-offline"} title={typstCompilerStatus.message}>
                {typstCompilerStatus.checked ? (typstCompilerStatus.available ? "CLI接続済み" : "CLI未接続") : "確認中"}
              </small>
            ) : null}
          </div>
        </div>
        {studioMode === "single" ? <nav className="toolbar" aria-label="教材操作">
          <button className="tool-button tool-button-primary" onClick={() => {
            if (!saved && !window.confirm("編集中の内容を破棄して新規作成しますか？")) return;
            updateSource("");
            setPreviewSource("");
            setCurrentPage(0);
          }} type="button"><FilePlus2 size={17} />新規</button>
          <button className="tool-button" onClick={() => fileInputRef.current?.click()} type="button"><FolderOpen size={17} />開く</button>
          <button className="tool-button" onClick={saveMarkdown} type="button"><Save size={17} />保存</button>
          <div className="toolbar-popover-wrap">
            <button className="tool-button" onClick={() => setSampleOpen((open) => !open)} type="button"><BookOpen size={17} />サンプル</button>
            {sampleOpen && <div className="sample-menu">
              {(Object.keys(SAMPLES) as Array<keyof typeof SAMPLES>).map((key) => (
                <button key={key} onClick={() => loadSample(key)} type="button">{SAMPLES[key].label}</button>
              ))}
            </div>}
          </div>
          <button className="tool-button" onClick={() => {
            pulseProcessing("parsing");
            setPreviewSource(source);
            setRightTab("issues");
            setMobileTab("qa");
            showToast("入力・参照関係・長大要素を検証しました");
          }} type="button"><ShieldCheck size={17} />検証</button>
          <button className="tool-button tool-button-primary" disabled={typstBusy} onClick={() => {
            if (pdfEngine === "typst") {
              void generateTypstPreview();
              return;
            }
            pulseProcessing("rendering", () => setProcessing("paginating"));
            setPreviewSource(source);
            setCurrentPage(0);
            setMobileTab("preview");
          }} type="button"><RefreshCw size={17} />{pdfEngine === "typst" ? "PDFプレビュー生成" : "プレビュー更新"}</button>
          <button className="tool-button tool-button-primary" disabled={Boolean(pdfExportQueue.length) || typstBusy} onClick={exportPdf} type="button"><FileDown size={17} />{pdfExportQueue.length || typstBusy ? "PDF生成中" : outputMode === "split" ? "PDF一括出力" : "PDF出力"}</button>
          <button className="tool-button tool-button-primary" disabled={pdfEngine === "typst"} onClick={exportHtml} title={pdfEngine === "typst" ? "HTML出力はLegacy Engineの機能です" : undefined} type="button"><Code2 size={17} />HTML出力</button>
          <button className="tool-button tool-button-primary" onClick={exportQa} type="button"><BarChart3 size={17} />QAレポート</button>
          <button className="tool-button" onClick={() => { setRightTab("settings"); setMobileTab("settings"); }} type="button"><Settings size={17} />設定</button>
        </nav> : <nav className="toolbar batch-toolbar" aria-label="一括変換操作">
          <button className="tool-button tool-button-primary" disabled={batchRunning} onClick={() => batchFileInputRef.current?.click()} type="button"><Files size={17} />Markdownを追加</button>
          {batchRunning ? <span className="batch-toolbar-status"><RefreshCw size={15} />{batchProgress.completed} / {batchProgress.total} 処理中</span> : null}
        </nav>}
        <input ref={fileInputRef} accept=".md,text/markdown,text/plain,image/*" className="visually-hidden" onChange={openFile} type="file" />
        <input ref={batchFileInputRef} accept=".md,text/markdown" className="visually-hidden" multiple onChange={(event) => {
          if (event.target.files) void addBatchFiles(event.target.files);
          event.target.value = "";
        }} type="file" />
        <input ref={themeSettingsInputRef} accept=".json,application/json" className="visually-hidden" onChange={importThemeJson} type="file" />
      </header>

      {studioMode === "single" ? <>
      <nav className="mobile-tabs" aria-label="表示ペイン">
        {([
          ["editor", "編集"],
          ["preview", "プレビュー"],
          ["qa", "検証"],
          ["settings", "設定"],
        ] as Array<[MobileTab, string]>).map(([id, label]) => (
          <button className={mobileTab === id ? "active" : ""} key={id} onClick={() => {
            setMobileTab(id);
            if (id === "settings") setRightTab("settings");
          }} type="button">{label}</button>
        ))}
      </nav>

      <section className="workspace">
        <article className={`pane editor-pane ${mobileTab === "editor" ? "mobile-active" : ""}`}>
          <div className="pane-titlebar">
            <h2>Markdownエディタ</h2>
            <div className="title-actions">
              <button className={`insert-toggle ${insertOpen ? "active" : ""}`} onClick={() => setInsertOpen((open) => !open)} type="button"><FilePlus2 size={15} />ブロックを挿入</button>
              <IconButton label="検索・置換" onClick={() => setSearchOpen((open) => !open)}><Search size={16} /></IconButton>
              <IconButton disabled={!canUndo} label="元に戻す" onClick={undo}><RotateCcw size={16} /></IconButton>
              <IconButton disabled={!canRedo} label="やり直す" onClick={redo}><RotateCw size={16} /></IconButton>
              <IconButton label="画像を挿入" onClick={() => fileInputRef.current?.click()}><ImagePlus size={16} /></IconButton>
            </div>
          </div>
          {insertOpen && <div className="insert-panel">
            <div className="insert-panel-heading">
              <span><strong>カーソル位置へ挿入</strong><small>選択中の文章はブロック内へ入ります</small></span>
              <IconButton label="閉じる" onClick={() => setInsertOpen(false)}><X size={15} /></IconButton>
            </div>
            <div className="insert-template-grid">
              {INSERT_TEMPLATE_LABELS.map(([key, label]) => <button key={key} onClick={() => insertBlock(key)} type="button">{label}</button>)}
            </div>
            <label className="solution-id-picker">解答の参照先
              <select onChange={(event) => setSolutionId(event.target.value)} value={selectedSolutionId}>
                {exerciseIds.length ? exerciseIds.map((id) => <option key={id} value={id}>{id}</option>) : <option value="q001">q001（問題ID未登録）</option>}
              </select>
            </label>
          </div>}
          {searchOpen && <div className="search-panel">
            <input aria-label="検索文字列" onChange={(event) => setSearchTerm(event.target.value)} placeholder="検索" value={searchTerm} />
            <input aria-label="置換文字列" onChange={(event) => setReplaceTerm(event.target.value)} placeholder="置換後" value={replaceTerm} />
            <button onClick={findNext} type="button">次へ</button>
            <button onClick={replaceOne} type="button">置換</button>
            <button onClick={replaceAll} type="button">すべて</button>
            <IconButton label="閉じる" onClick={() => setSearchOpen(false)}><X size={15} /></IconButton>
          </div>}
          <div className="editor-body">
            <div className="line-numbers" id="studio-line-numbers" ref={lineNumbersRef} aria-hidden="true">
              {lines.map((_, index) => <span className={cursor.line === index + 1 ? "active" : ""} key={index}>{index + 1}</span>)}
            </div>
            <textarea
              aria-label="教材Markdown"
              className="markdown-textarea"
              id="studio-markdown-editor"
              onChange={(event) => updateSource(event.target.value)}
              onClick={(event) => updateCursor(event.currentTarget)}
              onKeyUp={(event) => updateCursor(event.currentTarget)}
              onKeyDown={handleEditorKeyDown}
              onScroll={(event) => {
                if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = event.currentTarget.scrollTop;
              }}
              ref={textareaRef}
              spellCheck={false}
              value={source}
            />
          </div>
          <footer className="pane-footer">
            <span>行 {cursor.line}、列 {cursor.column}</span>
            <span>Markdown <ChevronDown size={13} /></span>
            <span>{source.length.toLocaleString()} 文字</span>
          </footer>
        </article>

        <article className={`pane preview-pane ${mobileTab === "preview" ? "mobile-active" : ""}`}>
          <div className="pane-titlebar preview-titlebar">
            <div className="preview-title-row">
              <h2>{pdfEngine === "typst" ? "Typst PDFプレビュー" : "A4プレビュー"} <span className="output-mode-badge">{OUTPUT_MODE_LABELS[outputMode]}{pdfExportQueue.length ? `（${editionForMode(activeOutputMode)}PDF生成中）` : outputMode === "split" ? "（問題プレビュー）" : ""}</span></h2>
              {pdfEngine === "legacy" ? <div aria-label="ページ移動" className="preview-page-controls" role="group">
                <IconButton disabled={visiblePageIndex === 0} label="前のページ" onClick={() => setCurrentPage((value) => Math.max(0, value - 1))}><ChevronLeft size={17} /></IconButton>
                <span aria-live="polite" className="page-counter">{visiblePageIndex + 1} / {pages.length}</span>
                <IconButton disabled={visiblePageIndex >= pages.length - 1} label="次のページ" onClick={() => setCurrentPage((value) => Math.min(pages.length - 1, value + 1))}><ChevronRight size={17} /></IconButton>
              </div> : (
                <span className={`typst-current-state ${typstPreviewIsCurrent ? "current" : "stale"}`}>
                  {typstPreview ? `${typstPreview.pageCount}ページ${typstPreviewIsCurrent ? "・最新" : "・再生成が必要"}` : "未生成"}
                </span>
              )}
            </div>
            <div className="preview-controls">
              <select
                aria-label="出力内容"
                className="output-mode-select"
                onChange={(event) => setOutputMode(event.target.value as OutputMode)}
                value={outputMode}
              >
                {(Object.keys(OUTPUT_MODE_LABELS) as OutputMode[]).map((mode) => (
                  <option key={mode} value={mode}>{OUTPUT_MODE_LABELS[mode]}</option>
                ))}
              </select>
              {pdfEngine === "legacy" ? <select
                aria-label="テーマプリセット"
                className="theme-preset-select"
                onChange={(event) => setSettings((current) => applyThemePreset(current, event.target.value as ThemePreset))}
                value={settings.themePreset}
              >
                {(Object.keys(THEME_PRESET_LABELS) as ThemePreset[]).map((preset) => (
                  <option key={preset} value={preset}>{THEME_PRESET_LABELS[preset]}</option>
                ))}
              </select> : (
                <select
                  aria-label="Typstテーマ"
                  className="theme-preset-select"
                  onChange={(event) => setTypstTheme(event.target.value as TypstThemeId)}
                  value={typstTheme}
                >
                  {(Object.keys(TYPST_THEME_LABELS) as TypstThemeId[]).map((theme) => (
                    <option key={theme} value={theme}>{TYPST_THEME_LABELS[theme]}</option>
                  ))}
                </select>
              )}
              {pdfEngine === "legacy" ? <select
                aria-label="デザインテーマ"
                className="design-theme-select"
                onChange={(event) => setSettings((current) => applyDesignTheme(current, event.target.value as DesignTheme))}
                value={settings.designTheme}
              >
                {(Object.keys(DESIGN_THEME_LABELS) as DesignTheme[]).map((theme) => (
                  <option key={theme} value={theme}>{DESIGN_THEME_LABELS[theme]}</option>
                ))}
              </select> : null}
              {pdfEngine === "legacy" && designThemeSupportsColor(settings.designTheme) ? (
                <select
                  aria-label="デザインカラー"
                  className="academic-color-select"
                  onChange={(event) => setSettings((current) => ({ ...current, academicColor: event.target.value as AcademicColorVariant }))}
                  value={settings.academicColor}
                >
                  {(Object.keys(ACADEMIC_COLOR_LABELS) as AcademicColorVariant[]).map((variant) => (
                    <option key={variant} value={variant}>{ACADEMIC_COLOR_LABELS[variant]}</option>
                  ))}
                </select>
              ) : null}
              {pdfEngine === "legacy" ? <div aria-label="プレビュー倍率操作" className="preview-zoom-controls" role="group">
                <IconButton label="縮小" onClick={() => setZoom((value) => Math.max(50, value - 10))}>−</IconButton>
                <select aria-label="プレビュー倍率" onChange={(event) => setZoom(Number(event.target.value))} value={zoom}>
                  <option value="50">ページ幅</option>
                  <option value="75">75%</option>
                  <option value="90">90%</option>
                  <option value="100">100%</option>
                </select>
                <IconButton label="拡大" onClick={() => setZoom((value) => Math.min(120, value + 10))}>＋</IconButton>
              </div> : (
                <button className="typst-generate-button" disabled={typstBusy} onClick={() => void generateTypstPreview()} type="button">
                  <RefreshCw size={14} />{typstBusy ? processingLabel[processing] : "Generate Preview"}
                </button>
              )}
            </div>
          </div>
          <div className={`preview-stage ${pdfEngine === "typst" ? "typst-preview-stage" : ""}`} ref={previewRef}>
            {pdfEngine === "typst" ? (
              <div className="typst-pdf-preview">
                {typstError ? (
                  <section className="typst-error-card" role="alert">
                    <AlertCircle size={22} />
                    <div>
                      <strong>{typstError.stage} / {typstError.code}</strong>
                      <p>{typstError.message}</p>
                      {typstError.sourceLine ? <span>Markdown {typstError.sourceLine}行目{typstError.nodeType ? `・${typstError.nodeType}` : ""}</span> : null}
                      {typstError.source ? <code>{typstError.source}</code> : null}
                      {typstError.details?.length ? <details><summary>詳細</summary><pre>{typstError.details.join("\n")}</pre></details> : null}
                    </div>
                  </section>
                ) : null}
                {!typstCompilerStatus.available && typstCompilerStatus.checked ? (
                  <div className="typst-compiler-notice"><Info size={18} /><span>{typstCompilerStatus.message}</span></div>
                ) : null}
                {typstPreview ? (
                  <>
                    {!typstPreviewIsCurrent ? <div className="typst-stale-notice">Markdownまたは設定が更新されています。Generate PreviewでPDFを再生成してください。</div> : null}
                    <iframe className="typst-pdf-viewer" src={typstPreview.url} title={`${typstPreview.fileName} PDFプレビュー`} />
                    <div className="typst-pdf-meta">
                      <span>{typstPreview.typstVersion}</span>
                      <span>本文検証 {typstPreview.textValidation}</span>
                      <button onClick={() => downloadGeneratedBlob(typstPreview.blob, typstPreview.fileName)} type="button"><Download size={14} />同じPDFを保存</button>
                    </div>
                  </>
                ) : (
                  <div className="typst-preview-empty">
                    <FileText size={38} />
                    <strong>PDFはまだ生成されていません</strong>
                    <span>公式Typst CLIで組版したPDFそのものをここに表示します。</span>
                    <button disabled={typstBusy} onClick={() => void generateTypstPreview()} type="button">Generate Preview</button>
                  </div>
                )}
              </div>
            ) : <div
              className="preview-viewport"
              style={{
                width: A4_WIDTH_PX * zoom / 100,
                height: A4_HEIGHT_PX * zoom / 100,
              }}
            >
              <div className="preview-zoom" style={{ "--preview-scale": zoom / 100 } as CSSProperties}>
                <PageDocument
                  activePageIndex={visiblePageIndex}
                  className="shared-page-document"
                  debugPagination={debugPagination}
                  metadata={parsed.metadata}
                  onSelectLine={goToLine}
                  pages={pages}
                  ref={printPagesRef}
                  settings={settings}
                />
              </div>
            </div>}
          </div>
        </article>

        <aside className={`pane qa-pane ${(mobileTab === "qa" || mobileTab === "settings") ? "mobile-active" : ""}`}>
          <div className="pane-titlebar">
            <h2>検証・QA</h2>
            <span className={`qa-pass-badge ${errorCount ? "failed" : warningCount ? "warning" : "passed"}`}>{qaStatus}</span>
          </div>
          <div className="qa-body">
            <div className="qa-summary">
              <button onClick={() => setRightTab("issues")} type="button"><AlertCircle size={19} /><span>エラー</span><strong>{errorCount}</strong></button>
              <button className="warning" onClick={() => setRightTab("issues")} type="button"><TriangleAlert size={19} /><span>警告</span><strong>{warningCount}</strong></button>
              <button onClick={() => setRightTab("qa")} type="button"><FileText size={19} /><span>ページ</span><strong>{pdfEngine === "typst" ? typstPreview?.pageCount ?? "—" : pages.length}</strong></button>
            </div>
            <div className="qa-tabs">
              <button className={rightTab === "issues" ? "active" : ""} onClick={() => setRightTab("issues")} type="button">検証結果</button>
              <button className={rightTab === "qa" ? "active" : ""} onClick={() => setRightTab("qa")} type="button">QA</button>
              <button className={rightTab === "settings" ? "active" : ""} onClick={() => setRightTab("settings")} type="button">設定</button>
            </div>
            {rightTab === "issues" && <div className="issue-list">
              {issues.length ? issues.map((issue) => <IssueCard issue={issue} key={issue.id} onClick={() => goToLine(issue.line)} onPreviewFix={setSelectedQuickFix} onUnknownChoice={handleUnknownChoice} quickFix={quickFixByIssue.get(issue.id)} />) : (
                <div className="qa-empty"><CheckCircle2 size={30} /><strong>問題は見つかりませんでした</strong><span>重大エラー・警告・未解消オーバーフローは0件です。</span></div>
              )}
            </div>}
            {rightTab === "qa" && <div className="qa-details">
              <div className="qa-metrics">
                <span><strong>{mathCount}</strong>数式</span>
                <span><strong>{figureCount}</strong>図表</span>
                <span><strong>{pagination.splitIds.size}</strong>分割</span>
                <span><strong>{fallbackCount}</strong>代替表示</span>
              </div>
              {pdfEngine === "typst" ? <section><h3>Typst PDF検査</h3>
                <p><Check size={15} />DOM高さ計測・独自Pagination：未使用</p>
                <p><Check size={15} />PreviewとDownload：同一PDF Blob</p>
                <p><Check size={15} />文字欠落警告：コンパイラサービスで検査</p>
                <p><Check size={15} />本文抽出：{typstPreview?.textValidation ?? "PDF生成後に実行"}</p>
              </section> : <section><h3>描画後検査</h3>
                <p><Check size={15} />横・縦オーバーフロー：{postIssues.length}件</p>
                <p><Check size={15} />空白ページ：{pages.filter((page) => !page.blocks.length).length}件</p>
                <p><Check size={15} />孤立見出し：{orphanHeadingCount}件</p>
                <p><Check size={15} />短い文章の孤立：{tinyFragmentCount}件</p>
                <p><Check size={15} />ページ番号・著作権：配置済み</p>
              </section>}
              <section><h3>図表プラグイン</h3>
                <p><BarChart3 size={15} />関数グラフ：対応</p>
                <p><BarChart3 size={15} />データグラフ：対応</p>
                <p><BarChart3 size={15} />数直線：対応</p>
                <p><BarChart3 size={15} />符号表：対応</p>
                <p><TriangleAlert size={15} />三角形：対応</p>
                <p><CircleHelp size={15} />円：対応</p>
                <p><CircleHelp size={15} />ベン図：対応</p>
                <p><ListChecks size={15} />樹形図：対応</p>
                <p><BarChart3 size={15} />ヒストグラム・箱ひげ図：対応</p>
                <p><BarChart3 size={15} />散布図：対応</p>
                <p><BarChart3 size={15} />確率分布図：対応</p>
                <p><ListChecks size={15} />Mermaid：対応</p>
                <p><ImagePlus size={15} />ローカル画像：{pdfEngine === "typst" ? "初期版未対応" : "対応"}</p>
              </section>
              <button className="primary-action" onClick={exportQa} type="button"><Download size={15} />JSONレポートを保存</button>
            </div>}
            {rightTab === "settings" && <SettingsPanel
              clearAutosave={clearAutosave}
              exportThemeJson={exportThemeJson}
              includeQuestionInAnswer={includeQuestionInAnswer}
              openThemeJson={() => themeSettingsInputRef.current?.click()}
              outputMode={outputMode}
              setIncludeQuestionInAnswer={setIncludeQuestionInAnswer}
              setOutputMode={setOutputMode}
              setSettings={setSettings}
              settings={settings}
            />}
          </div>
        </aside>
      </section>
      </> : <BatchWorkspace
        expandedJob={batchExpandedJob}
        includeQuestionInAnswer={includeQuestionInAnswer}
        jobs={batchJobs}
        onChooseFiles={() => batchFileInputRef.current?.click()}
        onClear={clearBatch}
        onDownloadZip={() => void downloadBatchZip()}
        onDropFiles={(files) => void addBatchFiles(files)}
        onRemoveJob={(id) => {
          setBatchJobs((current) => current.filter((job) => job.id !== id));
          setBatchZipReady(false);
        }}
        onRetryFailed={() => void runBatch("failed")}
        onStart={() => void runBatch("all")}
        onStop={() => {
          batchStopRequestedRef.current = true;
          showToast("現在の教材が終わったら停止します");
        }}
        outputMode={outputMode}
        progress={batchProgress}
        running={batchRunning}
        setExpandedJob={setBatchExpandedJob}
        setIncludeQuestionInAnswer={setIncludeQuestionInAnswer}
        setOutputMode={setOutputMode}
        setSettings={setSettings}
        settings={settings}
        snapshot={batchSettingsSnapshot}
        zipReady={batchZipReady}
      />}

      {toast && <div className="toast" role="status"><CheckCircle2 size={17} />{toast}</div>}
      {selectedQuickFix && <div className="quick-fix-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setSelectedQuickFix(null); }}>
        <section aria-labelledby="quick-fix-title" aria-modal="true" className="quick-fix-dialog" role="dialog">
          <div className="quick-fix-dialog-title">
            <span><strong id="quick-fix-title">修正内容を確認</strong><small>{selectedQuickFix.line}行目・{selectedQuickFix.reason}</small></span>
            <IconButton label="閉じる" onClick={() => setSelectedQuickFix(null)}><X size={17} /></IconButton>
          </div>
          <div className="quick-fix-diff">
            <div><span>修正前</span><code>{selectedQuickFix.before || "（ここへ追加）"}</code></div>
            <div><span>修正後</span><code>{selectedQuickFix.after}</code></div>
          </div>
          <p>修正理由：{selectedQuickFix.title}</p>
          <div className="quick-fix-dialog-actions">
            <button onClick={() => setSelectedQuickFix(null)} type="button">キャンセル</button>
            <button className="primary-action" onClick={confirmQuickFix} type="button">適用</button>
          </div>
        </section>
      </div>}
      <div className="keyboard-help" title="Ctrl+Z 元に戻す / Ctrl+F 検索"><CircleHelp size={15} /></div>
      {pdfEngine === "legacy" ? <LayoutMeasurement
        blocks={measurementBlocks}
        metadata={parsed.metadata}
        measurementRef={measurementRef}
        settings={settings}
      /> : null}
      {pdfEngine === "legacy" && batchRenderRequest ? <BatchRenderSurface
        key={batchRenderRequest.token}
        onComplete={resolveBatchRender}
        onFailure={rejectBatchRender}
        request={batchRenderRequest}
      /> : null}
    </main>
  );
}
