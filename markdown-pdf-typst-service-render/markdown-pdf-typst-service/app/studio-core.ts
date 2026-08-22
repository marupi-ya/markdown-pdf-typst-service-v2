export type Metadata = {
  lesson_id: string;
  title: string;
  subject: string;
  difficulty: string;
  author: string;
  copyright: string;
};

export type BlockType =
  | "heading"
  | "paragraph"
  | "list"
  | "table"
  | "math"
  | "code"
  | "figure"
  | "callout"
  | "page-break"
  | "hr";

export type StudioBlock = {
  id: string;
  type: BlockType;
  startLine: number;
  endLine: number;
  markdown: string;
  level?: number;
  blockName?: string;
  title?: string;
  attributes?: Record<string, string>;
  figureType?: string;
  params?: Record<string, string>;
  raw?: string;
  continuation?: boolean;
  originBlockId?: string;
  fragmentIds?: string[];
  fragmentIndex?: number;
  fragmentEndIndex?: number;
  fragmentCount?: number;
  /**
   * Container blocks keep their parsed descendants instead of collapsing the
   * body back to one opaque Markdown string. Pagination and rendering both
   * walk this tree, so figures and nested boxes behave exactly like root
   * blocks.
   */
  children?: StudioBlock[];
  fragmentRole?: "single" | "first" | "middle" | "last";
  paginationScale?: number;
  paginationOriginalHeight?: number;
  /** Rendered line count retained for Page DOM post-pagination validation. */
  paginationLineCount?: number;
  paginationError?: string;
  breakPolicy: "atomic" | "conditional" | "flow";
  renderStatus?: "normal" | "warning" | "fallback";
};

export type PaginationStrategy =
  | "manual"
  | "atomic"
  | "splittable"
  | "container"
  | "keep-with-next";

export type PaginationSemanticRole =
  | "content"
  | "heading"
  | "problem"
  | "solution"
  | "explanation"
  | "point"
  | "warning"
  | "summary"
  | "formula"
  | "figure"
  | "table"
  | "list"
  | "container"
  | "decoration"
  | "manual-break";

export type PaginationMinimumFragment =
  | { kind: "full" }
  | { kind: "rendered-lines"; count: number }
  | { kind: "first-list-item"; count: number }
  | { kind: "table-rows"; count: number }
  | { kind: "first-container-child"; count: number };

/**
 * Semantic pagination rules are derived from AST meaning, never from the
 * school subject or a visible Japanese label such as 「例題」.
 */
export type PaginationConstraint = {
  strategy: PaginationStrategy;
  role: PaginationSemanticRole;
  atomic: boolean;
  splittable: boolean;
  container: boolean;
  keepWithNext: boolean;
  keepWithPrevious: boolean;
  /** Keep a semantic unit whole whenever the complete unit fits one empty page. */
  keepTogetherWhenFits: boolean;
  minimumFragment: PaginationMinimumFragment;
  preferredBreakPoints: readonly (
    | "block-boundary"
    | "rendered-line"
    | "list-item"
    | "table-row"
    | "equation-row"
    | "container-child"
  )[];
  avoidBreakBefore: boolean;
  avoidBreakAfter: boolean;
};

export type PaginationBreakReason =
  | "manual"
  | "documentEnd"
  | "overflow"
  | "atomicMove"
  | "keepWithNext"
  | "keepWithPrevious"
  | "problemKeepTogether"
  | "minimumFragment"
  | "widowPrevention"
  | "containerSplit"
  | "preferredBreak"
  | "whitespaceOptimization"
  | "tinyTailBacktrack"
  | "footerSafety"
  | "postValidationRepair";

export type PaginationDebugRecord = {
  page: number;
  pageHeight?: number;
  contentTop?: number;
  contentBottom?: number;
  footerTop?: number;
  usableHeight?: number;
  usedHeight?: number;
  engineContentBottom?: number;
  remainingHeight: number;
  breakReason: PaginationBreakReason;
  movedNode?: string;
  nextNode?: string;
  nextNodeType?: BlockType;
  nextNodeHeight?: number;
  minimumFragmentHeight?: number;
  keepWithNext?: boolean;
  keepWithPrevious?: boolean;
  atomic?: boolean;
  splittable?: boolean;
  container?: boolean;
  badness?: number;
};

export type PaginationOptions = {
  debug?: boolean;
  pageGeometry?: PaginationPageGeometry;
};

export type Issue = {
  id: string;
  severity: "error" | "warning" | "info";
  line: number;
  blockType: string;
  title: string;
  reason: string;
  fix: string;
  page?: number;
  history?: string[];
};

export type QuickFix = {
  id: string;
  issueId: string;
  kind: "append-marker" | "insert-marker" | "close-quote" | "rename-id" | "rename-attribute";
  line: number;
  title: string;
  reason: string;
  start: number;
  end: number;
  before: string;
  after: string;
};

export type ParsedDocument = {
  metadata: Metadata;
  blocks: StudioBlock[];
  issues: Issue[];
};

export type OutputMode = "complete" | "questions" | "answers" | "split";

export type RenderDocument = ParsedDocument & {
  outputMode: OutputMode;
  includeQuestionInAnswer: boolean;
};

export type PageModel = {
  number: number;
  blocks: StudioBlock[];
  /** Why the engine closed this page. Kept internally for debug mode. */
  breakAfter?: PaginationBreakReason;
  paginationDebug?: PaginationDebugRecord;
};

export type BlockMeasurement = {
  height: number;
  width: number;
  clientWidth: number;
  lineCount: number;
  /** Height of the first safe rendered fragment (for example two prose lines or one list item). */
  minimumFragmentHeight?: number;
  /** Rendered child-content contribution for recursively split containers. */
  containerContentHeight?: number;
  /** DOM-measured margin delta when this fragment is no longer the first child. */
  containerContinuationAdjustmentHeight?: number;
  /** Frame, title, padding, and margins paid once per page fragment. */
  containerChromeHeight?: number;
  /** Height of the rendered "continued on next page" marker, if present. */
  continuationMarkerHeight?: number;
  /** Rendered list box without the outer measurement wrapper margins. */
  listBodyHeight?: number;
  /** Collapsed margin contribution between two adjacent list-item fragments. */
  listMergeGapHeight?: number;
  /** Row contribution when adjacent table fragments are reconstructed as one table. */
  tableBodyHeight?: number;
  /** Wrapper, caption, and repeated header contribution paid once per page table fragment. */
  tableChromeHeight?: number;
  lineBreakOffsets?: number[];
  textContent?: string;
};

export type PaginationPageGeometryInput = {
  coordinateScale?: number;
  pageHeight: number;
  pageContentTop: number;
  pageContentBottom: number;
  headerBottom?: number;
  headerMarginBottom?: number;
  footerTop?: number;
  requiredFooterGap: number;
};

export type PaginationPageGeometry = {
  coordinateScale: number;
  pageHeight: number;
  pageContentTop: number;
  pageContentBottom: number;
  contentTop: number;
  contentBottom: number;
  footerTop?: number;
  requiredFooterGap: number;
  usableHeight: number;
};

/**
 * Converts Page DOM landmarks into one unscaled CSS-pixel coordinate system.
 * Margin, header and footer reservations are applied exactly once here.
 */
export function derivePaginationPageGeometry(
  input: PaginationPageGeometryInput,
): PaginationPageGeometry {
  const headerEnd = input.headerBottom === undefined
    ? input.pageContentTop
    : input.headerBottom + Math.max(0, input.headerMarginBottom ?? 0);
  const contentTop = Math.min(
    input.pageContentBottom,
    Math.max(input.pageContentTop, headerEnd),
  );
  const footerLimitedBottom = input.footerTop === undefined
    ? input.pageContentBottom
    : input.footerTop - Math.max(0, input.requiredFooterGap);
  const contentBottom = Math.max(
    contentTop,
    Math.min(input.pageContentBottom, footerLimitedBottom),
  );
  return {
    coordinateScale: input.coordinateScale ?? 1,
    pageHeight: input.pageHeight,
    pageContentTop: input.pageContentTop,
    pageContentBottom: input.pageContentBottom,
    contentTop,
    contentBottom,
    footerTop: input.footerTop,
    requiredFooterGap: Math.max(0, input.requiredFooterGap),
    usableHeight: Math.max(0, contentBottom - contentTop),
  };
}

/** One source of truth for DOM measurement and pagination tolerances. */
export const PAGINATION_CONFIG = Object.freeze({
  blockGapPx: 3,
  bodyRoundingReserveGaps: 2,
  minimumParagraphLinesWithHeading: 2,
  minimumParagraphLinesAtBoundary: 2,
  minimumTableRowsAtBoundary: 2,
  minimumProblemChoiceItemsAtBoundary: 2,
  tinyTailMaxPageRatio: 0.18,
  tinyTailMaxOriginRatio: 0.24,
  tinyTailMaxMeaningfulChildren: 2,
  overflowTolerancePx: 1.5,
  hugeWhitespaceRatio: 0.42,
  breakCandidateLookBehind: 8,
  layoutStableFrames: 2,
  maxLayoutPasses: 6,
  renderTimeoutMs: 8000,
  badness: Object.freeze({
    whitespaceWeight: 40,
    movedNodeWeight: 3,
    hugeWhitespaceBase: 100,
    hugeWhitespaceWeight: 180,
    semanticSplit: 2600,
    orphanHeading: 2600,
    problemChoiceSplit: 1200,
    avoidBreakAfter: 600,
    avoidBreakBefore: 450,
    paragraphWidow: 1800,
    tableWidow: 1400,
    preferredBoundaryBonus: 12,
  }),
});

const DEFAULT_METADATA: Metadata = {
  lesson_id: "",
  title: "無題の教材",
  subject: "未設定",
  difficulty: "未設定",
  author: "ミライコーチング",
  copyright: "©ミライコーチング",
};

const KNOWN_BLOCKS = new Set([
  "learning-goals",
  "explanation",
  "definition",
  "key-point",
  "caution",
  "example",
  "exercise",
  "solution",
  "summary",
  "page-break",
]);

const KNOWN_BLOCK_ATTRIBUTES: Record<string, Set<string>> = {
  "learning-goals": new Set(["title"]),
  explanation: new Set(["title"]),
  definition: new Set(["title"]),
  "key-point": new Set(["title"]),
  caution: new Set(["title"]),
  example: new Set(["title"]),
  exercise: new Set(["id", "title"]),
  solution: new Set(["for", "title"]),
  summary: new Set(["title"]),
  "page-break": new Set(),
};

const ATTRIBUTE_TYPOS: Record<string, string> = {
  titel: "title",
  tittle: "title",
  iid: "id",
  idd: "id",
  forr: "for",
  fro: "for",
};

const CONDITIONAL_BLOCKS = new Set([
  "definition",
  "key-point",
  "caution",
  "example",
  "exercise",
  "solution",
]);

const FIGURE_TYPES = new Set([
  "mermaid",
  "function-graph",
  "data-chart",
  "number-line",
  "sign-chart",
  "triangle",
  "circle",
  "venn-diagram",
  "tree-diagram",
  "histogram",
  "box-plot",
  "scatter-plot",
  "probability-distribution",
  "image",
  "generic-table",
]);

export type GeometryPoint = {
  label: string;
  x: number;
  y: number;
};

export type GeometrySegment = {
  from: string;
  to: string;
  label: string;
};

export type TriangleAngle = {
  vertex: string;
  label: string;
};

export type TriangleConfig = {
  vertices: [GeometryPoint, GeometryPoint, GeometryPoint];
  sides: GeometrySegment[];
  angles: TriangleAngle[];
  rightAngles: string[];
};

export type CirclePoint = {
  label: string;
  angle: number;
};

export type CircleArc = {
  from: string;
  to: string;
  kind: "minor" | "major";
  label: string;
};

export type CircleConfig = {
  center: string;
  radius: number;
  points: CirclePoint[];
  segments: GeometrySegment[];
  arcs: CircleArc[];
  showCenter: boolean;
};

export type VennSet = {
  id: string;
  label: string;
};

export type VennRegion = {
  key: string;
  label: string;
};

export type VennDiagramConfig = {
  sets: VennSet[];
  universe: string;
  showUniverse: boolean;
  shaded: string[];
  regions: VennRegion[];
};

export type TreeDiagramNode = {
  id: string;
  label: string;
};

export type TreeDiagramBranch = {
  from: string;
  to: string;
  label: string;
  probability: string;
};

export type TreeDiagramResult = {
  node: string;
  label: string;
  probability: string;
};

export type TreeDiagramConfig = {
  root: TreeDiagramNode;
  nodes: TreeDiagramNode[];
  branches: TreeDiagramBranch[];
  results: TreeDiagramResult[];
  stages: string[];
  showNodeLabels: boolean;
};

export type HistogramConfig = {
  boundaries: number[];
  frequencies: number[];
  xLabel: string;
  yLabel: string;
  yMax: number;
  yTick: number;
  showValues: boolean;
};

export type BoxPlotSeries = {
  label: string;
  fiveNumber: [number, number, number, number, number];
  outliers: number[];
};

export type BoxPlotConfig = {
  series: BoxPlotSeries[];
  range: [number, number];
  tickStep: number;
  axisLabel: string;
  showValues: boolean;
};

export type ScatterPlotPoint = {
  x: number;
  y: number;
  label: string;
};

export type ScatterPlotTrend = {
  slope: number;
  intercept: number;
  label: string;
};

export type ScatterPlotConfig = {
  points: ScatterPlotPoint[];
  xRange: [number, number];
  yRange: [number, number];
  xTick: number;
  yTick: number;
  xLabel: string;
  yLabel: string;
  showGrid: boolean;
  showLabels: boolean;
  trend?: ScatterPlotTrend;
};

export type ProbabilityShade = {
  kind: "interval" | "left" | "right";
  lower?: number;
  upper?: number;
};

export type ProbabilityDistributionConfig = {
  distribution: "binomial" | "normal";
  n?: number;
  p?: number;
  mean: number;
  standardDeviation: number;
  xRange: [number, number];
  xTick: number;
  xLabel: string;
  shade?: ProbabilityShade;
  showParameters: boolean;
};

export type NumberLinePoint = {
  value: number;
  label: string;
  marker: "open" | "closed";
};

export type NumberLineConfig = {
  min: number;
  max: number;
  interval?: [number, number];
  endpoints: ["open" | "closed", "open" | "closed"];
  points: NumberLinePoint[];
  tickStep?: number;
};

export type SignChartRow = {
  label: string;
  cells: string[];
};

export type SignChartConfig = {
  variable: string;
  criticalPoints: number[];
  rows: SignChartRow[];
};

export type FunctionGraphLineStyle =
  | "solid"
  | "dashed"
  | "dotted"
  | "dashdot"
  | "longdash";

export type FunctionGraphSeries = {
  formula: string;
  label: string;
  style: FunctionGraphLineStyle;
};

export type FunctionGraphPoint = {
  x: number;
  y: number;
  label: string;
  marker: "open" | "closed";
};

export type FunctionGraphGuide = {
  axis: "x" | "y";
  value: number;
  label: string;
  style: FunctionGraphLineStyle;
};

export type FunctionGraphConfig = {
  xRange: [number, number];
  yRange: [number, number];
  xTick?: number;
  yTick?: number;
  showGrid: boolean;
  showLegend: boolean;
  series: FunctionGraphSeries[];
  points: FunctionGraphPoint[];
  guides: FunctionGraphGuide[];
};

export type FigureConfigResult<T> =
  | { ok: true; config: T }
  | { ok: false; errors: string[] };

const FUNCTION_GRAPH_STYLES: FunctionGraphLineStyle[] = [
  "solid",
  "dashed",
  "dotted",
  "dashdot",
  "longdash",
];

function stripQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseAttributes(value: string) {
  const attributes: Record<string, string> = {};
  const regex = /([\w-]+)=("([^"]*)"|'([^']*)'|([^\s]+))/g;
  for (const match of value.matchAll(regex)) {
    attributes[match[1]] = match[3] ?? match[4] ?? match[5] ?? "";
  }
  return attributes;
}

function parseParams(raw: string) {
  const params: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
    if (match) params[match[1]] = stripQuotes(match[2]);
  }
  return params;
}

function commaValues(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function finitePair(
  value: string | undefined,
  fallback: [number, number],
  label: string,
  errors: string[],
) {
  if (!value) return fallback;
  const pair = commaValues(value).map(Number);
  if (pair.length !== 2 || pair.some((item) => !Number.isFinite(item))) {
    errors.push(`${label}は「最小値, 最大値」の2数で指定してください。`);
    return fallback;
  }
  if (pair[0] >= pair[1]) {
    errors.push(`${label}は最小値 < 最大値にしてください。`);
    return fallback;
  }
  if (pair[1] - pair[0] > 1000) {
    errors.push(`${label}の幅は1000以下にしてください。`);
    return fallback;
  }
  return [pair[0], pair[1]] as [number, number];
}

function booleanValue(
  value: string | undefined,
  fallback: boolean,
  label: string,
  errors: string[],
) {
  if (value === undefined || value.trim() === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "on", "1", "show", "表示"].includes(normalized)) return true;
  if (["false", "no", "off", "0", "hide", "非表示"].includes(normalized)) return false;
  errors.push(`${label}はtrueまたはfalseで指定してください。`);
  return fallback;
}

function graphLineStyle(
  value: string | undefined,
  fallback: FunctionGraphLineStyle,
): FunctionGraphLineStyle | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "dash") return "dashed";
  if (normalized === "dot") return "dotted";
  return FUNCTION_GRAPH_STYLES.includes(normalized as FunctionGraphLineStyle)
    ? (normalized as FunctionGraphLineStyle)
    : null;
}

export function evaluatePolynomialFormula(formula: string, x: number) {
  const equalsAt = formula.indexOf("=");
  const right = equalsAt >= 0 ? formula.slice(equalsAt + 1) : formula;
  const normalized = right
    .replace(/\s/gu, "")
    .replace(/[−–—]/gu, "-")
    .replace(/X/gu, "x");
  if (!normalized || !/^[0-9x+\-.*^]+$/u.test(normalized)) return Number.NaN;

  const terms = normalized.replace(/-/gu, "+-").split("+").filter(Boolean);
  if (!terms.length) return Number.NaN;
  let result = 0;
  for (const term of terms) {
    if (!term.includes("x")) {
      if (term.includes("*") || term.includes("^")) return Number.NaN;
      const constant = Number(term);
      if (!Number.isFinite(constant)) return Number.NaN;
      result += constant;
      continue;
    }
    if ((term.match(/x/gu) ?? []).length !== 1) return Number.NaN;
    const [coefficientRaw, powerRaw] = term.split("x");
    if (powerRaw && !/^\^[0-5]$/u.test(powerRaw)) return Number.NaN;
    const coefficientText = coefficientRaw.replace(/\*$/u, "");
    const coefficient =
      coefficientText === "" || coefficientText === "+"
        ? 1
        : coefficientText === "-"
          ? -1
          : Number(coefficientText);
    const power = powerRaw ? Number(powerRaw.slice(1)) : 1;
    if (!Number.isFinite(coefficient)) return Number.NaN;
    result += coefficient * x ** power;
  }
  return result;
}

export function parseFunctionGraphConfig(
  params: Record<string, string> = {},
): FigureConfigResult<FunctionGraphConfig> {
  const errors: string[] = [];
  const xRange = finitePair(params["x-range"], [-5, 5], "x-range", errors);
  const yRange = finitePair(params["y-range"], [-5, 5], "y-range", errors);

  const parseTick = (
    value: string | undefined,
    range: [number, number],
    label: string,
  ) => {
    if (!value) return undefined;
    const tick = Number(value);
    if (!Number.isFinite(tick) || tick <= 0) {
      errors.push(`${label}は0より大きい数値にしてください。`);
      return undefined;
    }
    if ((range[1] - range[0]) / tick > 30) {
      errors.push(`${label}は目盛りが30個以内になる値にしてください。`);
      return undefined;
    }
    return tick;
  };
  const xTick = parseTick(
    params["x-tick"] ?? params["x-tick-step"],
    xRange,
    "x-tick",
  );
  const yTick = parseTick(
    params["y-tick"] ?? params["y-tick-step"],
    yRange,
    "y-tick",
  );

  const rawFunctions = params.functions ?? params.formulas;
  const functionEntries = rawFunctions
    ? rawFunctions.split(";").map((entry) => entry.trim()).filter(Boolean)
    : params.formula?.trim()
      ? [params.formula.trim()]
      : [];
  if (functionEntries.length > 5) errors.push("関数は5本以内にしてください。");
  const series: FunctionGraphSeries[] = [];
  for (const [index, entry] of functionEntries.slice(0, 5).entries()) {
    const [formulaText, labelText, styleText] = entry.split("|").map((part) => part.trim());
    const formula = formulaText ?? "";
    const style = graphLineStyle(styleText, FUNCTION_GRAPH_STYLES[index]);
    if (!formula || !Number.isFinite(evaluatePolynomialFormula(formula, 0))) {
      errors.push(`関数${index + 1}は5次以下の多項式で指定してください。`);
      continue;
    }
    if ((labelText ?? formula).length > 32) {
      errors.push(`関数${index + 1}の凡例は32文字以内にしてください。`);
      continue;
    }
    if (!style) {
      errors.push(`関数${index + 1}の線種はsolid、dashed、dotted、dashdot、longdashから選んでください。`);
      continue;
    }
    series.push({ formula, label: labelText || formula, style });
  }

  const points: FunctionGraphPoint[] = [];
  const pointEntries = (params.points ?? "")
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (pointEntries.length > 16) errors.push("点は16個以内にしてください。");
  for (const entry of pointEntries.slice(0, 16)) {
    const [xText, yText, labelText, markerText] = entry.split(",").map((part) => part.trim());
    const x = Number(xText);
    const y = Number(yText);
    const marker = endpointType(markerText);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      errors.push(`点「${entry}」のx座標とy座標を数値で指定してください。`);
      continue;
    }
    if (x < xRange[0] || x > xRange[1] || y < yRange[0] || y > yRange[1]) {
      errors.push(`点「${entry}」は表示範囲内にしてください。`);
      continue;
    }
    if (markerText && !marker) {
      errors.push(`点「${entry}」の種類はopenまたはclosedにしてください。`);
      continue;
    }
    if ((labelText ?? "").length > 16) {
      errors.push(`点「${entry}」のラベルは16文字以内にしてください。`);
      continue;
    }
    points.push({ x, y, label: labelText || `(${x}, ${y})`, marker: marker ?? "closed" });
  }

  const guides: FunctionGraphGuide[] = [];
  const guideEntries = (params.guides ?? "")
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (guideEntries.length > 8) errors.push("補助線は8本以内にしてください。");
  for (const entry of guideEntries.slice(0, 8)) {
    const pipeParts = entry.split("|").map((part) => part.trim());
    let axisText = "";
    let valueText = "";
    let labelText = "";
    let styleText = "";
    if (pipeParts.length > 1) {
      const position = pipeParts[0].match(/^([xy])\s*=\s*(-?(?:\d+(?:\.\d*)?|\.\d+))$/iu);
      axisText = position?.[1] ?? "";
      valueText = position?.[2] ?? "";
      labelText = pipeParts[1] ?? "";
      styleText = pipeParts[2] ?? "";
    } else {
      [axisText, valueText, labelText, styleText] = entry.split(",").map((part) => part.trim());
    }
    const axis = axisText.toLowerCase();
    const value = Number(valueText);
    const style = graphLineStyle(styleText, "dashed");
    if ((axis !== "x" && axis !== "y") || !Number.isFinite(value)) {
      errors.push(`補助線「${entry}」は「x, 値, ラベル, 線種」または「x=値 | ラベル | 線種」で指定してください。`);
      continue;
    }
    const range = axis === "x" ? xRange : yRange;
    if (value < range[0] || value > range[1]) {
      errors.push(`補助線「${entry}」は表示範囲内にしてください。`);
      continue;
    }
    if (!style) {
      errors.push(`補助線「${entry}」の線種を確認してください。`);
      continue;
    }
    if ((labelText ?? "").length > 16) {
      errors.push(`補助線「${entry}」のラベルは16文字以内にしてください。`);
      continue;
    }
    guides.push({
      axis: axis as "x" | "y",
      value,
      label: labelText || `${axis}=${value}`,
      style,
    });
  }

  if (!series.length && !points.length) {
    errors.push("formulaまたはfunctions、もしくはpointsを指定してください。");
  }
  const showGrid = booleanValue(params["show-grid"], true, "show-grid", errors);
  const showLegend = booleanValue(
    params.legend ?? params["show-legend"],
    series.length > 1,
    "legend",
    errors,
  );

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    config: {
      xRange,
      yRange,
      xTick,
      yTick,
      showGrid,
      showLegend,
      series,
      points,
      guides,
    },
  };
}

function endpointType(value: string | undefined): "open" | "closed" | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === "closed" || normalized === "close" || normalized === "閉") {
    return "closed";
  }
  if (normalized === "open" || normalized === "開") return "open";
  return null;
}

export function parseNumberLineConfig(
  params: Record<string, string> = {},
): FigureConfigResult<NumberLineConfig> {
  const errors: string[] = [];
  const range = commaValues(params.range).map(Number);
  const min = Number(params.min ?? range[0]);
  const max = Number(params.max ?? range[1]);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    errors.push("minとmax、またはrangeに有限の数値を指定してください。");
  } else if (min >= max) {
    errors.push("数直線の範囲はmin < maxにしてください。");
  }

  let interval: [number, number] | undefined;
  if (params.interval) {
    const values = commaValues(params.interval).map(Number);
    if (values.length !== 2 || values.some((value) => !Number.isFinite(value))) {
      errors.push("intervalは「左端, 右端」の2数で指定してください。");
    } else if (values[0] > values[1]) {
      errors.push("intervalの左端は右端以下にしてください。");
    } else {
      interval = [values[0], values[1]];
      if (Number.isFinite(min) && Number.isFinite(max) && (values[0] < min || values[1] > max)) {
        errors.push("intervalは数直線の表示範囲内にしてください。");
      }
    }
  }

  const endpointValues = commaValues(params.endpoints);
  const leftEndpoint = endpointType(endpointValues[0]);
  const rightEndpoint = endpointType(endpointValues[1]);
  if (endpointValues.length && (endpointValues.length !== 2 || !leftEndpoint || !rightEndpoint)) {
    errors.push("endpointsはopenまたはclosedを2つ指定してください。");
  }

  const points: NumberLinePoint[] = [];
  for (const item of commaValues(params.points)) {
    const [valueText, labelText, markerText] = item.split(":").map((value) => value.trim());
    const value = Number(valueText);
    const marker = endpointType(markerText);
    if (!Number.isFinite(value)) {
      errors.push(`点「${item}」の位置を数値で指定してください。`);
      continue;
    }
    if (Number.isFinite(min) && Number.isFinite(max) && (value < min || value > max)) {
      errors.push(`点「${item}」は数直線の表示範囲外です。`);
      continue;
    }
    if (markerText && !marker) {
      errors.push(`点「${item}」の種類はopenまたはclosedにしてください。`);
      continue;
    }
    points.push({
      value,
      label: labelText || String(value),
      marker: marker ?? "closed",
    });
  }

  const tickStepText = params["tick-step"] ?? params.ticks;
  const tickStep = tickStepText ? Number(tickStepText) : undefined;
  if (tickStepText && (!Number.isFinite(tickStep) || (tickStep ?? 0) <= 0)) {
    errors.push("tick-stepは0より大きい数値にしてください。");
  } else if (
    tickStep &&
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    (max - min) / tickStep > 30
  ) {
    errors.push("目盛りが30個を超えないようにtick-stepを大きくしてください。");
  }

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    config: {
      min,
      max,
      interval,
      endpoints: [leftEndpoint ?? "closed", rightEndpoint ?? "closed"],
      points,
      tickStep,
    },
  };
}

export function parseSignChartConfig(
  params: Record<string, string> = {},
): FigureConfigResult<SignChartConfig> {
  const errors: string[] = [];
  const criticalPoints = commaValues(params["critical-points"] ?? params.points).map(Number);
  if (!criticalPoints.length || criticalPoints.some((value) => !Number.isFinite(value))) {
    errors.push("critical-pointsに有限の数値を1つ以上指定してください。");
  } else if (criticalPoints.length > 8) {
    errors.push("臨界点は8個以内にしてください。");
  } else if (criticalPoints.some((value, index) => index > 0 && value <= criticalPoints[index - 1])) {
    errors.push("critical-pointsは小さい順に重複なく指定してください。");
  }

  const expectedCells = criticalPoints.length * 2 + 1;
  const rows: SignChartRow[] = [];
  if (params.rows) {
    for (const rowText of params.rows.split(";").map((value) => value.trim()).filter(Boolean)) {
      const separator = rowText.indexOf("|");
      if (separator < 1) {
        errors.push(`行「${rowText}」は「ラベル | 値, 値, ...」で指定してください。`);
        continue;
      }
      const label = rowText.slice(0, separator).trim();
      const cells = commaValues(rowText.slice(separator + 1));
      if (cells.length !== expectedCells) {
        errors.push(`行「${label}」は${expectedCells}個の値を指定してください。`);
        continue;
      }
      if (cells.some((cell) => cell.length > 12 || /[<>]/u.test(cell))) {
        errors.push(`行「${label}」に表示できない長い値または記号があります。`);
        continue;
      }
      rows.push({ label, cells });
    }
  } else {
    const signs = commaValues(params.signs);
    if (signs.length !== criticalPoints.length + 1) {
      errors.push(`signsは区間数に合わせて${criticalPoints.length + 1}個指定してください。`);
    } else {
      const pointValues = params["point-values"]
        ? commaValues(params["point-values"])
        : criticalPoints.map(() => "0");
      if (pointValues.length !== criticalPoints.length) {
        errors.push(`point-valuesは臨界点数に合わせて${criticalPoints.length}個指定してください。`);
      } else {
        const cells: string[] = [];
        signs.forEach((sign, index) => {
          cells.push(sign);
          if (index < pointValues.length) cells.push(pointValues[index]);
        });
        rows.push({ label: params.label ?? "f(x)", cells });
      }
    }
  }

  if (!rows.length && !errors.length) errors.push("符号表の行を1つ以上指定してください。");
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    config: {
      variable: params.variable?.trim() || "x",
      criticalPoints,
      rows,
    },
  };
}

function safeGeometryLabel(value: string, label: string, errors: string[]) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 16 || /[<>]/u.test(trimmed)) {
    errors.push(`${label}は1〜16文字で指定し、< と > は使わないでください。`);
    return "";
  }
  return trimmed;
}

function parseGeometrySegment(
  entry: string,
  allowedPoints: Set<string>,
  label: string,
  errors: string[],
): GeometrySegment | null {
  const separator = entry.indexOf(":");
  const edgeText = (separator >= 0 ? entry.slice(0, separator) : entry).trim();
  const displayLabel = separator >= 0 ? entry.slice(separator + 1).trim() : "";
  const endpoints = edgeText.split("-").map((value) => value.trim()).filter(Boolean);
  if (endpoints.length !== 2) {
    errors.push(`${label}「${entry}」は「始点-終点:ラベル」で指定してください。`);
    return null;
  }
  if (endpoints[0] === endpoints[1] || endpoints.some((point) => !allowedPoints.has(point))) {
    errors.push(`${label}「${entry}」の始点と終点は、登録済みの異なる点を指定してください。`);
    return null;
  }
  if (displayLabel && !safeGeometryLabel(displayLabel, `${label}のラベル`, errors)) return null;
  return { from: endpoints[0], to: endpoints[1], label: displayLabel };
}

export function parseTriangleConfig(
  params: Record<string, string> = {},
): FigureConfigResult<TriangleConfig> {
  const errors: string[] = [];
  const vertices: GeometryPoint[] = [];
  const entries = (params.vertices ?? params.points ?? "")
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean);

  if (entries.length !== 3) errors.push("verticesは3頂点を「A, x, y; B, x, y; C, x, y」で指定してください。");
  for (const entry of entries.slice(0, 3)) {
    const colonAt = entry.indexOf(":");
    const parts = colonAt >= 0
      ? [entry.slice(0, colonAt), ...entry.slice(colonAt + 1).split(",")]
      : entry.split(",");
    const [labelText = "", xText = "", yText = ""] = parts.map((value) => value.trim());
    const pointLabel = safeGeometryLabel(labelText, "頂点名", errors);
    const x = Number(xText);
    const y = Number(yText);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      errors.push(`頂点「${entry}」のx座標とy座標を数値で指定してください。`);
      continue;
    }
    if (x < 20 || x > 400 || y < 20 || y > 240) {
      errors.push(`頂点「${entry}」はx=20〜400、y=20〜240の範囲にしてください。`);
      continue;
    }
    if (pointLabel) vertices.push({ label: pointLabel, x, y });
  }

  const vertexLabels = new Set(vertices.map((point) => point.label));
  if (vertexLabels.size !== vertices.length) errors.push("頂点名は重複しないようにしてください。");
  if (vertices.length === 3) {
    const [a, b, c] = vertices;
    const doubledArea = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    if (doubledArea < 20) errors.push("3頂点がほぼ一直線です。三角形になる座標を指定してください。");
  }

  const sides: GeometrySegment[] = [];
  const sideEntries = (params["side-labels"] ?? params.sides ?? "")
    .split(";").map((value) => value.trim()).filter(Boolean);
  if (sideEntries.length > 3) errors.push("辺ラベルは3個以内にしてください。");
  for (const entry of sideEntries.slice(0, 3)) {
    const segment = parseGeometrySegment(entry, vertexLabels, "辺", errors);
    if (segment) sides.push(segment);
  }

  const angles: TriangleAngle[] = [];
  const angleEntries = (params["angle-labels"] ?? params.angles ?? "")
    .split(";").map((value) => value.trim()).filter(Boolean);
  if (angleEntries.length > 3) errors.push("角ラベルは3個以内にしてください。");
  for (const entry of angleEntries.slice(0, 3)) {
    const separator = entry.indexOf(":");
    const vertex = (separator >= 0 ? entry.slice(0, separator) : "").trim();
    const angleLabel = separator >= 0
      ? safeGeometryLabel(entry.slice(separator + 1), "角ラベル", errors)
      : "";
    if (!vertexLabels.has(vertex) || !angleLabel) {
      if (!vertexLabels.has(vertex)) errors.push(`角「${entry}」の頂点はverticesに登録した名前を指定してください。`);
      continue;
    }
    angles.push({ vertex, label: angleLabel });
  }

  const rightAngles = commaValues(params["right-angles"] ?? params["right-angle"]);
  if (rightAngles.length > 3) errors.push("直角記号は3個以内にしてください。");
  for (const vertex of rightAngles) {
    if (!vertexLabels.has(vertex)) errors.push(`直角の頂点「${vertex}」はverticesに登録した名前を指定してください。`);
  }

  if (errors.length || vertices.length !== 3) return { ok: false, errors };
  return {
    ok: true,
    config: {
      vertices: vertices as [GeometryPoint, GeometryPoint, GeometryPoint],
      sides,
      angles,
      rightAngles,
    },
  };
}

export function parseCircleConfig(
  params: Record<string, string> = {},
): FigureConfigResult<CircleConfig> {
  const errors: string[] = [];
  const center = safeGeometryLabel(params.center?.trim() || "O", "中心名", errors) || "O";
  const radius = Number(params.radius ?? 88);
  if (!Number.isFinite(radius) || radius < 25 || radius > 110) {
    errors.push("radiusは25〜110の数値で指定してください。");
  }
  const showCenter = booleanValue(params["show-center"], true, "show-center", errors);

  const points: CirclePoint[] = [];
  const pointEntries = (params.points ?? "")
    .split(";").map((value) => value.trim()).filter(Boolean);
  if (pointEntries.length > 12) errors.push("円周上の点は12個以内にしてください。");
  for (const entry of pointEntries.slice(0, 12)) {
    const separator = entry.indexOf(":");
    const pointLabel = separator >= 0
      ? safeGeometryLabel(entry.slice(0, separator), "点名", errors)
      : "";
    const angle = Number(separator >= 0 ? entry.slice(separator + 1) : Number.NaN);
    if (!pointLabel || !Number.isFinite(angle)) {
      errors.push(`点「${entry}」は「点名:角度」で指定してください。`);
      continue;
    }
    points.push({ label: pointLabel, angle: ((angle % 360) + 360) % 360 });
  }
  const pointLabels = new Set(points.map((point) => point.label));
  if (pointLabels.size !== points.length || pointLabels.has(center)) {
    errors.push("中心名と円周上の点名は重複しないようにしてください。");
  }
  const allPoints = new Set([center, ...pointLabels]);

  const segments: GeometrySegment[] = [];
  const segmentEntries = (params.segments ?? "")
    .split(";").map((value) => value.trim()).filter(Boolean);
  if (segmentEntries.length > 12) errors.push("線分は12本以内にしてください。");
  for (const entry of segmentEntries.slice(0, 12)) {
    const segment = parseGeometrySegment(entry, allPoints, "線分", errors);
    if (segment) segments.push(segment);
  }

  const arcs: CircleArc[] = [];
  const arcEntries = (params.arcs ?? "")
    .split(";").map((value) => value.trim()).filter(Boolean);
  if (arcEntries.length > 8) errors.push("円弧は8本以内にしてください。");
  for (const entry of arcEntries.slice(0, 8)) {
    const [edgeText = "", kindText = "minor", labelText = ""] = entry.split(":").map((value) => value.trim());
    const endpoints = edgeText.split("-").map((value) => value.trim()).filter(Boolean);
    const kind = kindText.toLowerCase();
    if (endpoints.length !== 2 || endpoints[0] === endpoints[1] || endpoints.some((point) => !pointLabels.has(point))) {
      errors.push(`円弧「${entry}」は円周上の異なる2点を「A-B:minor:ラベル」で指定してください。`);
      continue;
    }
    if (kind !== "minor" && kind !== "major") {
      errors.push(`円弧「${entry}」の種類はminorまたはmajorにしてください。`);
      continue;
    }
    if (labelText && !safeGeometryLabel(labelText, "円弧ラベル", errors)) continue;
    arcs.push({ from: endpoints[0], to: endpoints[1], kind, label: labelText });
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, config: { center, radius, points, segments, arcs, showCenter } };
}

function normalizeVennRegion(
  value: string,
  setIds: string[],
  label: string,
  errors: string[],
) {
  const raw = value.trim().replace(/\s/gu, "").replace(/∩/gu, "&");
  if (["outside", "外側", "complement"].includes(raw.toLowerCase())) return "outside";

  const only = raw.toLowerCase().endsWith("-only");
  const expression = only ? raw.slice(0, -5) : raw;
  const parts = expression.split("&").filter(Boolean);
  if (!parts.length || parts.some((part) => !setIds.includes(part))) {
    errors.push(`${label}「${value}」にはsetsで登録した集合名を指定してください。`);
    return "";
  }
  if (new Set(parts).size !== parts.length) {
    errors.push(`${label}「${value}」で同じ集合名を重ねて指定しないでください。`);
    return "";
  }
  if (only && parts.length !== 1) {
    errors.push(`${label}「${value}」の-onlyは1つの集合名にだけ使用できます。`);
    return "";
  }
  const ordered = setIds.filter((id) => parts.includes(id));
  return `${ordered.join("&")}${only ? "-only" : ""}`;
}

export function parseVennDiagramConfig(
  params: Record<string, string> = {},
): FigureConfigResult<VennDiagramConfig> {
  const errors: string[] = [];
  const rawSets = params.sets?.trim() ?? "";
  const setEntries = (rawSets.includes(";") ? rawSets.split(";") : rawSets.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
  if (setEntries.length < 2 || setEntries.length > 3) {
    errors.push("setsは2〜3集合を「A:集合A; B:集合B」の形で指定してください。");
  }

  const sets: VennSet[] = [];
  for (const entry of setEntries.slice(0, 3)) {
    const separator = entry.indexOf(":");
    const id = (separator >= 0 ? entry.slice(0, separator) : entry).trim();
    const displayLabel = (separator >= 0 ? entry.slice(separator + 1) : id).trim();
    if (!/^[A-Za-z][A-Za-z0-9_]{0,7}$/u.test(id)) {
      errors.push(`集合名「${id || entry}」は半角英字で始まる1〜8文字にしてください。`);
      continue;
    }
    const safeLabel = safeGeometryLabel(displayLabel, `集合${id}の表示名`, errors);
    if (safeLabel) sets.push({ id, label: safeLabel });
  }
  const setIds = sets.map((set) => set.id);
  if (new Set(setIds).size !== setIds.length) errors.push("集合名は重複しないようにしてください。");

  const universe = safeGeometryLabel(params.universe?.trim() || "U", "全体集合名", errors) || "U";
  const showUniverse = booleanValue(params["show-universe"], true, "show-universe", errors);

  const shaded: string[] = [];
  for (const entry of (params.shade ?? params.shaded ?? "").split(";").map((value) => value.trim()).filter(Boolean)) {
    const region = normalizeVennRegion(entry, setIds, "shade", errors);
    if (region) {
      if (region.endsWith("-only")) errors.push(`shade「${entry}」では-onlyを使わず、集合名または共通部分を指定してください。`);
      else if (!shaded.includes(region)) shaded.push(region);
    }
  }
  if (shaded.length > 6) errors.push("色付けする領域は6個以内にしてください。");

  const regions: VennRegion[] = [];
  const regionEntries = (params.regions ?? params["region-labels"] ?? "")
    .split(";").map((value) => value.trim()).filter(Boolean);
  if (regionEntries.length > 8) errors.push("領域ラベルは8個以内にしてください。");
  for (const entry of regionEntries.slice(0, 8)) {
    const pipeAt = entry.indexOf("|");
    const colonAt = entry.indexOf(":");
    const separator = pipeAt >= 0 ? pipeAt : colonAt;
    if (separator < 1) {
      errors.push(`領域「${entry}」は「A-only | 要素」の形で指定してください。`);
      continue;
    }
    const key = normalizeVennRegion(entry.slice(0, separator), setIds, "領域", errors);
    const regionLabel = safeGeometryLabel(entry.slice(separator + 1), "領域ラベル", errors);
    if (key && regionLabel) {
      if (regions.some((region) => region.key === key)) errors.push(`領域「${key}」が重複しています。`);
      else regions.push({ key, label: regionLabel });
    }
  }

  if (errors.length || sets.length < 2 || sets.length > 3) return { ok: false, errors };
  return { ok: true, config: { sets, universe, showUniverse, shaded, regions } };
}

function treeEntryParts(entry: string) {
  if (entry.includes("|")) return entry.split("|").map((value) => value.trim());
  const separator = entry.indexOf(":");
  return separator >= 0
    ? [entry.slice(0, separator).trim(), entry.slice(separator + 1).trim()]
    : [entry.trim()];
}

function safeTreeText(value: string, label: string, errors: string[], maxLength = 28) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || /[<>]/u.test(trimmed)) {
    errors.push(`${label}は1〜${maxLength}文字で指定し、< と > は使わないでください。`);
    return "";
  }
  return trimmed;
}

function validTreeNodeId(value: string) {
  return /^[A-Za-z][A-Za-z0-9_-]{0,15}$/u.test(value);
}

export function parseTreeDiagramConfig(
  params: Record<string, string> = {},
): FigureConfigResult<TreeDiagramConfig> {
  const errors: string[] = [];
  const rootParts = treeEntryParts(params.root?.trim() || "S | 開始");
  const rootId = rootParts[0] ?? "";
  const rootLabel = safeTreeText(rootParts[1] || rootId, "rootの表示名", errors);
  if (!validTreeNodeId(rootId)) {
    errors.push("rootのIDは半角英字で始まる1〜16文字にしてください。");
  }

  const branchEntries = (params.branches ?? "")
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean);
  if (branchEntries.length < 2 || branchEntries.length > 20) {
    errors.push("branchesは2〜20本を「親>子 | 枝ラベル | 確率」の形で指定してください。");
  }

  const branches: TreeDiagramBranch[] = [];
  const parentByNode = new Map<string, string>();
  const edgeKeys = new Set<string>();
  const allNodeIds = new Set<string>(rootId ? [rootId] : []);
  for (const entry of branchEntries.slice(0, 20)) {
    const [connection = "", labelText = "", probabilityText = ""] = entry
      .split("|")
      .map((value) => value.trim());
    const endpoints = connection.split(">").map((value) => value.trim()).filter(Boolean);
    if (endpoints.length !== 2 || endpoints.some((id) => !validTreeNodeId(id))) {
      errors.push(`枝「${entry}」は「親>子 | 枝ラベル | 確率」で指定し、点IDは半角英数字にしてください。`);
      continue;
    }
    const [from, to] = endpoints;
    if (from === to) {
      errors.push(`枝「${entry}」の親と子は異なる点にしてください。`);
      continue;
    }
    if (to === rootId) {
      errors.push(`root「${rootId}」を枝の子にはできません。`);
      continue;
    }
    const edgeKey = `${from}>${to}`;
    if (edgeKeys.has(edgeKey)) {
      errors.push(`枝「${edgeKey}」が重複しています。`);
      continue;
    }
    if (parentByNode.has(to)) {
      errors.push(`点「${to}」の親は1つだけにしてください。`);
      continue;
    }
    const branchLabel = labelText
      ? safeTreeText(labelText, `枝「${edgeKey}」のラベル`, errors, 20)
      : "";
    const probability = probabilityText
      ? safeTreeText(probabilityText, `枝「${edgeKey}」の確率`, errors, 20)
      : "";
    if (!branchLabel && !probability) {
      errors.push(`枝「${edgeKey}」には枝ラベルまたは確率を指定してください。`);
      continue;
    }
    edgeKeys.add(edgeKey);
    parentByNode.set(to, from);
    allNodeIds.add(from);
    allNodeIds.add(to);
    branches.push({ from, to, label: branchLabel, probability });
  }

  const adjacency = new Map<string, string[]>();
  for (const branch of branches) {
    const children = adjacency.get(branch.from) ?? [];
    children.push(branch.to);
    adjacency.set(branch.from, children);
  }
  for (const [node, children] of adjacency) {
    if (children.length > 4) errors.push(`点「${node}」からの枝分かれは4本以内にしてください。`);
  }

  const depths = new Map<string, number>();
  if (rootId) depths.set(rootId, 0);
  const queue = rootId ? [rootId] : [];
  for (let index = 0; index < queue.length; index += 1) {
    const node = queue[index];
    const depth = depths.get(node) ?? 0;
    for (const child of adjacency.get(node) ?? []) {
      if (depths.has(child)) {
        errors.push(`点「${child}」へ循環する枝があります。`);
        continue;
      }
      depths.set(child, depth + 1);
      queue.push(child);
    }
  }
  const disconnected = [...allNodeIds].filter((node) => !depths.has(node));
  if (disconnected.length) {
    errors.push(`rootからつながらない点があります：${disconnected.join("、")}`);
  }
  const maxDepth = Math.max(0, ...depths.values());
  if (maxDepth > 4) errors.push("樹形図の段階はrootから4段階以内にしてください。");
  if (allNodeIds.size > 17) errors.push("樹形図の点は17個以内にしてください。");

  const leaves = [...allNodeIds].filter((node) => !(adjacency.get(node)?.length));
  if (leaves.length > 8) errors.push("樹形図の終点は8個以内にしてください。");

  const labels = new Map<string, string>();
  if (rootId && rootLabel) labels.set(rootId, rootLabel);
  const nodeEntries = (params.nodes ?? "")
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean);
  if (nodeEntries.length > 16) errors.push("nodesの表示名は16個以内にしてください。");
  for (const entry of nodeEntries.slice(0, 16)) {
    const [id = "", labelText = ""] = treeEntryParts(entry);
    if (!allNodeIds.has(id)) {
      errors.push(`nodesの点「${id || entry}」はbranchesにある点IDを指定してください。`);
      continue;
    }
    if (labels.has(id) && id !== rootId) {
      errors.push(`nodesの点「${id}」が重複しています。`);
      continue;
    }
    const nodeLabel = safeTreeText(labelText, `点「${id}」の表示名`, errors);
    if (nodeLabel) labels.set(id, nodeLabel);
  }
  const nodes = [...allNodeIds].map((id) => ({ id, label: labels.get(id) ?? id }));

  const results: TreeDiagramResult[] = [];
  const resultEntries = (params.results ?? "")
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean);
  if (resultEntries.length > 8) errors.push("resultsは8個以内にしてください。");
  for (const entry of resultEntries.slice(0, 8)) {
    const [node = "", labelText = "", probabilityText = ""] = entry
      .split("|")
      .map((value) => value.trim());
    if (!leaves.includes(node)) {
      errors.push(`結果「${entry}」の点IDは枝の終点を指定してください。`);
      continue;
    }
    if (results.some((result) => result.node === node)) {
      errors.push(`結果の点「${node}」が重複しています。`);
      continue;
    }
    const resultLabel = safeTreeText(labelText, `結果「${node}」の表示名`, errors);
    const probability = probabilityText
      ? safeTreeText(probabilityText, `結果「${node}」の確率`, errors, 20)
      : "";
    if (resultLabel) results.push({ node, label: resultLabel, probability });
  }

  const stages = (params.stages ?? "")
    .split(/[;,]/u)
    .map((value) => value.trim())
    .filter(Boolean);
    if (stages.length > maxDepth + 1) {
      errors.push(`stagesはrootを含めて${maxDepth + 1}個以内にしてください。`);
    }
  const safeStages = stages
    .map((stage, index) => safeTreeText(stage, `段階${index + 1}の表示名`, errors, 16))
    .filter(Boolean);
  const showNodeLabels = booleanValue(
    params["show-node-labels"],
    false,
    "show-node-labels",
    errors,
  );

  if (errors.length || !validTreeNodeId(rootId) || branches.length < 2) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    config: {
      root: { id: rootId, label: rootLabel },
      nodes,
      branches,
      results,
      stages: safeStages,
      showNodeLabels,
    },
  };
}

function safeFigureAxisLabel(value: string | undefined, fallback: string, label: string, errors: string[]) {
  const text = value?.trim() || fallback;
  if (text.length > 18 || /[<>]/u.test(text)) {
    errors.push(`${label}は18文字以内にし、< と > は使わないでください。`);
    return fallback;
  }
  return text;
}

export function parseHistogramConfig(
  params: Record<string, string> = {},
): FigureConfigResult<HistogramConfig> {
  const errors: string[] = [];
  const boundaries = commaValues(params.boundaries ?? params["class-boundaries"]).map(Number);
  const frequencies = commaValues(params.frequencies ?? params.values).map(Number);

  if (boundaries.length < 3 || boundaries.length > 13 || boundaries.some((value) => !Number.isFinite(value))) {
    errors.push("boundariesは有限の数値を小さい順に3〜13個指定してください。");
  } else if (boundaries.some((value, index) => index > 0 && value <= boundaries[index - 1])) {
    errors.push("boundariesは小さい順に重複なく指定してください。");
  } else {
    const firstWidth = boundaries[1] - boundaries[0];
    const uneven = boundaries.slice(1).some((value, index) => {
      const width = value - boundaries[index];
      return Math.abs(width - firstWidth) > Math.max(1e-9, Math.abs(firstWidth) * 1e-9);
    });
    if (uneven) errors.push("ヒストグラムの階級幅はすべて同じにしてください。");
    if (boundaries.at(-1)! - boundaries[0] > 1000) errors.push("横軸の範囲は1000以下にしてください。");
  }

  if (frequencies.length !== Math.max(0, boundaries.length - 1)) {
    errors.push(`frequenciesは階級数に合わせて${Math.max(0, boundaries.length - 1)}個指定してください。`);
  } else if (frequencies.some((value) => !Number.isFinite(value) || value < 0)) {
    errors.push("frequenciesは0以上の有限の数値で指定してください。");
  }

  const maxFrequency = Math.max(0, ...frequencies);
  const requestedYMax = params["y-max"] ? Number(params["y-max"]) : undefined;
  let yMax = requestedYMax ?? Math.max(1, Math.ceil(maxFrequency));
  if (!Number.isFinite(yMax) || yMax <= 0 || yMax < maxFrequency) {
    errors.push("y-maxは最大度数以上の正の数値にしてください。");
    yMax = Math.max(1, maxFrequency);
  }

  const requestedTick = params["y-tick"] ? Number(params["y-tick"]) : undefined;
  let yTick = requestedTick ?? Math.max(1, Math.ceil(yMax / 5));
  if (!Number.isFinite(yTick) || yTick <= 0 || yMax / yTick > 10) {
    errors.push("y-tickは0より大きく、目盛りが10個以内になる値にしてください。");
    yTick = Math.max(1, yMax / 5);
  }

  const xLabel = safeFigureAxisLabel(params["x-label"], "階級", "x-label", errors);
  const yLabel = safeFigureAxisLabel(params["y-label"], "度数", "y-label", errors);
  const showValues = booleanValue(params["show-values"], true, "show-values", errors);

  if (errors.length) return { ok: false, errors };
  return { ok: true, config: { boundaries, frequencies, xLabel, yLabel, yMax, yTick, showValues } };
}

export function parseBoxPlotConfig(
  params: Record<string, string> = {},
): FigureConfigResult<BoxPlotConfig> {
  const errors: string[] = [];
  const entries = (params.series ?? params.data ?? "")
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean);
  if (entries.length < 1 || entries.length > 4) {
    errors.push("seriesは1〜4系列を指定してください。");
  }

  const series: BoxPlotSeries[] = [];
  for (const [index, entry] of entries.slice(0, 4).entries()) {
    const [labelText = "", valuesText = "", outliersText = ""] = entry.split("|").map((value) => value.trim());
    const label = safeFigureAxisLabel(labelText, `系列${index + 1}`, `系列${index + 1}の名前`, errors);
    const values = commaValues(valuesText).map(Number);
    if (values.length !== 5 || values.some((value) => !Number.isFinite(value))) {
      errors.push(`系列「${label}」は最小値、第1四分位数、中央値、第3四分位数、最大値の5数を指定してください。`);
      continue;
    }
    if (values.some((value, valueIndex) => valueIndex > 0 && value < values[valueIndex - 1])) {
      errors.push(`系列「${label}」の5数要約は小さい順に指定してください。`);
      continue;
    }
    const outliers = outliersText ? commaValues(outliersText).map(Number) : [];
    if (outliers.length > 12 || outliers.some((value) => !Number.isFinite(value))) {
      errors.push(`系列「${label}」の外れ値は有限の数値を12個以内で指定してください。`);
      continue;
    }
    if (outliers.some((value) => value >= values[0] && value <= values[4])) {
      errors.push(`系列「${label}」の外れ値は最小値より小さい値または最大値より大きい値にしてください。`);
      continue;
    }
    series.push({
      label,
      fiveNumber: values as [number, number, number, number, number],
      outliers,
    });
  }

  const allValues = series.flatMap((item) => [...item.fiveNumber, ...item.outliers]);
  const dataMin = Math.min(...allValues);
  const dataMax = Math.max(...allValues);
  const padding = Number.isFinite(dataMin) && dataMax > dataMin ? (dataMax - dataMin) * 0.08 : 1;
  const autoRange: [number, number] = [dataMin - padding, dataMax + padding];
  const range = params.range ? finitePair(params.range, autoRange, "range", errors) : autoRange;
  if (allValues.some((value) => value < range[0] || value > range[1])) {
    errors.push("rangeには5数要約と外れ値をすべて含めてください。");
  }

  const requestedTick = params["tick-step"] ? Number(params["tick-step"]) : undefined;
  let tickStep = requestedTick ?? Math.max(1, Math.ceil((range[1] - range[0]) / 6));
  if (!Number.isFinite(tickStep) || tickStep <= 0 || (range[1] - range[0]) / tickStep > 12) {
    errors.push("tick-stepは0より大きく、目盛りが12個以内になる値にしてください。");
    tickStep = Math.max(1, (range[1] - range[0]) / 6);
  }

  const axisLabel = safeFigureAxisLabel(params["axis-label"], "値", "axis-label", errors);
  const showValues = booleanValue(params["show-values"], series.length === 1, "show-values", errors);
  if (errors.length || !series.length) return { ok: false, errors };
  return { ok: true, config: { series, range, tickStep, axisLabel, showValues } };
}

function scatterAutoRange(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = min === max
    ? Math.max(1, Math.abs(min) * 0.1)
    : Math.max((max - min) * 0.08, 1e-6);
  return [min - padding, max + padding];
}

function scatterTick(
  raw: string | undefined,
  range: [number, number],
  label: string,
  errors: string[],
) {
  const requested = raw ? Number(raw) : undefined;
  let tick = requested ?? Math.max(1e-6, (range[1] - range[0]) / 5);
  if (!Number.isFinite(tick) || tick <= 0 || (range[1] - range[0]) / tick > 12) {
    errors.push(`${label}は0より大きく、目盛りが12個以内になる値にしてください。`);
    tick = Math.max(1e-6, (range[1] - range[0]) / 5);
  }
  return tick;
}

export function parseScatterPlotConfig(
  params: Record<string, string> = {},
): FigureConfigResult<ScatterPlotConfig> {
  const errors: string[] = [];
  const entries = (params.points ?? params.data ?? "")
    .split(";")
    .map((value) => value.trim())
    .filter(Boolean);
  if (entries.length < 1 || entries.length > 80) {
    errors.push("pointsは「x, y, 点名」の形で1〜80個指定してください。");
  }

  const points: ScatterPlotPoint[] = [];
  for (const [index, entry] of entries.slice(0, 80).entries()) {
    const parts = entry.split(",").map((value) => value.trim());
    if (parts.length < 2 || parts.length > 3) {
      errors.push(`点${index + 1}は「x, y」または「x, y, 点名」で指定してください。`);
      continue;
    }
    const x = Number(parts[0]);
    const y = Number(parts[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      errors.push(`点${index + 1}のxとyは有限の数値にしてください。`);
      continue;
    }
    const label = parts[2] ?? "";
    if (label.length > 12 || /[<>]/u.test(label)) {
      errors.push(`点${index + 1}の点名は12文字以内にし、< と > は使わないでください。`);
      continue;
    }
    points.push({ x, y, label });
  }

  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const fallbackXRange = points.length ? scatterAutoRange(xValues) : [0, 1] as [number, number];
  const fallbackYRange = points.length ? scatterAutoRange(yValues) : [0, 1] as [number, number];
  const xRange = params["x-range"] ? finitePair(params["x-range"], fallbackXRange, "x-range", errors) : fallbackXRange;
  const yRange = params["y-range"] ? finitePair(params["y-range"], fallbackYRange, "y-range", errors) : fallbackYRange;
  if (points.some((point) => point.x < xRange[0] || point.x > xRange[1])) {
    errors.push("x-rangeにはすべての点のx座標を含めてください。");
  }
  if (points.some((point) => point.y < yRange[0] || point.y > yRange[1])) {
    errors.push("y-rangeにはすべての点のy座標を含めてください。");
  }

  const xTick = scatterTick(params["x-tick"], xRange, "x-tick", errors);
  const yTick = scatterTick(params["y-tick"], yRange, "y-tick", errors);
  const xLabel = safeFigureAxisLabel(params["x-label"], "x", "x-label", errors);
  const yLabel = safeFigureAxisLabel(params["y-label"], "y", "y-label", errors);
  const showGrid = booleanValue(params["show-grid"], true, "show-grid", errors);
  const showLabels = booleanValue(params["show-labels"], true, "show-labels", errors);

  const trendType = (params["trend-line"] ?? "none").trim().toLowerCase();
  let trend: ScatterPlotTrend | undefined;
  if (trendType !== "none" && trendType !== "linear") {
    errors.push("trend-lineはnoneまたはlinearを指定してください。");
  } else if (trendType === "linear") {
    if (points.length < 2) {
      errors.push("linearの傾向線には2個以上の点が必要です。");
    } else {
      const meanX = xValues.reduce((sum, value) => sum + value, 0) / points.length;
      const meanY = yValues.reduce((sum, value) => sum + value, 0) / points.length;
      const denominator = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
      if (denominator <= Number.EPSILON) {
        errors.push("linearの傾向線には異なるx座標の点が必要です。");
      } else {
        const slope = points.reduce(
          (sum, point) => sum + (point.x - meanX) * (point.y - meanY),
          0,
        ) / denominator;
        const intercept = meanY - slope * meanX;
        const label = safeFigureAxisLabel(params["trend-label"], "傾向線", "trend-label", errors);
        trend = { slope, intercept, label };
      }
    }
  }

  if (errors.length || !points.length) return { ok: false, errors };
  return {
    ok: true,
    config: {
      points,
      xRange,
      yRange,
      xTick,
      yTick,
      xLabel,
      yLabel,
      showGrid,
      showLabels,
      trend,
    },
  };
}

function parseProbabilityShade(
  raw: string | undefined,
  distribution: "binomial" | "normal",
  range: [number, number],
  errors: string[],
): ProbabilityShade | undefined {
  const value = raw?.trim().toLowerCase();
  if (!value || value === "none") return undefined;

  let shade: ProbabilityShade | undefined;
  const pair = value.split(",").map((part) => part.trim());
  if (pair.length === 2 && (pair[0] === "left" || pair[0] === "right")) {
    const boundary = Number(pair[1]);
    if (!Number.isFinite(boundary)) {
      errors.push("shadeの境界は有限の数値にしてください。");
      return undefined;
    }
    shade = pair[0] === "left" ? { kind: "left", upper: boundary } : { kind: "right", lower: boundary };
  } else if (/^<=?/.test(value)) {
    const boundary = Number(value.replace(/^<=?/, ""));
    if (Number.isFinite(boundary)) shade = { kind: "left", upper: boundary };
  } else if (/^>=?/.test(value)) {
    const boundary = Number(value.replace(/^>=?/, ""));
    if (Number.isFinite(boundary)) shade = { kind: "right", lower: boundary };
  } else if (pair.length === 2) {
    const lower = Number(pair[0]);
    const upper = Number(pair[1]);
    if (Number.isFinite(lower) && Number.isFinite(upper) && lower <= upper) {
      shade = { kind: "interval", lower, upper };
    }
  }

  if (!shade) {
    errors.push("shadeは「下限, 上限」「left, 境界」「right, 境界」のいずれかで指定してください。");
    return undefined;
  }
  const boundaries = [shade.lower, shade.upper].filter((item): item is number => item !== undefined);
  if (boundaries.some((item) => item < range[0] || item > range[1])) {
    errors.push("shadeの境界はx-rangeの範囲内にしてください。");
  }
  if (distribution === "binomial" && boundaries.some((item) => !Number.isInteger(item))) {
    errors.push("二項分布のshade境界は整数にしてください。");
  }
  return shade;
}

export function parseProbabilityDistributionConfig(
  params: Record<string, string> = {},
): FigureConfigResult<ProbabilityDistributionConfig> {
  const errors: string[] = [];
  const distribution = (params.distribution ?? params.type ?? "").trim().toLowerCase();
  if (distribution !== "binomial" && distribution !== "normal") {
    return { ok: false, errors: ["distributionはbinomialまたはnormalを指定してください。"] };
  }

  let n: number | undefined;
  let p: number | undefined;
  let mean: number;
  let standardDeviation: number;
  let defaultRange: [number, number];

  if (distribution === "binomial") {
    n = Number(params.n);
    p = Number(params.p);
    if (!Number.isInteger(n) || n < 1 || n > 60) errors.push("nは1〜60の整数にしてください。");
    if (!Number.isFinite(p) || p <= 0 || p >= 1) errors.push("pは0より大きく1より小さい数にしてください。");
    const safeN = Number.isInteger(n) && n > 0 ? n : 1;
    const safeP = Number.isFinite(p) && p > 0 && p < 1 ? p : 0.5;
    mean = safeN * safeP;
    standardDeviation = Math.sqrt(safeN * safeP * (1 - safeP));
    defaultRange = [0, safeN];
  } else {
    mean = Number(params.mean);
    standardDeviation = Number(params.sd ?? params["standard-deviation"]);
    if (!Number.isFinite(mean)) errors.push("meanは有限の数値にしてください。");
    if (!Number.isFinite(standardDeviation) || standardDeviation <= 0) errors.push("sdは0より大きい数値にしてください。");
    const safeMean = Number.isFinite(mean) ? mean : 0;
    const safeSd = Number.isFinite(standardDeviation) && standardDeviation > 0 ? standardDeviation : 1;
    defaultRange = [safeMean - 4 * safeSd, safeMean + 4 * safeSd];
  }

  const xRange = params["x-range"]
    ? finitePair(params["x-range"], defaultRange, "x-range", errors)
    : defaultRange;
  if (distribution === "binomial" && (xRange[0] < 0 || xRange[1] > (n ?? 0))) {
    errors.push("二項分布のx-rangeは0からnまでの範囲にしてください。");
  }
  const requestedTick = params["x-tick"] ? Number(params["x-tick"]) : undefined;
  let xTick = requestedTick ?? (distribution === "binomial" ? Math.max(1, Math.ceil((xRange[1] - xRange[0]) / 10)) : (xRange[1] - xRange[0]) / 8);
  if (!Number.isFinite(xTick) || xTick <= 0 || (xRange[1] - xRange[0]) / xTick > 12) {
    errors.push("x-tickは0より大きく、目盛りが12個以内になる値にしてください。");
    xTick = Math.max(1e-6, (xRange[1] - xRange[0]) / 8);
  }
  if (distribution === "binomial" && !Number.isInteger(xTick)) errors.push("二項分布のx-tickは整数にしてください。");

  const shade = parseProbabilityShade(params.shade, distribution, xRange, errors);
  const xLabel = safeFigureAxisLabel(params["x-label"], distribution === "binomial" ? "成功回数" : "値", "x-label", errors);
  const showParameters = booleanValue(params["show-parameters"], true, "show-parameters", errors);

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    config: { distribution, n, p, mean, standardDeviation, xRange, xTick, xLabel, shade, showParameters },
  };
}

function makeBlock(
  type: BlockType,
  startLine: number,
  endLine: number,
  markdown: string,
  extras: Partial<StudioBlock> = {},
): StudioBlock {
  const breakPolicy =
    extras.breakPolicy ??
    (type === "paragraph" || type === "list" || type === "table" || type === "code"
      ? "flow"
      : "atomic");
  return {
    id: `block-${startLine}-${type}-${endLine}`,
    type,
    startLine,
    endLine,
    markdown,
    breakPolicy,
    ...extras,
  };
}

function startsSpecial(line: string, next = "") {
  return (
    /^#{1,4}\s/.test(line) ||
    /^:::[\w-]+/.test(line) ||
    /^```/.test(line) ||
    /^\$\$\s*$/.test(line) ||
    /^\\\[\s*$/.test(line) ||
    /^([-*_])\1{2,}\s*$/.test(line) ||
    /^(\s*[-*+]\s+|\s*\d+\.\s+)/.test(line) ||
    (line.includes("|") && /^\s*\|?[\s:|-]+\|/.test(next))
  );
}

function findMatchingExtensionClose(lines: string[], openIndex: number) {
  let nestedDepth = 0;
  for (let index = openIndex + 1; index < lines.length; index += 1) {
    const candidate = lines[index].trim();
    if (/^:::[\w-]+(?:\s|$)/u.test(candidate)) {
      nestedDepth += 1;
      continue;
    }
    if (candidate !== ":::") continue;
    if (nestedDepth === 0) return index;
    nestedDepth -= 1;
  }
  return -1;
}

function rebaseNestedBlocks(
  blocks: StudioBlock[],
  lineOffset: number,
  parentId: string,
): StudioBlock[] {
  return blocks.map((block, index) => {
    const rebasedStart = block.startLine + lineOffset;
    const rebasedEnd = block.endLine + lineOffset;
    const id = `${parentId}-child-${index + 1}-${rebasedStart}-${block.type}`;
    return {
      ...block,
      id,
      startLine: rebasedStart,
      endLine: rebasedEnd,
      children: block.children
        ? rebaseNestedBlocks(block.children, lineOffset, id)
        : undefined,
    };
  });
}

function rebaseNestedIssues(issues: Issue[], lineOffset: number, parentId: string) {
  return issues.map((issue, index) => ({
    ...issue,
    id: `${parentId}-issue-${index + 1}-${issue.id}`,
    line: issue.line + lineOffset,
  }));
}

function baseParse(source: string, allowFrontmatter = true) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const metadata = { ...DEFAULT_METADATA };
  const issues: Issue[] = [];
  let cursor = 0;

  if (allowFrontmatter && lines[0]?.trim() === "---") {
    const close = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
    if (close === -1) {
      issues.push({
        id: "frontmatter-open",
        severity: "error",
        line: 1,
        blockType: "metadata",
        title: "Front Matterが閉じられていません",
        reason: "先頭の「---」に対応する終了行がありません。",
        fix: "メタデータの末尾へ「---」を追加してください。",
      });
    } else {
      for (let index = 1; index < close; index += 1) {
        const match = lines[index].match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);
        if (!match) {
          if (lines[index].trim()) {
            issues.push({
              id: `metadata-${index + 1}`,
              severity: "warning",
              line: index + 1,
              blockType: "metadata",
              title: "メタデータの形式を確認してください",
              reason: "「項目名: 値」の形式として解釈できませんでした。",
              fix: '例: subject: "数学"',
            });
          }
          continue;
        }
        const key = match[1] as keyof Metadata;
        if (key in metadata) metadata[key] = stripQuotes(match[2]);
        else {
          issues.push({
            id: `metadata-unknown-${index + 1}`,
            severity: "warning",
            line: index + 1,
            blockType: "metadata",
            title: `未知のメタデータ「${match[1]}」です`,
            reason: "この項目は表示へ使用されません。",
            fix: "綴りを確認するか、そのまま残して運用できます。",
          });
        }
      }
      cursor = close + 1;
    }
  }

  const blocks: StudioBlock[] = [];
  while (cursor < lines.length) {
    const line = lines[cursor];
    const lineNumber = cursor + 1;
    if (!line.trim()) {
      cursor += 1;
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      if (heading[1].length === 1 && metadata.title === DEFAULT_METADATA.title) {
        metadata.title = heading[2].trim();
      }
      blocks.push(
        makeBlock("heading", lineNumber, lineNumber, heading[2], {
          level: heading[1].length,
          breakPolicy: "atomic",
        }),
      );
      cursor += 1;
      continue;
    }

    const extension = line.match(/^:::([\w-]+)(.*)$/);
    if (extension) {
      const name = extension[1];
      const attributes = parseAttributes(extension[2] ?? "");
      const close = findMatchingExtensionClose(lines, cursor);
      const end = close === -1 ? lines.length - 1 : close;
      const rawBody = lines.slice(cursor + 1, end).join("\n");
      const body = rawBody.trim();
      if (name === "page-break") {
        blocks.push(
          makeBlock("page-break", lineNumber, end + 1, "", {
            blockName: name,
            breakPolicy: "atomic",
          }),
        );
      } else {
        const nested = baseParse(rawBody, false);
        const parentId = `block-${lineNumber}-callout-${end + 1}`;
        blocks.push(
          makeBlock("callout", lineNumber, end + 1, body, {
            blockName: name,
            title: attributes.title,
            attributes,
            children: rebaseNestedBlocks(nested.blocks, lineNumber, parentId),
            breakPolicy: CONDITIONAL_BLOCKS.has(name) ? "conditional" : "flow",
            renderStatus: KNOWN_BLOCKS.has(name) ? "normal" : "warning",
          }),
        );
        issues.push(...rebaseNestedIssues(nested.issues, lineNumber, parentId));
      }
      if (close === -1) {
        issues.push({
          id: `extension-open-${lineNumber}`,
          severity: "error",
          line: lineNumber,
          blockType: name,
          title: `「${name}」ブロックが閉じられていません`,
          reason: "終了記号「:::」がありません。",
          fix: "ブロック末尾へ「:::」を追加してください。",
        });
      }
      if (!KNOWN_BLOCKS.has(name)) {
        issues.push({
          id: `unknown-block-${lineNumber}`,
          severity: "warning",
          line: lineNumber,
          blockType: name,
          title: `未知の教材ブロック「${name}」です`,
          reason: "汎用ボックスとして代替表示しました。",
          fix: "対応済みブロック名へ変更するか、そのまま汎用表示できます。",
          history: ["未知ブロックを検出", "汎用ブロックへ変換"],
        });
      }
      cursor = close === -1 ? lines.length : close + 1;
      continue;
    }

    const fence = line.match(/^```(.*)$/);
    if (fence) {
      const info = fence[1].trim();
      const close = lines.findIndex(
        (candidate, index) => index > cursor && candidate.trim() === "```",
      );
      const end = close === -1 ? lines.length - 1 : close;
      const raw = lines.slice(cursor + 1, end).join("\n");
      const figureInfo = info.match(/^figure\s+([\w-]+)/);
      if (figureInfo || info === "mermaid") {
        const figureType = figureInfo?.[1] ?? "mermaid";
        blocks.push(
          makeBlock("figure", lineNumber, end + 1, "", {
            figureType,
            params: figureType === "mermaid" ? {} : parseParams(raw),
            raw,
            breakPolicy: "atomic",
            renderStatus: FIGURE_TYPES.has(figureType) ? "normal" : "fallback",
          }),
        );
      } else {
        blocks.push(
          makeBlock("code", lineNumber, end + 1, raw, {
            blockName: info || "text",
            raw,
            breakPolicy: "flow",
          }),
        );
      }
      if (close === -1) {
        issues.push({
          id: `fence-open-${lineNumber}`,
          severity: "error",
          line: lineNumber,
          blockType: info || "code",
          title: "コードフェンスが閉じられていません",
          reason: "終了記号「```」がありません。",
          fix: "ブロック末尾へ「```」を追加してください。",
        });
      }
      cursor = close === -1 ? lines.length : close + 1;
      continue;
    }

    if (line.trim() === "$$" || line.trim() === "\\[") {
      const endMarker = line.trim() === "$$" ? "$$" : "\\]";
      const close = lines.findIndex(
        (candidate, index) => index > cursor && candidate.trim() === endMarker,
      );
      const end = close === -1 ? lines.length - 1 : close;
      const raw = lines.slice(cursor + 1, end).join("\n");
      blocks.push(
        makeBlock("math", lineNumber, end + 1, `$$\n${raw}\n$$`, {
          raw,
          breakPolicy: "atomic",
          renderStatus: close === -1 ? "fallback" : "normal",
        }),
      );
      if (close === -1) {
        issues.push({
          id: `math-open-${lineNumber}`,
          severity: "error",
          line: lineNumber,
          blockType: "math",
          title: "別行立て数式が閉じられていません",
          reason: `終了記号「${endMarker}」がありません。`,
          fix: `数式末尾へ「${endMarker}」を追加してください。`,
          history: ["通常描画を試行", "区切り不整合を検出", "原文表示へ切替"],
        });
      }
      cursor = close === -1 ? lines.length : close + 1;
      continue;
    }

    if (/^([-*_])\1{2,}\s*$/.test(line.trim())) {
      blocks.push(makeBlock("hr", lineNumber, lineNumber, "---"));
      cursor += 1;
      continue;
    }

    if (/^(\s*[-*+]\s+|\s*\d+\.\s+)/.test(line)) {
      const start = cursor;
      while (
        cursor < lines.length &&
        (/^(\s*[-*+]\s+|\s*\d+\.\s+)/.test(lines[cursor]) ||
          (/^\s{2,}\S/.test(lines[cursor]) && Boolean(lines[cursor].trim())))
      ) {
        cursor += 1;
      }
      blocks.push(
        makeBlock("list", start + 1, cursor, lines.slice(start, cursor).join("\n")),
      );
      continue;
    }

    if (
      line.includes("|") &&
      /^\s*\|?[\s:|-]+\|[\s:|-]*\|?\s*$/.test(lines[cursor + 1] ?? "")
    ) {
      const start = cursor;
      cursor += 2;
      while (cursor < lines.length && lines[cursor].includes("|") && lines[cursor].trim()) {
        cursor += 1;
      }
      blocks.push(
        makeBlock("table", start + 1, cursor, lines.slice(start, cursor).join("\n")),
      );
      continue;
    }

    const start = cursor;
    cursor += 1;
    while (
      cursor < lines.length &&
      lines[cursor].trim() &&
      !startsSpecial(lines[cursor], lines[cursor + 1] ?? "")
    ) {
      cursor += 1;
    }
    blocks.push(
      makeBlock("paragraph", start + 1, cursor, lines.slice(start, cursor).join("\n")),
    );
  }

  return { metadata, blocks, issues };
}

function countTableColumns(markdown: string) {
  return Math.max(
    0,
    ...markdown
      .split("\n")
      .map((line) => line.replace(/^\||\|$/g, "").split("|").length),
  );
}

export function flattenStudioBlocks(blocks: readonly StudioBlock[]): StudioBlock[] {
  const flattened: StudioBlock[] = [];
  const visit = (block: StudioBlock) => {
    flattened.push(block);
    for (const child of block.children ?? []) visit(child);
  };
  for (const block of blocks) visit(block);
  return flattened;
}

function validateDocument(parsed: ParsedDocument) {
  const issues = [...parsed.issues];
  const exercises = new Map<string, StudioBlock>();
  const solutions: StudioBlock[] = [];

  for (const block of flattenStudioBlocks(parsed.blocks)) {
    if (block.type === "callout" && block.blockName && block.attributes) {
      const knownAttributes = KNOWN_BLOCK_ATTRIBUTES[block.blockName];
      if (knownAttributes) {
        for (const attribute of Object.keys(block.attributes)) {
          if (knownAttributes.has(attribute)) continue;
          const suggested = ATTRIBUTE_TYPOS[attribute];
          issues.push({
            id: `attribute-unknown-${block.startLine}-${attribute}`,
            severity: "warning",
            line: block.startLine,
            blockType: block.blockName,
            title: `未知の属性名「${attribute}」です`,
            reason: suggested && knownAttributes.has(suggested)
              ? `「${suggested}」の入力間違いの可能性があります。`
              : "この属性は削除せず保持していますが、標準の表示処理では使用しません。",
            fix: suggested && knownAttributes.has(suggested)
              ? `属性名を「${suggested}」へ変更できます。`
              : "そのまま残すか、既知の属性へ手動で変更してください。",
          });
        }
      }
    }
    if (block.type === "math" && (block.raw?.length ?? 0) > 120) {
      issues.push({
        id: `long-math-${block.startLine}`,
        severity: "warning",
        line: block.startLine,
        blockType: "math",
        title: "長い数式を検出しました",
        reason: "本文幅を超える可能性があるため、描画後に90%・80%の順で縮小判定します。",
        fix: "意味を変えない範囲でaligned等を使い、式を論理行へ分けることを推奨します。",
        history: ["通常描画", "横幅実測", "MathJax折返し候補"],
      });
    }
    if (block.type === "table") {
      const columns = countTableColumns(block.markdown);
      if (columns > 15) {
        issues.push({
          id: `wide-table-${block.startLine}`,
          severity: "warning",
          line: block.startLine,
          blockType: "table",
          title: `${columns}列の横長表です`,
          reason: "A4本文幅へ収まらない可能性があります。",
          fix: "表を分けるか、列名・セル内容を短くしてください。",
          history: ["列幅再計算", "余白縮小候補", "文字縮小候補"],
        });
      }
    }
    if (block.type === "code") {
      const longest = Math.max(0, ...(block.raw ?? "").split("\n").map((line) => line.length));
      if (longest > 120) {
        issues.push({
          id: `long-code-${block.startLine}`,
          severity: "warning",
          line: block.startLine,
          blockType: "code",
          title: "非常に長いコード行を折り返します",
          reason: `${longest}文字の連続行を検出しました。`,
          fix: "意味を損なわない位置で改行すると読みやすくなります。",
          history: ["強制折返しを適用"],
        });
      }
    }
    if (block.type === "figure") {
      if (!FIGURE_TYPES.has(block.figureType ?? "")) {
        issues.push({
          id: `figure-unknown-${block.startLine}`,
          severity: "warning",
          line: block.startLine,
          blockType: "figure",
          title: `未対応の図表「${block.figureType}」です`,
          reason: "図表プラグインが登録されていません。",
          fix: "mermaid、function-graph、data-chart、number-line、sign-chart、triangle、circle、venn-diagram、tree-diagram、histogram、box-plot、scatter-plot、probability-distribution、imageのいずれかを指定してください。",
          history: ["プラグイン検索", "未登録", "代替表示へ切替"],
        });
      }
      if (block.figureType === "function-graph") {
        const result = parseFunctionGraphConfig(block.params);
        if (!result.ok) {
          issues.push({
            id: `figure-function-graph-${block.startLine}`,
            severity: "warning",
            line: block.startLine,
            blockType: "function-graph",
            title: "関数グラフの設定を確認してください",
            reason: result.errors.join(" "),
            fix: "formulaまたはfunctions、表示範囲、目盛り、点、補助線の値を確認してください。",
            history: ["関数グラフスキーマ検証", "代替表示へ切替"],
          });
        }
      }
      if (block.figureType === "number-line") {
        const result = parseNumberLineConfig(block.params);
        if (!result.ok) {
          issues.push({
            id: `figure-number-line-${block.startLine}`,
            severity: "warning",
            line: block.startLine,
            blockType: "number-line",
            title: "数直線の設定を確認してください",
            reason: result.errors.join(" "),
            fix: "range、interval、endpoints、pointsの値を確認してください。",
            history: ["数直線スキーマ検証", "代替表示へ切替"],
          });
        }
      }
      if (block.figureType === "sign-chart") {
        const result = parseSignChartConfig(block.params);
        if (!result.ok) {
          issues.push({
            id: `figure-sign-chart-${block.startLine}`,
            severity: "warning",
            line: block.startLine,
            blockType: "sign-chart",
            title: "符号表の設定を確認してください",
            reason: result.errors.join(" "),
            fix: "critical-pointsとsigns、またはrowsの個数・順序を確認してください。",
            history: ["符号表スキーマ検証", "代替表示へ切替"],
          });
        }
      }
      if (block.figureType === "triangle") {
        const result = parseTriangleConfig(block.params);
        if (!result.ok) {
          issues.push({
            id: `figure-triangle-${block.startLine}`,
            severity: "warning",
            line: block.startLine,
            blockType: "triangle",
            title: "三角形の設定を確認してください",
            reason: result.errors.join(" "),
            fix: "vertices、side-labels、angle-labels、right-angleの点名と値を確認してください。",
            history: ["三角形スキーマ検証", "代替表示へ切替"],
          });
        }
      }
      if (block.figureType === "circle") {
        const result = parseCircleConfig(block.params);
        if (!result.ok) {
          issues.push({
            id: `figure-circle-${block.startLine}`,
            severity: "warning",
            line: block.startLine,
            blockType: "circle",
            title: "円の設定を確認してください",
            reason: result.errors.join(" "),
            fix: "center、radius、points、segments、arcsの点名と値を確認してください。",
            history: ["円スキーマ検証", "代替表示へ切替"],
          });
        }
      }
      if (block.figureType === "venn-diagram") {
        const result = parseVennDiagramConfig(block.params);
        if (!result.ok) {
          issues.push({
            id: `figure-venn-diagram-${block.startLine}`,
            severity: "warning",
            line: block.startLine,
            blockType: "venn-diagram",
            title: "ベン図の設定を確認してください",
            reason: result.errors.join(" "),
            fix: "sets、shade、regionsの集合名と書式を確認してください。",
            history: ["ベン図スキーマ検証", "代替表示へ切替"],
          });
        }
      }
      if (block.figureType === "tree-diagram") {
        const result = parseTreeDiagramConfig(block.params);
        if (!result.ok) {
          issues.push({
            id: `figure-tree-diagram-${block.startLine}`,
            severity: "warning",
            line: block.startLine,
            blockType: "tree-diagram",
            title: "樹形図の設定を確認してください",
            reason: result.errors.join(" "),
            fix: "root、branches、nodes、resultsの点IDと書式を確認してください。",
            history: ["樹形図スキーマ検証", "代替表示へ切替"],
          });
        }
      }
      if (block.figureType === "histogram") {
        const result = parseHistogramConfig(block.params);
        if (!result.ok) {
          issues.push({
            id: `figure-histogram-${block.startLine}`,
            severity: "warning",
            line: block.startLine,
            blockType: "histogram",
            title: "ヒストグラムの設定を確認してください",
            reason: result.errors.join(" "),
            fix: "boundaries、frequencies、y-max、y-tickの個数と値を確認してください。",
            history: ["ヒストグラムスキーマ検証", "代替表示へ切替"],
          });
        }
      }
      if (block.figureType === "box-plot") {
        const result = parseBoxPlotConfig(block.params);
        if (!result.ok) {
          issues.push({
            id: `figure-box-plot-${block.startLine}`,
            severity: "warning",
            line: block.startLine,
            blockType: "box-plot",
            title: "箱ひげ図の設定を確認してください",
            reason: result.errors.join(" "),
            fix: "seriesの系列名、5数要約、外れ値、rangeの値を確認してください。",
            history: ["箱ひげ図スキーマ検証", "代替表示へ切替"],
          });
        }
      }
      if (block.figureType === "scatter-plot") {
        const result = parseScatterPlotConfig(block.params);
        if (!result.ok) {
          issues.push({
            id: `figure-scatter-plot-${block.startLine}`,
            severity: "warning",
            line: block.startLine,
            blockType: "scatter-plot",
            title: "散布図の設定を確認してください",
            reason: result.errors.join(" "),
            fix: "points、x-range、y-range、目盛り、trend-lineの値を確認してください。",
            history: ["散布図スキーマ検証", "代替表示へ切替"],
          });
        }
      }
      if (block.figureType === "probability-distribution") {
        const result = parseProbabilityDistributionConfig(block.params);
        if (!result.ok) {
          issues.push({
            id: `figure-probability-distribution-${block.startLine}`,
            severity: "warning",
            line: block.startLine,
            blockType: "probability-distribution",
            title: "確率分布図の設定を確認してください",
            reason: result.errors.join(" "),
            fix: "distribution、nとpまたはmeanとsd、x-range、x-tick、shadeの値を確認してください。",
            history: ["確率分布図スキーマ検証", "代替表示へ切替"],
          });
        }
      }
    }
    if (block.type === "callout" && block.blockName === "exercise") {
      const id = block.attributes?.id;
      if (id) {
        if (exercises.has(id)) {
          issues.push({
            id: `exercise-duplicate-${block.startLine}`,
            severity: "error",
            line: block.startLine,
            blockType: "exercise",
            title: `問題ID「${id}」が重複しています`,
            reason: `先に${exercises.get(id)?.startLine}行目で使用されています。`,
            fix: "問題ごとに一意のIDを指定してください。",
          });
        } else exercises.set(id, block);
      }
    }
    if (block.type === "callout" && block.blockName === "solution") solutions.push(block);
  }

  const solutionRefs = new Set<string>();
  const solutionCounts = new Map<string, number>();
  for (const solution of solutions) {
    const ref = solution.attributes?.for;
    if (!ref) continue;
    solutionRefs.add(ref);
    const nextCount = (solutionCounts.get(ref) ?? 0) + 1;
    solutionCounts.set(ref, nextCount);
    if (nextCount > 1) {
      issues.push({
        id: `solution-duplicate-${solution.startLine}`,
        severity: "error",
        line: solution.startLine,
        blockType: "solution",
        title: `問題「${ref}」に複数の解答があります`,
        reason: "同じexercise IDを参照するsolutionブロックが複数あります。",
        fix: "不要なsolutionを削除するか、正しい問題IDへ参照先を変更してください。",
      });
    }
    if (!exercises.has(ref)) {
      issues.push({
        id: `solution-orphan-${solution.startLine}`,
        severity: "error",
        line: solution.startLine,
        blockType: "solution",
        title: `解答の参照先「${ref}」が見つかりません`,
        reason: "対応するexerciseブロックが存在しません。",
        fix: "solutionのfor属性を既存の問題IDへ合わせてください。",
      });
    }
  }
  for (const [id, exercise] of exercises) {
    if (!solutionRefs.has(id)) {
      issues.push({
        id: `exercise-no-solution-${exercise.startLine}`,
        severity: "warning",
        line: exercise.startLine,
        blockType: "exercise",
        title: `問題「${id}」の解答がありません`,
        reason: "対応するsolutionブロックを確認できませんでした。",
        fix: `:::solution for="${id}" を追加してください。`,
      });
    }
  }

  if (!parsed.metadata.title || parsed.metadata.title === DEFAULT_METADATA.title) {
    issues.push({
      id: "title-default",
      severity: "info",
      line: 1,
      blockType: "metadata",
      title: "教材タイトルを既定値で補完しました",
      reason: "Front MatterのtitleとH1見出しがありません。",
      fix: "titleを指定すると出力ファイル名が分かりやすくなります。",
    });
  }
  return issues;
}

function validateSourceSyntax(source: string): Issue[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const frontMatterClose = lines[0]?.trim() === "---"
    ? lines.findIndex((line, index) => index > 0 && line.trim() === "---")
    : -1;
  const issues: Issue[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const isStructuredLine = /^:::[\w-]+/u.test(line) || (
      lines[0]?.trim() === "---" &&
      index > 0 &&
      (frontMatterClose === -1 || index < frontMatterClose) &&
      /^\s*[\w-]+\s*:/u.test(line)
    );
    if (!isStructuredLine) continue;
    const quoteCount = [...line].filter((character, position) =>
      character === "\"" && line[position - 1] !== "\\"
    ).length;
    if (quoteCount % 2 === 0) continue;
    issues.push({
      id: `quote-unclosed-${index + 1}`,
      severity: "error",
      line: index + 1,
      blockType: line.trimStart().startsWith(":::") ? "attribute" : "metadata",
      title: "引用符が閉じられていません",
      reason: "構造化された行に、対応する二重引用符がありません。",
      fix: "行末へ二重引用符を追加するか、入力内容を確認してください。",
    });
  }
  return issues;
}

export function parseDocument(source: string): ParsedDocument {
  const base = baseParse(source);
  const parsed: ParsedDocument = {
    ...base,
    issues: [...base.issues, ...validateSourceSyntax(source)],
  };
  return { ...parsed, issues: validateDocument(parsed) };
}

function sourceLines(source: string) {
  return source.replace(/\r\n?/g, "\n").split("\n");
}

function lineStartOffset(lines: string[], lineIndex: number) {
  let offset = 0;
  for (let index = 0; index < lineIndex; index += 1) offset += lines[index].length + 1;
  return offset;
}

export function listExerciseIds(source: string) {
  const ids: string[] = [];
  for (const line of sourceLines(source)) {
    const match = line.match(/^:::exercise\b[^\n]*\bid\s*=\s*"([^"]+)"/u);
    if (match && !ids.includes(match[1])) ids.push(match[1]);
  }
  return ids;
}

export function nextExerciseId(source: string) {
  const used = new Set(listExerciseIds(source));
  let number = 1;
  while (used.has(`q${String(number).padStart(3, "0")}`)) number += 1;
  return `q${String(number).padStart(3, "0")}`;
}

function uniqueExerciseId(source: string, currentId: string) {
  const used = new Set(listExerciseIds(source));
  const prefixMatch = currentId.match(/^([^\d]*)(\d+)$/u);
  const prefix = prefixMatch?.[1] || "q";
  const width = Math.max(3, prefixMatch?.[2].length ?? 3);
  let number = prefixMatch ? Number(prefixMatch[2]) + 1 : 1;
  let candidate = `${prefix}${String(number).padStart(width, "0")}`;
  while (used.has(candidate)) {
    number += 1;
    candidate = `${prefix}${String(number).padStart(width, "0")}`;
  }
  return candidate;
}

function quickFix(issue: Issue, kind: QuickFix["kind"], start: number, end: number, before: string, after: string, title: string): QuickFix {
  return { id: `quick-fix-${issue.id}`, issueId: issue.id, kind, line: issue.line, title, reason: issue.reason, start, end, before, after };
}

export function collectQuickFixes(source: string): QuickFix[] {
  const parsed = parseDocument(source);
  const lines = sourceLines(source);
  const fixes: QuickFix[] = [];
  for (const issue of parsed.issues) {
    if (issue.id === "frontmatter-open") {
      let insertLine = lines.length;
      for (let index = 1; index < lines.length; index += 1) {
        if (!lines[index].trim() || /^\s*[\w-]+\s*:\s*/u.test(lines[index])) continue;
        insertLine = index;
        break;
      }
      const start = insertLine < lines.length ? lineStartOffset(lines, insertLine) : source.length;
      const marker = start === source.length ? `${source && !source.endsWith("\n") ? "\n" : ""}---` : "---\n";
      fixes.push(quickFix(issue, "insert-marker", start, start, "", marker, "Front Matterを閉じる"));
      continue;
    }
    if (issue.id.startsWith("extension-open-")) {
      const marker = `${source && !source.endsWith("\n") ? "\n" : ""}:::`;
      fixes.push(quickFix(issue, "append-marker", source.length, source.length, "", marker, "教材ブロックを閉じる"));
      continue;
    }
    if (issue.id.startsWith("fence-open-")) {
      const marker = `${source && !source.endsWith("\n") ? "\n" : ""}\`\`\``;
      fixes.push(quickFix(issue, "append-marker", source.length, source.length, "", marker, "コードフェンスを閉じる"));
      continue;
    }
    if (issue.id.startsWith("quote-unclosed-")) {
      const lineIndex = Math.max(0, issue.line - 1);
      const rawLine = lines[lineIndex] ?? "";
      const start = lineStartOffset(lines, lineIndex) + rawLine.trimEnd().length;
      fixes.push(quickFix(issue, "close-quote", start, start, "", "\"", "引用符を閉じる"));
      continue;
    }
    if (issue.id.startsWith("exercise-duplicate-")) {
      const lineIndex = Math.max(0, issue.line - 1);
      const rawLine = lines[lineIndex] ?? "";
      const match = rawLine.match(/\bid\s*=\s*"([^"]+)"/u);
      if (!match || match.index === undefined) continue;
      const valueOffset = match.index + match[0].indexOf(match[1]);
      const start = lineStartOffset(lines, lineIndex) + valueOffset;
      const after = uniqueExerciseId(source, match[1]);
      fixes.push(quickFix(issue, "rename-id", start, start + match[1].length, match[1], after, "重複IDを一意にする"));
      continue;
    }
    if (issue.id.startsWith("attribute-unknown-")) {
      const attribute = issue.id.replace(/^attribute-unknown-\d+-/u, "");
      const suggested = ATTRIBUTE_TYPOS[attribute];
      if (!suggested || suggested === attribute) continue;
      const lineIndex = Math.max(0, issue.line - 1);
      const rawLine = lines[lineIndex] ?? "";
      const match = rawLine.match(new RegExp(`\\b${attribute}\\s*=`));
      if (!match || match.index === undefined) continue;
      const start = lineStartOffset(lines, lineIndex) + match.index;
      fixes.push(quickFix(issue, "rename-attribute", start, start + attribute.length, attribute, suggested, "属性名の入力間違いを直す"));
    }
  }
  return fixes;
}

export function applyQuickFix(source: string, fix: QuickFix) {
  if (fix.start < 0 || fix.end < fix.start || fix.end > source.length) return source;
  if (source.slice(fix.start, fix.end) !== fix.before) return source;
  return `${source.slice(0, fix.start)}${fix.after}${source.slice(fix.end)}`;
}

function editDistance(left: string, right: string) {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => index);
  for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
    let previous = rows[0];
    rows[0] = rightIndex;
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
      const current = rows[leftIndex];
      rows[leftIndex] = Math.min(rows[leftIndex] + 1, rows[leftIndex - 1] + 1, previous + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1));
      previous = current;
    }
  }
  return rows[left.length];
}

export function suggestKnownBlockNames(name: string) {
  return [...KNOWN_BLOCKS]
    .map((candidate) => ({ candidate, distance: editDistance(name, candidate) }))
    .sort((left, right) => left.distance - right.distance || left.candidate.localeCompare(right.candidate))
    .slice(0, 3)
    .map(({ candidate }) => candidate);
}

export function createRenderDocument(
  parsed: ParsedDocument,
  outputMode: OutputMode,
  includeQuestionInAnswer = true,
): RenderDocument {
  if (outputMode === "complete") {
    return { ...parsed, outputMode, includeQuestionInAnswer };
  }

  if (outputMode === "questions" || outputMode === "split") {
    return {
      ...parsed,
      blocks: parsed.blocks.filter((block) => block.blockName !== "solution"),
      outputMode,
      includeQuestionInAnswer,
    };
  }

  const exercises = new Map<string, StudioBlock>();
  for (const block of parsed.blocks) {
    if (block.blockName !== "exercise") continue;
    const exerciseId = block.attributes?.id;
    if (exerciseId && !exercises.has(exerciseId)) exercises.set(exerciseId, block);
  }

  const blocks: StudioBlock[] = [];
  for (const solution of parsed.blocks.filter((block) => block.blockName === "solution")) {
    const reference = solution.attributes?.for;
    const exercise = reference ? exercises.get(reference) : undefined;
    if (exercise) {
      if (includeQuestionInAnswer) {
        blocks.push({
          ...exercise,
          id: `answer-question-${solution.id}-${exercise.id}`,
          blockName: "answer-question",
          title: exercise.title || `問題 ${reference}`,
          attributes: {
            ...exercise.attributes,
            "reprinted-for": solution.id,
          },
          originBlockId: exercise.id,
          continuation: false,
        });
      } else {
        blocks.push({
          id: `answer-title-${solution.id}`,
          type: "heading",
          startLine: exercise.startLine,
          endLine: exercise.startLine,
          markdown: exercise.title || `問題 ${reference}`,
          level: 3,
          breakPolicy: "conditional",
          originBlockId: exercise.id,
        });
      }
    }
    blocks.push(solution);
  }

  return {
    ...parsed,
    blocks,
    outputMode,
    includeQuestionInAnswer,
  };
}

function isInternalTextHeading(source: string) {
  const trimmed = source.trim();
  return (
    /^#{1,6}[ \t]+\S[^\n]*$/u.test(trimmed) ||
    /^\*\*(?!\s)[^*\n](?:.*?[^*\n])?\*\*(?:[：:])?$/u.test(trimmed)
  );
}

export function isPaginationDecorative(block: StudioBlock) {
  return block.type === "page-break" || block.type === "hr" || (
    !block.children?.length &&
    !block.raw?.trim() &&
    !block.markdown.trim() &&
    block.type !== "figure" &&
    block.type !== "math" &&
    block.type !== "callout"
  );
}

export function meaningfulPaginationChildren(block: StudioBlock) {
  return (block.children ?? []).filter((child) => !isPaginationDecorative(child));
}

export function isPaginationHeadingLike(block: StudioBlock): boolean {
  if (
    block.type === "heading" ||
    (block.type === "paragraph" && isInternalTextHeading(block.markdown))
  ) return true;
  const children = meaningfulPaginationChildren(block);
  return children.length > 0 && children.every(isPaginationHeadingLike);
}

function paginationRoleForBlock(block: StudioBlock): PaginationSemanticRole {
  if (block.type === "page-break") return "manual-break";
  if (block.type === "hr" || isPaginationDecorative(block)) return "decoration";
  if (isPaginationHeadingLike(block)) return "heading";
  if (block.type === "math") return "formula";
  if (block.type === "figure") return "figure";
  if (block.type === "table") return "table";
  if (block.type === "list") return "list";
  if (block.type !== "callout") return "content";

  if (block.blockName === "exercise" || block.blockName === "example" || block.blockName === "answer-question") {
    return "problem";
  }
  if (block.blockName === "solution") return "solution";
  if (block.blockName === "explanation" || block.blockName === "definition") return "explanation";
  if (block.blockName === "key-point") return "point";
  if (block.blockName === "caution") return "warning";
  if (block.blockName === "summary" || block.blockName === "learning-goals") return "summary";
  return "container";
}

export function paginationConstraintFor(block: StudioBlock): PaginationConstraint {
  const role = paginationRoleForBlock(block);
  const headingLike = role === "heading";
  if (block.type === "page-break") {
    return {
      strategy: "manual",
      role,
      atomic: true,
      splittable: false,
      container: false,
      keepWithNext: false,
      keepWithPrevious: false,
      keepTogetherWhenFits: false,
      minimumFragment: { kind: "full" },
      preferredBreakPoints: ["block-boundary"],
      avoidBreakBefore: false,
      avoidBreakAfter: false,
    };
  }

  const container = block.type === "callout";
  const atomic = !container && block.breakPolicy === "atomic";
  const splittable = container || block.breakPolicy === "flow" || block.breakPolicy === "conditional";
  const preferredBreakPoints: PaginationConstraint["preferredBreakPoints"] =
    block.type === "paragraph" ? ["rendered-line", "block-boundary"] :
    block.type === "list" ? ["list-item", "block-boundary"] :
    block.type === "table" ? ["table-row", "block-boundary"] :
    block.type === "math" && (block.raw ?? "").includes("\\\\") ? ["equation-row"] :
    block.type === "callout" ? ["container-child", "block-boundary"] :
    ["block-boundary"];
  const minimumFragment: PaginationMinimumFragment =
    block.type === "paragraph"
      ? { kind: "rendered-lines", count: PAGINATION_CONFIG.minimumParagraphLinesAtBoundary }
      : block.type === "list"
        ? { kind: "first-list-item", count: 1 }
        : block.type === "table"
          ? { kind: "table-rows", count: PAGINATION_CONFIG.minimumTableRowsAtBoundary }
          : block.type === "callout"
            ? { kind: "first-container-child", count: 1 }
            : { kind: "full" };

  return {
    strategy: container ? "container" : headingLike ? "keep-with-next" : atomic ? "atomic" : "splittable",
    role,
    atomic,
    splittable,
    container,
    keepWithNext: headingLike,
    keepWithPrevious: false,
    keepTogetherWhenFits: role === "problem",
    minimumFragment,
    preferredBreakPoints,
    avoidBreakBefore: role === "formula" || role === "figure" || role === "list",
    avoidBreakAfter: headingLike,
  };
}

/** Exposes real, safe split points after the first rendered measurement pass. */
export function hasPreferredBreakPoints(
  block: StudioBlock,
  measurement?: BlockMeasurement,
) {
  if (block.type === "paragraph") {
    return (
      (measurement?.lineCount ?? 0) >= PAGINATION_CONFIG.minimumParagraphLinesAtBoundary * 2 &&
      Boolean(measurement?.lineBreakOffsets?.length)
    );
  }
  if (block.type === "list") {
    return (block.markdown.match(/^(?:\s*[-+*]\s+|\s*\d+[.)]\s+)/gmu) ?? []).length > 1;
  }
  if (block.type === "table") return block.markdown.split("\n").length > 3;
  if (block.type === "code") return (block.raw ?? block.markdown).includes("\n");
  if (block.type === "math") return (block.raw ?? "").includes("\\\\");
  if (block.type === "callout") return meaningfulPaginationChildren(block).length > 1;
  return false;
}

function markFragments(block: StudioBlock, fragments: StudioBlock[]): StudioBlock[] {
  if (fragments.length <= 1) {
    return fragments.map((fragment) => fragment.id === block.id
      ? { ...fragment, fragmentRole: "single" as const }
      : {
          ...fragment,
          originBlockId: block.originBlockId ?? block.id,
          fragmentIds: [fragment.id],
          fragmentIndex: 0,
          fragmentEndIndex: 0,
          fragmentCount: 1,
          fragmentRole: "single" as const,
        });
  }
  return fragments.map<StudioBlock>((fragment, index) => ({
    ...fragment,
    originBlockId: block.originBlockId ?? block.id,
    fragmentIds: [fragment.id],
    fragmentIndex: index,
    fragmentEndIndex: index,
    fragmentCount: fragments.length,
    fragmentRole: index === 0 ? "first" : index === fragments.length - 1 ? "last" : "middle",
    continuation: index > 0,
  }));
}

const MIN_PROSE_CANDIDATE_GRAPHEMES = 12;

function graphemes(source: string) {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
    return Array.from(segmenter.segment(source), ({ segment }) => segment);
  }
  return Array.from(source);
}

function visibleGraphemeCount(source: string) {
  return graphemes(source.replace(/\s+/gu, "")).length;
}

function normalizedVisibleText(source: string) {
  return source.replace(/\s+/gu, "").trim();
}

function splitAtMeasuredLines(source: string, measurement?: BlockMeasurement) {
  const offsets = measurement?.lineBreakOffsets ?? [];
  if (
    !offsets.length ||
    normalizedVisibleText(source) !== normalizedVisibleText(measurement?.textContent ?? "")
  ) return null;
  const cuts = [0, ...offsets.filter((offset) => offset > 0 && offset < source.length), source.length];
  const parts = cuts.slice(0, -1).map((start, index) => source.slice(start, cuts[index + 1]));
  return parts.length > 1 ? parts : null;
}

function splitProseCandidates(source: string, measurement?: BlockMeasurement) {
  const measuredLines = splitAtMeasuredLines(source, measurement);
  const sentenceBoundary =
    /[。！？](?:[」』】）》〕］｝〉》〗〙〛”’"'）)\]]*)|[.!?](?:["'”’)\]]*)(?=\s|$)/gu;
  const parts: string[] = measuredLines ? [...measuredLines] : [];
  if (!measuredLines) {
    let start = 0;
    for (const match of source.matchAll(sentenceBoundary)) {
      const end = (match.index ?? 0) + match[0].length;
      parts.push(source.slice(start, end));
      start = end;
    }
    if (start < source.length) parts.push(source.slice(start));
  }
  if (!parts.length) return [source];

  // A punctuation-only tail such as 「です。」 must never become a standalone
  // pagination candidate. This is a semantic guard only; DOM measurements,
  // not the character count, still decide which page receives each candidate.
  const balanced: string[] = [];
  for (const part of parts) {
    if (
      visibleGraphemeCount(part) < MIN_PROSE_CANDIDATE_GRAPHEMES &&
      balanced.length &&
      visibleGraphemeCount(balanced.at(-1) ?? "") < MIN_PROSE_CANDIDATE_GRAPHEMES
    ) {
      balanced[balanced.length - 1] += part;
    } else {
      balanced.push(part);
    }
  }
  if (
    balanced.length > 1 &&
    visibleGraphemeCount(balanced.at(-1) ?? "") < MIN_PROSE_CANDIDATE_GRAPHEMES
  ) {
    const tail = balanced.pop() ?? "";
    balanced[balanced.length - 1] += tail;
  }
  if (balanced.length > 1 && visibleGraphemeCount(balanced[0]) < MIN_PROSE_CANDIDATE_GRAPHEMES) {
    balanced[1] = balanced[0] + balanced[1];
    balanced.shift();
  }

  return balanced.filter((candidate) => candidate.length > 0);
}

function splitListCandidates(source: string, minimumItemsPerFragment = 1) {
  const lines = source.split("\n");
  const items: string[] = [];
  let current = "";
  for (const line of lines) {
    if (/^(?:\s*[-+*]\s+|\s*\d+[.)]\s+)/u.test(line) && current) {
      items.push(current);
      current = line;
    } else {
      current += `${current ? "\n" : ""}${line}`;
    }
  }
  if (current) items.push(current);
  if (items.length === 1) return splitProseCandidates(source);
  if (minimumItemsPerFragment <= 1) return items;

  const groups: string[][] = [];
  for (let index = 0; index < items.length;) {
    const remaining = items.length - index;
    const groupSize = remaining === minimumItemsPerFragment + 1
      ? remaining
      : Math.min(minimumItemsPerFragment, remaining);
    if (groupSize < minimumItemsPerFragment && groups.length) {
      groups[groups.length - 1].push(...items.slice(index));
      break;
    }
    groups.push(items.slice(index, index + groupSize));
    index += groupSize;
  }
  return groups.map((group) => group.join("\n"));
}

function sourceMarkdownForBlock(block: StudioBlock) {
  if (block.type === "heading") return `${"#".repeat(block.level ?? 2)} ${block.markdown}`;
  return block.markdown;
}

function splitTableCandidates(block: StudioBlock) {
  const rows = block.markdown.split("\n");
  if (rows.length <= 3) return [block];
  const [header, separator, ...body] = rows;
  return body.map((row, index) => ({
    ...block,
    id: `${block.id}-row-${index + 1}`,
    markdown: [header, separator, row].join("\n"),
    continuation: index > 0,
  }));
}

function splitAlignedMathCandidates(block: StudioBlock) {
  const raw = block.raw ?? "";
  const aligned = raw.match(/\\begin\{aligned\}([\s\S]*?)\\end\{aligned\}/u);
  const body = (aligned?.[1] ?? raw).trim();
  const rows = body.split(/\\\\(?:\[[^\]]*\])?\s*/u).map((row) => row.trim()).filter(Boolean);
  if (rows.length <= 1) return [block];
  return rows.map((row, index) => {
    const nextRaw = `\\begin{aligned}\n${row}\n\\end{aligned}`;
    return {
      ...block,
      id: `${block.id}-equation-${index + 1}`,
      raw: nextRaw,
      markdown: `$$\n${nextRaw}\n$$`,
      continuation: index > 0,
    };
  });
}

function splitCodeCandidates(block: StudioBlock) {
  const rows = (block.raw ?? block.markdown).split("\n");
  if (rows.length <= 1) return [block];
  return rows.map((row, index) => ({
    ...block,
    id: `${block.id}-line-${index + 1}`,
    raw: row,
    markdown: row,
    continuation: index > 0,
  }));
}

type SplitContext = {
  contentHeight?: number;
  minimumListItemsPerFragment?: number;
  measurements?: ReadonlyMap<string, BlockMeasurement>;
};

function splitLongBlock(
  block: StudioBlock,
  forceFlowSplit = false,
  context: SplitContext = {},
): StudioBlock[] {
  if (!forceFlowSplit) return [block];

  let fragments: StudioBlock[] = [block];
  if (block.type === "paragraph") {
    const parts = splitProseCandidates(block.markdown, context.measurements?.get(block.id));
    if (parts.length <= 1) return [block];
    fragments = parts.map((markdown, index) => ({
      ...block,
      id: `${block.id}-prose-${index + 1}`,
      markdown,
      continuation: index > 0,
    }));
  } else if (block.type === "list") {
    const items = splitListCandidates(
      block.markdown,
      context.minimumListItemsPerFragment,
    );
    if (items.length <= 1) return [block];
    fragments = items.map((markdown, index) => ({
      ...block,
      id: `${block.id}-item-${index + 1}`,
      markdown,
      continuation: index > 0,
    }));
  } else if (block.type === "table") {
    fragments = splitTableCandidates(block);
  } else if (block.type === "math" && (block.raw ?? "").includes("\\\\")) {
    fragments = splitAlignedMathCandidates(block);
  } else if (block.type === "code") {
    fragments = splitCodeCandidates(block);
  } else if (block.type === "callout") {
    const problemContainer = paginationRoleForBlock(block) === "problem";
    const parsedChildren = block.children?.length
      ? block.children
      : rebaseNestedBlocks(baseParse(block.markdown, false).blocks, block.startLine, block.id);
    const childFragments = parsedChildren.flatMap((child) => {
      if (child.breakPolicy === "atomic" && child.type !== "heading") return [child];
      const childMeasurement = context.measurements?.get(child.id);
      const measuredHeight = childMeasurement?.height;
      const needsInternalSplit = context.contentHeight === undefined || measuredHeight === undefined
        ? true
        : measuredHeight > context.contentHeight + 1 || hasPreferredBreakPoints(child, childMeasurement);
      return needsInternalSplit
        ? splitLongBlock(child, true, {
            ...context,
            minimumListItemsPerFragment: problemContainer
              ? PAGINATION_CONFIG.minimumProblemChoiceItemsAtBoundary
              : context.minimumListItemsPerFragment,
          })
        : [child];
    });
    if (childFragments.length === 1 && !childFragments[0].originBlockId) {
      return [{ ...block, children: parsedChildren }];
    }
    const childGroups: StudioBlock[][] = [];
    for (let index = 0; index < childFragments.length; index += 1) {
      const child = childFragments[index];
      const next = childFragments[index + 1];
      if (
        next &&
        (child.type === "heading" || (child.type === "paragraph" && isInternalTextHeading(child.markdown)))
      ) {
        childGroups.push([child, next]);
        index += 1;
      } else {
        childGroups.push([child]);
      }
    }
    fragments = childGroups.map((children, index) => ({
      ...block,
      id: `${block.id}-container-${index + 1}`,
      markdown: children.map(sourceMarkdownForBlock).join("\n\n"),
      children,
      continuation: index > 0,
    }));
  }

  return markFragments(block, fragments);
}

function canMergePageFragments(previous: StudioBlock, next: StudioBlock) {
  return (
    previous.type === next.type &&
    previous.originBlockId !== undefined &&
    previous.originBlockId === next.originBlockId &&
    (previous.fragmentEndIndex ?? previous.fragmentIndex ?? -1) + 1 ===
      (next.fragmentIndex ?? -2)
  );
}

function mergeTableMarkdown(previous: string, next: string) {
  const firstRows = previous.split("\n");
  const nextRows = next.split("\n");
  if (firstRows.length < 2 || nextRows.length < 3) return `${previous}\n${next}`;
  return [...firstRows, ...nextRows.slice(2)].join("\n");
}

function alignedRows(raw: string) {
  const match = raw.match(/\\begin\{aligned\}([\s\S]*?)\\end\{aligned\}/u);
  return (match?.[1] ?? raw).trim();
}

function fragmentRoleForRange(start: number, end: number, count: number) {
  if (start === 0 && end === count - 1) return "single" as const;
  if (start === 0) return "first" as const;
  if (end === count - 1) return "last" as const;
  return "middle" as const;
}

function mergeFragmentPair(previous: StudioBlock, block: StudioBlock): StudioBlock {
  const fragmentIds = [
    ...(previous.fragmentIds ?? [previous.id]),
    ...(block.fragmentIds ?? [block.id]),
  ];
  const fragmentIndex = previous.fragmentIndex ?? 0;
  const fragmentEndIndex = block.fragmentEndIndex ?? block.fragmentIndex ?? fragmentIndex;
  const fragmentCount = Math.max(
    previous.fragmentCount ?? fragmentEndIndex + 1,
    block.fragmentCount ?? fragmentEndIndex + 1,
  );
  let markdown = `${previous.markdown}${block.markdown}`;
  let raw = previous.raw;
  let children = previous.children;

  if (previous.type === "list") markdown = `${previous.markdown}\n${block.markdown}`;
  if (previous.type === "table") markdown = mergeTableMarkdown(previous.markdown, block.markdown);
  if (previous.type === "code") {
    raw = `${previous.raw ?? previous.markdown}\n${block.raw ?? block.markdown}`;
    markdown = raw;
  }
  if (previous.type === "math") {
    const rows = `${alignedRows(previous.raw ?? previous.markdown)} \\\\\n${alignedRows(block.raw ?? block.markdown)}`;
    raw = `\\begin{aligned}\n${rows}\n\\end{aligned}`;
    markdown = `$$\n${raw}\n$$`;
  }
  if (previous.type === "callout") {
    children = mergePageFragments([...(previous.children ?? []), ...(block.children ?? [])]);
    markdown = children.map(sourceMarkdownForBlock).join("\n\n");
  }

  return {
    ...previous,
    id: `${previous.originBlockId}-parts-${fragmentIndex + 1}-${fragmentEndIndex + 1}`,
    markdown,
    raw,
    children,
    fragmentIds,
    fragmentIndex,
    fragmentEndIndex,
    fragmentCount,
    fragmentRole: fragmentRoleForRange(fragmentIndex, fragmentEndIndex, fragmentCount),
    continuation: fragmentIndex > 0,
    paginationLineCount:
      (previous.paginationLineCount ?? 0) + (block.paginationLineCount ?? 0),
  };
}

function mergePageFragments(blocks: StudioBlock[]) {
  const merged: StudioBlock[] = [];

  for (const block of blocks) {
    const previous = merged.at(-1);
    if (!previous || !canMergePageFragments(previous, block)) {
      merged.push(block);
      continue;
    }
    merged[merged.length - 1] = mergeFragmentPair(previous, block);
  }

  return merged;
}

export function prepareBlocksForMeasurement(
  preparedBlocks: StudioBlock[],
  pages: PageModel[] | null,
  excludedGroupIds: ReadonlySet<string> = new Set(),
) {
  if (!pages) return preparedBlocks;

  const groupByFragmentId = new Map<string, StudioBlock>();
  const firstFragmentIds = new Set<string>();
  for (const block of pages.flatMap((page) => page.blocks)) {
    const fragmentIds = block.fragmentIds ?? [];
    if (fragmentIds.length <= 1) continue;
    firstFragmentIds.add(fragmentIds[0]);
    for (const fragmentId of fragmentIds) groupByFragmentId.set(fragmentId, block);
  }

  if (!groupByFragmentId.size) return preparedBlocks;

  const measurementBlocks: StudioBlock[] = [];
  for (const block of preparedBlocks) {
    if (block.type === "page-break") {
      measurementBlocks.push(block);
      continue;
    }
    const group = groupByFragmentId.get(block.id);
    if (!group || excludedGroupIds.has(group.id)) {
      measurementBlocks.push(block);
    } else if (firstFragmentIds.has(block.id)) {
      measurementBlocks.push(group);
    }
  }
  return measurementBlocks;
}

export function prepareBlocksForPagination(
  blocks: StudioBlock[],
  forcedFlowSplitIds: ReadonlySet<string> = new Set(),
  splitMeasurements?: ReadonlyMap<string, BlockMeasurement>,
  contentHeight?: number,
) {
  const prepared: StudioBlock[] = [];
  const splitIds = new Set<string>();

  for (const block of blocks) {
    if (block.type === "page-break") {
      prepared.push(block);
      continue;
    }
    const parts = splitLongBlock(block, forcedFlowSplitIds.has(block.id), {
      contentHeight,
      measurements: splitMeasurements,
    });
    if (parts.length > 1) splitIds.add(block.id);
    prepared.push(...parts);
  }

  return { blocks: prepared, splitIds };
}

export function paginateMeasuredDocument(
  preparedBlocks: StudioBlock[],
  measuredHeights: ReadonlyMap<string, number | BlockMeasurement>,
  contentHeight: number,
  includeCover = false,
  options: PaginationOptions = {},
) {
  const blockGap = PAGINATION_CONFIG.blockGapPx;
  const preparedBlockById = new Map(
    preparedBlocks.map((block) => [block.id, block] as const),
  );
  // Preserve a two-gap rounding reserve for the final merged Page DOM. DOM
  // rects can carry fractional pixels while scrollHeight rounds upward.
  const measuredContentHeight = options.pageGeometry?.usableHeight ?? contentHeight;
  const safeContentHeight = Math.max(
    1,
    measuredContentHeight - blockGap * PAGINATION_CONFIG.bodyRoundingReserveGaps,
  );
  const pageDomContentHeight = options.pageGeometry
    ? Math.max(
        1,
        options.pageGeometry.pageContentBottom -
          options.pageGeometry.contentTop -
          blockGap * PAGINATION_CONFIG.bodyRoundingReserveGaps,
      )
    : safeContentHeight;

  const measurementOf = (block: StudioBlock): BlockMeasurement => {
    const measured = measuredHeights.get(block.id);
    if (typeof measured === "number") {
      return { height: measured, width: 0, clientWidth: 0, lineCount: 0 };
    }
    if (measured) return measured;
    return {
      // Missing measurements are never replaced with a text-length guess.
      // Treat the node conservatively as one full body area until the DOM
      // measurement pass supplies its real dimensions.
      height: safeContentHeight,
      width: 0,
      clientWidth: 0,
      lineCount: 0,
    };
  };

  const strategyFor = (block: StudioBlock) => paginationConstraintFor(block).strategy;

  const firstMeaningfulLeaf = (block: StudioBlock): StudioBlock => {
    const child = meaningfulPaginationChildren(block)[0];
    return child ? firstMeaningfulLeaf(child) : block;
  };
  const lastMeaningfulLeaf = (block: StudioBlock): StudioBlock => {
    const child = meaningfulPaginationChildren(block).at(-1);
    return child ? lastMeaningfulLeaf(child) : block;
  };
  const lineCountOf = (block: StudioBlock): number => {
    const direct = measurementOf(block).lineCount;
    if (direct > 0) return direct;
    return meaningfulPaginationChildren(block)
      .reduce((total, child) => total + lineCountOf(child), 0);
  };

  const atomicPairScales = new Map<string, number>();
  const effectiveScaleOf = (block: StudioBlock) => Math.min(
    block.paginationScale ?? 1,
    atomicPairScales.get(block.id) ?? 1,
  );
  const heightOf = (block: StudioBlock) =>
    measurementOf(block).height * effectiveScaleOf(block);
  const placementHeightOf = (block: StudioBlock, currentPageBlocks: StudioBlock[]) => {
    const measurement = measurementOf(block);
    const containerContentHeight = measurement.containerContentHeight ?? measurement.height;
    const tableBodyHeight = measurement.tableBodyHeight ?? measurement.height;
    const listBodyHeight = measurement.listBodyHeight ?? measurement.height;
    const previous = currentPageBlocks.at(-1);
    const continuesContainerOnPage =
      block.type === "callout" &&
      Boolean(block.originBlockId) &&
      previous?.type === "callout" &&
      previous.originBlockId === block.originBlockId &&
      measurement.containerContentHeight !== undefined;
    const continuesTableOnPage =
      block.type === "table" &&
      Boolean(block.originBlockId) &&
      previous?.type === "table" &&
      previous.originBlockId === block.originBlockId &&
      measurement.tableBodyHeight !== undefined;
    const continuesListOnPage =
      block.type === "list" &&
      Boolean(block.originBlockId) &&
      previous?.type === "list" &&
      previous.originBlockId === block.originBlockId &&
      measurement.listBodyHeight !== undefined;
    const nestedMergedChildContribution = (() => {
      if (!continuesContainerOnPage || !previous || measurement.containerContentHeight === undefined) {
        return null;
      }
      const previousChildren = meaningfulPaginationChildren(previous);
      const currentChildren = meaningfulPaginationChildren(block);
      if (currentChildren.length !== 1) return null;
      const previousChild = previousChildren.at(-1);
      const currentChild = currentChildren[0];
      if (!previousChild || !canMergePageFragments(previousChild, currentChild)) return null;

      const childMeasurement = measurementOf(currentChild);
      if (currentChild.type === "list" && childMeasurement.listBodyHeight !== undefined) {
        return Math.max(
          0,
            containerContentHeight -
            childMeasurement.height +
            childMeasurement.listBodyHeight +
            (childMeasurement.listMergeGapHeight ?? 0) -
            blockGap,
        );
      }
      if (currentChild.type === "table" && childMeasurement.tableBodyHeight !== undefined) {
        return Math.max(
          0,
            containerContentHeight -
            childMeasurement.height +
            childMeasurement.tableBodyHeight -
            blockGap,
        );
      }
      return null;
    })();
    return (
      continuesContainerOnPage
        // The caller's normal top-level gap becomes the nested child gap when
        // adjacent container fragments are reconstructed as one Page DOM box.
        // Remove the previous fragment's continuation marker and add the new
        // one only when the reconstructed fragment still continues.
        ? Math.max(
            0,
            (nestedMergedChildContribution ?? (
              containerContentHeight +
              (measurement.containerContinuationAdjustmentHeight ?? 0)
            )) +
              (measurement.continuationMarkerHeight ?? 0) -
              (previous ? measurementOf(previous).continuationMarkerHeight ?? 0 : 0),
          )
        : continuesTableOnPage
          // Each safe row candidate is measured with its own wrapper and
          // repeated thead. Adjacent rows are merged into one table in the
          // final Page DOM, so only the tbody contribution is incremental.
          // The caller already adds the normal block gap; subtract it here
          // so the combined contribution remains the real row height.
          ? Math.max(0, tableBodyHeight - blockGap)
          : continuesListOnPage
            // Adjacent list fragments become one list. Keep only the new
            // items and their real collapsed item margin, not another list wrapper.
            ? Math.max(
                0,
                listBodyHeight +
                  (measurement.listMergeGapHeight ?? 0) -
                  blockGap,
              )
          : measurement.height
    ) * effectiveScaleOf(block);
  };

  const scaledAtomic = (block: StudioBlock) => {
    const measurement = measurementOf(block);
    const verticalScale = measurement.height > safeContentHeight
      ? safeContentHeight / Math.max(1, measurement.height)
      : 1;
    const horizontalScale = measurement.clientWidth > 0 && measurement.width > measurement.clientWidth
      ? measurement.clientWidth / measurement.width
      : 1;
    const scale = Math.min(
      effectiveScaleOf(block),
      verticalScale,
      horizontalScale,
    );
    if (scale >= 0.999) return block;
    return {
      ...block,
      paginationScale: Math.max(0.1, scale),
      paginationOriginalHeight: measurement.height,
      paginationLineCount: measurement.lineCount,
      paginationError: scale < (block.type === "figure" ? 0.7 : 0.8)
        ? `推奨最小倍率を下回るため${Math.round(scale * 100)}%へ縮小しました。`
        : undefined,
    };
  };

  const findNextMeaningfulContent = (startIndex: number) => {
    const start = preparedBlocks[startIndex];
    const mayBridgeHeadings = isPaginationHeadingLike(start);
    const bridge: Array<{ block: StudioBlock; index: number }> = [];
    const manualBreakIndexes: number[] = [];
    for (let index = startIndex + 1; index < preparedBlocks.length; index += 1) {
      const candidate = preparedBlocks[index];
      if (candidate.type === "page-break") {
        if (!mayBridgeHeadings) return null;
        manualBreakIndexes.push(index);
        continue;
      }
      if (
        isPaginationDecorative(candidate) ||
        (mayBridgeHeadings && isPaginationHeadingLike(candidate))
      ) {
        bridge.push({ block: candidate, index });
        continue;
      }
      return { block: candidate, index, bridge, manualBreakIndexes };
    }
    return null;
  };

  const minimumFollowerHeight = (
    followerIndex: number,
    precedingBlocks: StudioBlock[] = [],
  ) => {
    const follower = preparedBlocks[followerIndex];
    const constraint = paginationConstraintFor(follower);
    if (!follower.originBlockId || (follower.fragmentCount ?? 1) <= 1) {
      return placementHeightOf(follower, precedingBlocks);
    }
    if (constraint.minimumFragment.kind !== "rendered-lines") {
      return placementHeightOf(follower, precedingBlocks);
    }

    let height = 0;
    let lines = 0;
    const simulatedPage = [...precedingBlocks];
    for (let index = followerIndex; index < preparedBlocks.length; index += 1) {
      const fragment = preparedBlocks[index];
      if (fragment.originBlockId !== follower.originBlockId || fragment.type !== "paragraph") break;
      height += (height > 0 ? blockGap : 0) + placementHeightOf(fragment, simulatedPage);
      simulatedPage.push(fragment);
      lines += Math.max(1, measurementOf(fragment).lineCount);
      if (lines >= constraint.minimumFragment.count) break;
    }
    return height || heightOf(follower);
  };

  const lastMeaningfulIndex = (blocks: StudioBlock[]) => {
    for (let index = blocks.length - 1; index >= 0; index -= 1) {
      if (!isPaginationDecorative(blocks[index])) return index;
    }
    return -1;
  };
  const firstMeaningfulIndex = (blocks: StudioBlock[]) => {
    for (let index = 0; index < blocks.length; index += 1) {
      if (!isPaginationDecorative(blocks[index])) return index;
    }
    return -1;
  };
  const sameFragmentGroup = (left: StudioBlock, right: StudioBlock) =>
    Boolean(left.originBlockId) && left.originBlockId === right.originBlockId;

  const semanticPairReason = (
    left: StudioBlock,
    right: StudioBlock,
  ): PaginationBreakReason | null => {
    const leftConstraint = paginationConstraintFor(left);
    const rightConstraint = paginationConstraintFor(right);
    if (leftConstraint.keepWithNext) return "keepWithNext";
    if (rightConstraint.keepWithPrevious) return "keepWithPrevious";

    const leftLeaf = lastMeaningfulLeaf(left);
    const rightLeaf = firstMeaningfulLeaf(right);
    if (isPaginationHeadingLike(leftLeaf)) return "keepWithNext";
    if (
      sameFragmentGroup(left, right) &&
      leftConstraint.role === "problem" &&
      leftLeaf.type === "paragraph" &&
      (
        rightLeaf.type === "list" ||
        rightLeaf.type === "figure" ||
        rightLeaf.type === "math" ||
        rightLeaf.type === "table"
      )
    ) {
      return "minimumFragment";
    }
    if (
      leftLeaf.type === "paragraph" &&
      (rightLeaf.type === "math" || rightLeaf.type === "figure") &&
      (
        lineCountOf(leftLeaf) <= PAGINATION_CONFIG.minimumParagraphLinesAtBoundary ||
        Boolean(left.fragmentCount && left.fragmentCount > 1)
      )
    ) {
      return "keepWithPrevious";
    }
    return null;
  };

  const sequenceHeight = (blocks: StudioBlock[]) => {
    let total = 0;
    const placed: StudioBlock[] = [];
    for (const block of blocks) {
      total += (placed.length ? blockGap : 0) + placementHeightOf(block, placed);
      placed.push(block);
    }
    return total;
  };

  const groupedBoundaryCount = (
    blocks: StudioBlock[],
    fromStart: boolean,
    type: "paragraph" | "table",
  ) => {
    const ordered = fromStart ? blocks : [...blocks].reverse();
    const first = ordered.find((block) => !isPaginationDecorative(block));
    if (!first || first.type !== type || !first.originBlockId) return 0;
    let total = 0;
    for (const block of ordered) {
      if (isPaginationDecorative(block)) continue;
      if (block.type !== type || block.originBlockId !== first.originBlockId) break;
      total += type === "paragraph" ? Math.max(1, lineCountOf(block)) : 1;
    }
    return total;
  };

  const pageBreakBadness = (
    left: StudioBlock[],
    right: StudioBlock[],
    leftHeight: number,
    movedCount: number,
  ) => {
    const leftIndex = lastMeaningfulIndex(left);
    const rightIndex = firstMeaningfulIndex(right);
    if (leftIndex < 0 || rightIndex < 0) return 10000;
    const previous = left[leftIndex];
    const next = right[rightIndex];
    const previousConstraint = paginationConstraintFor(previous);
    const nextConstraint = paginationConstraintFor(next);
    const whitespaceRatio = Math.max(0, safeContentHeight - leftHeight) / safeContentHeight;
    const weights = PAGINATION_CONFIG.badness;
    let badness =
      whitespaceRatio * weights.whitespaceWeight +
      movedCount * weights.movedNodeWeight;

    if (whitespaceRatio > PAGINATION_CONFIG.hugeWhitespaceRatio) {
      badness +=
        weights.hugeWhitespaceBase +
        (whitespaceRatio - PAGINATION_CONFIG.hugeWhitespaceRatio) * weights.hugeWhitespaceWeight;
    }
    if (semanticPairReason(previous, next)) badness += weights.semanticSplit;
    if (isPaginationHeadingLike(previous)) badness += weights.orphanHeading;
    if (previousConstraint.avoidBreakAfter) badness += weights.avoidBreakAfter;
    // A figure, formula or list may naturally begin a page. Penalize this only
    // inside the same semantic source unit; otherwise the preference can move
    // several unrelated blocks and create a much larger blank area.
    if (nextConstraint.avoidBreakBefore && sameFragmentGroup(previous, next)) {
      badness += weights.avoidBreakBefore;
    }

    if (
      sameFragmentGroup(previous, next) &&
      previousConstraint.role === "problem" &&
      (
        lastMeaningfulLeaf(previous).type === "list" ||
        firstMeaningfulLeaf(next).type === "list"
      )
    ) {
      badness += weights.problemChoiceSplit;
    }

    if (sameFragmentGroup(previous, next) && previous.type === "paragraph" && next.type === "paragraph") {
      const tailLines = groupedBoundaryCount(left, false, "paragraph");
      const headLines = groupedBoundaryCount(right, true, "paragraph");
      if (tailLines < PAGINATION_CONFIG.minimumParagraphLinesAtBoundary) badness += weights.paragraphWidow;
      if (headLines < PAGINATION_CONFIG.minimumParagraphLinesAtBoundary) badness += weights.paragraphWidow;
    }
    if (sameFragmentGroup(previous, next) && previous.type === "table" && next.type === "table") {
      const tailRows = groupedBoundaryCount(left, false, "table");
      const headRows = groupedBoundaryCount(right, true, "table");
      if (tailRows < PAGINATION_CONFIG.minimumTableRowsAtBoundary) badness += weights.tableWidow;
      if (headRows < PAGINATION_CONFIG.minimumTableRowsAtBoundary) badness += weights.tableWidow;
    }
    if (
      previousConstraint.preferredBreakPoints.includes("block-boundary") &&
      nextConstraint.preferredBreakPoints.includes("block-boundary") &&
      !sameFragmentGroup(previous, next)
    ) {
      badness -= weights.preferredBoundaryBonus;
    }
    return badness;
  };

  const keepTogetherGroupAt = (startIndex: number) => {
    const first = preparedBlocks[startIndex];
    const constraint = paginationConstraintFor(first);
    if (
      !constraint.keepTogetherWhenFits ||
      !first.originBlockId ||
      (first.fragmentIndex ?? 0) !== 0 ||
      (first.fragmentCount ?? 1) <= 1
    ) return null;

    const blocks: StudioBlock[] = [];
    for (let index = startIndex; index < preparedBlocks.length; index += 1) {
      const candidate = preparedBlocks[index];
      if (candidate.type === "page-break" || candidate.originBlockId !== first.originBlockId) break;
      blocks.push(candidate);
    }
    if (blocks.length <= 1) return null;
    return { blocks, height: sequenceHeight(blocks) };
  };

  const chooseBreakCandidate = (
    pageBlocks: StudioBlock[],
    incoming: StudioBlock,
  ) => {
    const firstCut = Math.max(
      1,
      pageBlocks.length - PAGINATION_CONFIG.breakCandidateLookBehind,
    );
    let best: {
      cut: number;
      badness: number;
      leftHeight: number;
      rightHeight: number;
    } | null = null;
    for (let cut = firstCut; cut <= pageBlocks.length; cut += 1) {
      const left = pageBlocks.slice(0, cut);
      const right = [...pageBlocks.slice(cut), incoming];
      const leftHeight = sequenceHeight(left);
      const rightHeight = sequenceHeight(right);
      if (rightHeight > safeContentHeight + PAGINATION_CONFIG.overflowTolerancePx) continue;
      const badness = pageBreakBadness(
        left,
        right,
        leftHeight,
        pageBlocks.length - cut,
      );
      if (
        !best ||
        badness < best.badness - 0.01 ||
        (Math.abs(badness - best.badness) <= 0.01 && cut > best.cut)
      ) {
        best = { cut, badness, leftHeight, rightHeight };
      }
    }
    return best;
  };

  type RawPage = {
    blocks: StudioBlock[];
    debug?: PaginationDebugRecord;
  };

  const runPaginationPass = (
    forcedBreaks: ReadonlyMap<string, PaginationBreakReason>,
  ) => {
    const rawPages: RawPage[] = [];
    const suppressedManualBreaks = new Set<number>();
    let pageBlocks: StudioBlock[] = [];
    let usedHeight = 0;

    const flush = (
      breakReason?: PaginationBreakReason,
      nextNode?: string,
      movedNode?: string,
      badness?: number,
      nextNodeHeightOverride?: number,
    ) => {
      if (!pageBlocks.length) return;
      const nextBlock = nextNode
        ? preparedBlockById.get(nextNode)
        : undefined;
      const nextConstraint = nextBlock
        ? paginationConstraintFor(nextBlock)
        : undefined;
      const nextMeasurement = nextBlock
        ? measurementOf(nextBlock)
        : undefined;
      const debug = breakReason
        ? {
            page: rawPages.length + 1,
            pageHeight: options.pageGeometry?.pageHeight,
            contentTop: options.pageGeometry?.contentTop,
            contentBottom: options.pageGeometry?.contentBottom,
            footerTop: options.pageGeometry?.footerTop,
            usableHeight: options.pageGeometry?.usableHeight ?? safeContentHeight,
            usedHeight,
            engineContentBottom: options.pageGeometry
              ? options.pageGeometry.contentTop + safeContentHeight
              : undefined,
            remainingHeight: Math.max(0, safeContentHeight - usedHeight),
            breakReason,
            movedNode,
            nextNode,
            nextNodeType: nextBlock?.type,
            nextNodeHeight: nextNodeHeightOverride ?? (nextBlock ? heightOf(nextBlock) : undefined),
            minimumFragmentHeight: nextMeasurement?.minimumFragmentHeight ?? (
              nextBlock ? heightOf(nextBlock) : undefined
            ),
            keepWithNext: nextConstraint?.keepWithNext,
            keepWithPrevious: nextConstraint?.keepWithPrevious,
            atomic: nextConstraint?.atomic,
            splittable: nextConstraint?.splittable,
            container: nextConstraint?.container,
            badness,
          }
        : undefined;
      rawPages.push({ blocks: pageBlocks, debug });
      if (options.debug && debug && typeof console !== "undefined") {
        console.debug("[Pagination]", debug);
      }
      pageBlocks = [];
      usedHeight = 0;
    };

    if (includeCover) rawPages.push({ blocks: [] });

    for (let index = 0; index < preparedBlocks.length; index += 1) {
      let block = preparedBlocks[index];
      if (block.type === "page-break") {
        if (!suppressedManualBreaks.has(index)) flush("manual");
        continue;
      }

      const forcedReason = forcedBreaks.get(block.id);
      if (forcedReason && pageBlocks.length) {
        flush(forcedReason, block.id, block.id);
      }

      const pairScale = atomicPairScales.get(block.id);
      if (pairScale !== undefined && pairScale < (block.paginationScale ?? 1)) {
        block = {
          ...block,
          paginationScale: Math.max(0.1, pairScale),
          paginationOriginalHeight: measurementOf(block).height,
          paginationError: pairScale < (block.type === "figure" ? 0.7 : 0.8)
            ? `見出しと同一ページへ置くため${Math.round(pairScale * 100)}%へ縮小しました。`
            : block.paginationError,
        };
      }

      const strategy = strategyFor(block);
      const measurement = measurementOf(block);
      const needsWidthScale = measurement.clientWidth > 0 && measurement.width > measurement.clientWidth + 1;
      const oversizedAtomicFragment =
        measurement.height > safeContentHeight &&
        Boolean(block.originBlockId) &&
        (block.type === "figure" || block.type === "math" || block.type === "table" || block.type === "code");
      if (strategy === "atomic" || needsWidthScale || oversizedAtomicFragment) {
        block = scaledAtomic(block);
      } else if (measurement.height > safeContentHeight) {
        block = {
          ...block,
          paginationError: "安全な子要素境界へ再分割しても本文領域へ収まりません。",
        };
      }
      block = { ...block, paginationLineCount: measurement.lineCount };

      let blockHeight = placementHeightOf(block, pageBlocks);
      const keepTogetherGroup = keepTogetherGroupAt(index);
      if (
        pageBlocks.length &&
        keepTogetherGroup &&
        keepTogetherGroup.height <= safeContentHeight + PAGINATION_CONFIG.overflowTolerancePx &&
        usedHeight + blockGap + keepTogetherGroup.height > safeContentHeight
      ) {
        flush(
          "problemKeepTogether",
          block.id,
          block.id,
          undefined,
          keepTogetherGroup.height,
        );
        blockHeight = placementHeightOf(block, pageBlocks);
      }
      const follower = findNextMeaningfulContent(index);
      const pairReason = follower
        ? semanticPairReason(block, follower.block)
        : null;
      if (follower && pairReason) {
        if (follower.manualBreakIndexes.length && isPaginationHeadingLike(block)) {
          if (pageBlocks.length) flush("manual", block.id, block.id);
          for (const markerIndex of follower.manualBreakIndexes) {
            suppressedManualBreaks.add(markerIndex);
          }
        }

        const bridgeHeight = follower.bridge.reduce(
          (total, entry) => total + blockGap + placementHeightOf(entry.block, []),
          0,
        );
        const prefixHeight = blockHeight + bridgeHeight + blockGap;
        const simulatedPrefix = [
          ...pageBlocks,
          block,
          ...follower.bridge.map((entry) => entry.block),
        ];
        let requiredHeight = prefixHeight + minimumFollowerHeight(follower.index, simulatedPrefix);

        if (
          requiredHeight > safeContentHeight &&
          strategyFor(follower.block) === "atomic" &&
          isPaginationHeadingLike(block)
        ) {
          const availableForAtomic = Math.max(1, safeContentHeight - prefixHeight);
          const atomicMeasurement = measurementOf(follower.block);
          const requiredScale = Math.min(
            effectiveScaleOf(follower.block),
            availableForAtomic / Math.max(1, atomicMeasurement.height),
          );
          atomicPairScales.set(follower.block.id, Math.max(0.1, requiredScale));
          requiredHeight = prefixHeight + minimumFollowerHeight(follower.index, simulatedPrefix);
        }

        const leadingGap = pageBlocks.length ? blockGap : 0;
        if (
          pageBlocks.length &&
          usedHeight + leadingGap + requiredHeight > safeContentHeight
        ) {
          flush(pairReason, block.id, block.id);
          blockHeight = placementHeightOf(block, pageBlocks);
        }
      }

      const gap = pageBlocks.length ? blockGap : 0;
      if (
        pageBlocks.length &&
        usedHeight + gap + blockHeight > safeContentHeight
      ) {
        const footerSafetyOnly =
          pageDomContentHeight > safeContentHeight + PAGINATION_CONFIG.overflowTolerancePx &&
          usedHeight + gap + blockHeight <= pageDomContentHeight;
        const candidate = chooseBreakCandidate(pageBlocks, block);
        if (candidate && candidate.cut < pageBlocks.length) {
          const moved = pageBlocks.slice(candidate.cut);
          pageBlocks = pageBlocks.slice(0, candidate.cut);
          usedHeight = candidate.leftHeight;
          flush(
            footerSafetyOnly ? "footerSafety" : "whitespaceOptimization",
            block.id,
            moved[0]?.id,
            candidate.badness,
          );
          pageBlocks = moved;
          usedHeight = sequenceHeight(moved);
        } else {
          const previousIndex = lastMeaningfulIndex(pageBlocks);
          const previous = previousIndex >= 0 ? pageBlocks[previousIndex] : undefined;
          const semanticReason = previous ? semanticPairReason(previous, block) : null;
          const reason: PaginationBreakReason =
            semanticReason ??
            (footerSafetyOnly
              ? "footerSafety"
              : strategy === "atomic"
              ? "atomicMove"
              : previous?.type === "callout" && sameFragmentGroup(previous, block)
                ? "containerSplit"
                : "overflow");
          flush(reason, block.id, block.id, candidate?.badness);
        }
        blockHeight = placementHeightOf(block, pageBlocks);
      }

      pageBlocks.push(block);
      usedHeight += (pageBlocks.length > 1 ? blockGap : 0) + blockHeight;
    }

    flush("documentEnd");
    return rawPages;
  };

  const forcedBreaks = new Map<string, PaginationBreakReason>();
  let rawPages: RawPage[] = [];
  let previousSignature = "";
  for (let pass = 0; pass < PAGINATION_CONFIG.maxLayoutPasses; pass += 1) {
    rawPages = runPaginationPass(forcedBreaks);
    const signature = rawPages
      .map((page) => page.blocks.map((block) => block.id).join(","))
      .join("|");
    if (signature === previousSignature) break;
    previousSignature = signature;
    let repaired = false;
    for (let index = 0; index < rawPages.length - 1; index += 1) {
      const current = rawPages[index].blocks;
      const next = rawPages[index + 1].blocks;
      const meaningfulIndex = lastMeaningfulIndex(current);
      const nextMeaningfulIndex = firstMeaningfulIndex(next);
      if (meaningfulIndex < 0 || nextMeaningfulIndex < 0) continue;
      const candidate = current[meaningfulIndex];
      const nextCandidate = next[nextMeaningfulIndex];
      const requestRepair = (block: StudioBlock, reason: PaginationBreakReason) => {
        if (forcedBreaks.has(block.id)) return;
        forcedBreaks.set(block.id, reason);
        repaired = true;
      };

      if (isPaginationHeadingLike(candidate) && meaningfulIndex > 0) {
        requestRepair(candidate, "postValidationRepair");
        continue;
      }
      if (semanticPairReason(candidate, nextCandidate) && meaningfulIndex > 0) {
        requestRepair(candidate, "postValidationRepair");
        continue;
      }
      if (
        sameFragmentGroup(candidate, nextCandidate) &&
        candidate.type === "paragraph" &&
        nextCandidate.type === "paragraph"
      ) {
        const tailLines = groupedBoundaryCount(current, false, "paragraph");
        const headLines = groupedBoundaryCount(next, true, "paragraph");
        if (tailLines < PAGINATION_CONFIG.minimumParagraphLinesAtBoundary && meaningfulIndex > 0) {
          const origin = candidate.originBlockId;
          let startIndex = meaningfulIndex;
          while (
            startIndex > 0 &&
            current[startIndex - 1].type === "paragraph" &&
            current[startIndex - 1].originBlockId === origin
          ) {
            startIndex -= 1;
          }
          if (startIndex > 0) requestRepair(current[startIndex], "widowPrevention");
        } else if (
          headLines < PAGINATION_CONFIG.minimumParagraphLinesAtBoundary &&
          tailLines > 1
        ) {
          requestRepair(candidate, "widowPrevention");
        }
      }

      const originId = nextCandidate.originBlockId;
      const containerConstraint = paginationConstraintFor(nextCandidate);
      if (
        originId &&
        sameFragmentGroup(candidate, nextCandidate) &&
        nextCandidate.type === "callout" &&
        containerConstraint.role !== "problem"
      ) {
        const tail: StudioBlock[] = [];
        for (let cursor = nextMeaningfulIndex; cursor < next.length; cursor += 1) {
          const fragment = next[cursor];
          if (fragment.originBlockId !== originId) break;
          tail.push(fragment);
        }
        const tailEnd = tail.at(-1)?.fragmentEndIndex ?? tail.at(-1)?.fragmentIndex;
        const fragmentCount = tail.at(-1)?.fragmentCount ?? 1;
        const isFinalTail = tail.length > 0 && tailEnd === fragmentCount - 1;
        const originFragments = preparedBlocks.filter((block) => block.originBlockId === originId);
        const meaningfulChildren = (blocks: StudioBlock[]) => blocks.reduce(
          (total, block) => total + Math.max(1, meaningfulPaginationChildren(block).length),
          0,
        );
        const tailHeight = sequenceHeight(tail);
        const originHeight = sequenceHeight(originFragments);
        const tinyTail =
          isFinalTail &&
          tailHeight / Math.max(1, safeContentHeight) <= PAGINATION_CONFIG.tinyTailMaxPageRatio &&
          tailHeight / Math.max(1, originHeight) <= PAGINATION_CONFIG.tinyTailMaxOriginRatio &&
          meaningfulChildren(tail) <= PAGINATION_CONFIG.tinyTailMaxMeaningfulChildren;

        if (tinyTail) {
          let groupStart = meaningfulIndex;
          while (
            groupStart > 0 &&
            current[groupStart - 1].originBlockId === originId
          ) groupStart -= 1;
          for (let moveStart = meaningfulIndex; moveStart >= groupStart; moveStart -= 1) {
            const moved = current.slice(moveStart);
            const left = current.slice(0, moveStart);
            const rebalancedTail = [...moved, ...tail];
            if (
              firstMeaningfulIndex(left) >= 0 &&
              sequenceHeight(rebalancedTail) <= safeContentHeight + PAGINATION_CONFIG.overflowTolerancePx &&
              (
                meaningfulChildren(rebalancedTail) > PAGINATION_CONFIG.tinyTailMaxMeaningfulChildren ||
                sequenceHeight(rebalancedTail) / Math.max(1, originHeight) > PAGINATION_CONFIG.tinyTailMaxOriginRatio
              )
            ) {
              requestRepair(moved[0], "tinyTailBacktrack");
              break;
            }
          }
        }
      }
      if (
        sameFragmentGroup(candidate, nextCandidate) &&
        candidate.type === "table" &&
        nextCandidate.type === "table"
      ) {
        const tailRows = groupedBoundaryCount(current, false, "table");
        const headRows = groupedBoundaryCount(next, true, "table");
        if (tailRows < PAGINATION_CONFIG.minimumTableRowsAtBoundary && meaningfulIndex > 0) {
          requestRepair(candidate, "minimumFragment");
        } else if (headRows < PAGINATION_CONFIG.minimumTableRowsAtBoundary && tailRows > 2) {
          requestRepair(candidate, "minimumFragment");
        }
      }
    }
    if (!repaired) break;
  }

  const pages: PageModel[] = rawPages.map((rawPage, index) => ({
    number: index + 1,
    blocks: mergePageFragments(rawPage.blocks),
    breakAfter: rawPage.debug?.breakReason,
    paginationDebug: rawPage.debug,
  }));
  if (!pages.length) pages.push({ number: 1, blocks: [] });
  return pages;
}

export function paginateDocument(blocks: StudioBlock[], includeCover = false) {
  const pages: PageModel[] = [];
  let pageBlocks: StudioBlock[] = [];
  const prepared = prepareBlocksForPagination(blocks);

  const flush = () => {
    if (!pageBlocks.length) return;
    pages.push({
      number: pages.length + 1,
      blocks: mergePageFragments(pageBlocks),
    });
    pageBlocks = [];
  };

  if (includeCover) {
    pages.push({ number: 1, blocks: [] });
  }

  for (const block of prepared.blocks) {
    if (block.type === "page-break") {
      flush();
      continue;
    }
    // This is only the pre-measurement placeholder. Keep every unmeasured
    // root node recoverable on its own provisional page; the actual preview
    // and every PDF are replaced by paginateMeasuredDocument output.
    if (pageBlocks.length) flush();
    pageBlocks.push(block);
  }
  flush();
  if (!pages.length) pages.push({ number: 1, blocks: [] });
  return { pages, splitIds: prepared.splitIds };
}

export function sanitizeFilename(
  metadata: Metadata,
  extension: "pdf" | "html" | "md" | "json",
  edition?: "完全版" | "問題" | "解答",
) {
  const parts = [
    metadata.lesson_id,
    metadata.title,
    metadata.subject,
    metadata.difficulty,
    edition,
  ].filter(Boolean);
  const base = parts
    .join("_")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 160);
  return `${base || "教材"}.${extension}`;
}

export const SAMPLES = {
  math: {
    label: "数学｜二次関数",
    source: `---
lesson_id: "003"
title: "二次関数"
subject: "数学"
difficulty: "L1 入門"
author: "ミライコーチング"
copyright: "©ミライコーチング"
---

# 第3講 二次関数

:::learning-goals
- 二次関数のグラフの形を説明できる
- 軸と頂点を平方完成から求められる
:::

## 二次関数のグラフ

二次関数 $y=ax^2+bx+c$ は、放物線を表す関数です。グラフの形は係数 $a$ の符号によって決まります。

$$
y=ax^2+bx+c
$$

:::key-point title="ポイント"
- 頂点のx座標は $x=-\\frac{b}{2a}$
- 軸は直線 $x=-\\frac{b}{2a}$
- $a>0$ のとき上に開き、$a<0$ のとき下に開く
:::

\`\`\`figure function-graph
functions: y = x^2 - 4x + 3 | f(x)=x^2-4x+3 | solid; y = -x + 4 | g(x)=-x+4 | dashed
x-range: -1, 5
y-range: -2, 8
x-tick: 1
y-tick: 1
show-grid: true
legend: true
points: 1,0,A,closed; 2,-1,P,closed; 3,0,B,closed
guides: x=2 | x=2 | dashed; y=-1 | y=-1 | dotted
caption: 二次関数と直線、点・補助線の表示例
\`\`\`

\`\`\`figure number-line
range: -2, 6
interval: 1, 3
endpoints: open, closed
points: 1:a:open, 3:b:closed
tick-step: 1
caption: 1<x≤3を表す数直線
\`\`\`

\`\`\`figure sign-chart
variable: x
critical-points: 1, 3
label: (x-1)(x-3)
signs: +, -, +
caption: (x-1)(x-3)の符号表
\`\`\`

\`\`\`figure triangle
vertices: A, 75, 215; B, 345, 215; C, 345, 45
side-labels: A-B:c; B-C:a; C-A:b
angle-labels: A:α; C:γ
right-angle: B
caption: 頂点・辺・角・直角記号を付けた三角形
\`\`\`

\`\`\`figure circle
center: O
radius: 88
points: A:0; B:90; C:210
segments: O-A:r; A-B:弦AB; B-C
arcs: A-B:minor:弧AB; B-C:major:優弧BC
show-center: true
caption: 中心・半径・弦・円弧を付けた円
\`\`\`

\`\`\`figure venn-diagram
sets: A:英語が好き; B:数学が好き; C:理科が好き
universe: クラス全体
shade: A&B; A&B&C
regions: A-only | 12人; B-only | 8人; C-only | 6人; A&B | 5人; A&B&C | 2人; outside | 4人
show-universe: true
caption: 3集合の共通部分と各領域を示すベン図
\`\`\`

\`\`\`figure tree-diagram
root: S | 開始
branches: S>H1 | 表 | 1/2; S>T1 | 裏 | 1/2; H1>HH | 表 | 1/2; H1>HT | 裏 | 1/2; T1>TH | 表 | 1/2; T1>TT | 裏 | 1/2
nodes: H1 | 1回目が表; T1 | 1回目が裏
results: HH | 表・表 | 1/4; HT | 表・裏 | 1/4; TH | 裏・表 | 1/4; TT | 裏・裏 | 1/4
stages: 開始; 1回目; 2回目
show-node-labels: false
caption: コインを2回投げるときの樹形図
\`\`\`

\`\`\`figure histogram
boundaries: 0, 10, 20, 30, 40, 50
frequencies: 2, 6, 10, 7, 3
x-label: 得点
y-label: 人数
y-max: 10
y-tick: 2
show-values: true
caption: テスト得点のヒストグラム
\`\`\`

\`\`\`figure box-plot
series: A組 | 32, 48, 61, 72, 88 | 96; B組 | 35, 52, 64, 76, 91
range: 30, 100
tick-step: 10
axis-label: 得点
show-values: false
caption: 2クラスの得点分布を比べる箱ひげ図
\`\`\`

\`\`\`figure scatter-plot
points: 1, 42, A; 2, 51, B; 3, 55, C; 4, 68, D; 5, 72, E; 6, 81, F
x-range: 0, 7
y-range: 30, 90
x-tick: 1
y-tick: 10
x-label: 学習時間（時間）
y-label: テスト得点
show-grid: true
show-labels: true
trend-line: linear
trend-label: 傾向線
caption: 学習時間とテスト得点の散布図
\`\`\`

\`\`\`figure probability-distribution
distribution: binomial
n: 10
p: 0.4
x-tick: 1
shade: 3, 6
x-label: 成功回数
show-parameters: true
caption: 二項分布で3回以上6回以下となる範囲
\`\`\`

\`\`\`figure probability-distribution
distribution: normal
mean: 50
sd: 10
x-range: 20, 80
x-tick: 10
shade: left, 40
x-label: 得点
show-parameters: true
caption: 正規分布で40点以下となる範囲
\`\`\`

:::exercise id="q001" title="練習問題1"
$y=x^2-4x+3$ の軸と頂点を求めなさい。
:::

:::solution for="q001" title="解答1"
平方完成すると、

$$
\\begin{aligned}
y &= x^2-4x+3 \\\\
  &= (x-2)^2-1
\\end{aligned}
$$

したがって、軸は $x=2$、頂点は $(2,-1)$ です。
:::`,
  },
  physics: {
    label: "物理｜等加速度運動",
    source: `---
lesson_id: "012"
title: "等加速度直線運動"
subject: "物理"
difficulty: "L1 入門"
---

# 等加速度直線運動

:::learning-goals
- 速度と加速度の関係を説明できる
- 速度−時間グラフの面積から変位を求められる
:::

## 基本公式

初速度を $v_0$、加速度を $a$、時刻を $t$ とすると速度は次式です。

$$
v=v_0+at
$$

| 物理量 | 記号 | 単位 |
|---|---|---|
| 速度 | $v$ | m/s |
| 加速度 | $a$ | m/s² |
| 時間 | $t$ | s |

\`\`\`mermaid
flowchart LR
  A[初速度] --> B[一定の加速度]
  B --> C[時刻tの速度]
\`\`\`

:::exercise id="p001" title="例題1"
静止していた物体が $2.0\\,\\mathrm{m/s^2}$ で3.0秒間加速した。速度を求めなさい。
:::

:::solution for="p001" title="解答1"
$v_0=0$ より、$v=0+2.0\\times3.0=6.0\\,\\mathrm{m/s}$ です。
:::`,
  },
  english: {
    label: "英語｜英文解釈",
    source: `---
lesson_id: "021"
title: "主語と動詞を見抜く"
subject: "英語"
difficulty: "L1 入門"
---

# 主語と動詞を見抜く

:::learning-goals
- 長い英文でも主語と動詞を特定できる
- 修飾語句を括弧で整理できる
:::

## Reading

The ability to distinguish reliable information from misleading claims has become increasingly important for students who learn through digital media.

:::key-point title="構文のポイント"
主語は **The ability**、動詞は **has become** です。to distinguish 以下は ability を説明します。
:::

| 語句 | 意味 |
|---|---|
| distinguish A from B | AとBを区別する |
| reliable | 信頼できる |
| misleading | 誤解を招く |

:::exercise id="e001" title="確認問題"
英文の主語・動詞・補語をそれぞれ答え、日本語に訳しなさい。
:::

:::solution for="e001" title="解答"
S = The ability / V = has become / C = increasingly important

「信頼できる情報と誤解を招く主張を区別する能力は、デジタルメディアを通じて学ぶ生徒にとって、ますます重要になっている。」
:::`,
  },
  boundary: {
    label: "境界値｜長大要素",
    source: `---
lesson_id: "999"
title: "長大要素テスト"
subject: "共通"
difficulty: "検証用"
---

# 長大要素テスト

## 長い途中式

$$
\\begin{aligned}
A_1 &= B_1+C_1 \\\\
A_2 &= B_2+C_2 \\\\
A_3 &= B_3+C_3 \\\\
A_4 &= B_4+C_4 \\\\
A_5 &= B_5+C_5 \\\\
A_6 &= B_6+C_6 \\\\
A_7 &= B_7+C_7 \\\\
A_8 &= B_8+C_8 \\\\
A_9 &= B_9+C_9 \\\\
A_{10} &= B_{10}+C_{10} \\\\
A_{11} &= B_{11}+C_{11} \\\\
A_{12} &= B_{12}+C_{12} \\\\
A_{13} &= B_{13}+C_{13}
\\end{aligned}
$$

:::solution for="q999" title="長い解答例"
この解答は1ページを超えた場合の分割を確認するためのものです。内容が残り領域に収まらない場合、ブロック全体を次ページへ送り続けるのではなく、段落境界で分割します。

第一段落では、条件を整理して解法の全体像を確認します。数式・図表・表などの分割禁止要素は途中で切らず、段落やリストの論理境界を優先します。

第二段落では、描画後の実寸検査を行います。横方向または縦方向の超過を確認し、通常配置、次ページ送り、規定範囲内の縮小、代替表示の最大4段階で処理します。

第三段落では、無限再組版を防ぎます。同じ状態が繰り返された場合はフォールバックへ移行し、内容を黙って切り捨てません。

第四段落では、次ページ先頭へ「長い解答例（続き）」を自動表示します。この継続表示は入力Markdownへ書き戻さず、組版時だけ生成されます。

第五段落では、ページ番号・著作権表記・入力行の対応を保持します。ユーザーは警告から該当行へ戻り、必要な箇所だけを修正できます。
:::

\`\`\`figure data-chart
type: bar
labels: 1月, 2月, 3月, 4月
values: 42, 58, 71, 86
caption: 学習時間の推移
\`\`\``,
  },
} as const;
