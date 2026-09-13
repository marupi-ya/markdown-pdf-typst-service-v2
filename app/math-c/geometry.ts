import { parseFigureSource, type Mapping, type Value } from "./syntax";
import { expression, relation } from "./expression";
export { MATH_C_TYPES } from "./syntax";
export type Point = [number, number];
export type Primitive = {
  tag: "line" | "polyline" | "polygon" | "circle" | "ellipse" | "path" | "text";
  attrs: Record<string, string | number>;
  text?: string;
};
export type MathCConfig = {
  width: number;
  height: number;
  primitives: Primitive[];
  points: Record<string, Point>;
  title: string;
};
const ink = "#263542",
  blue = "#1769aa";
const xml = (v: unknown) =>
  String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
/** SVG-portable label subset; unsupported TeX is diagnosed, never silently lost. */
export function mathLabel(value: string): string {
  const greek: Record<string, string> = {
    alpha: "α",
    beta: "β",
    gamma: "γ",
    theta: "θ",
    phi: "φ",
    pi: "π",
    omega: "ω",
    lambda: "λ",
    mu: "μ",
    rho: "ρ",
    sigma: "σ",
    Delta: "Δ",
  };
  let s = value
    .replace(/\$/g, "")
    .replace(/\\(?:vec|overrightarrow)\{([^{}]+)\}/g, "$1⃗")
    .replace(/\\(?:bar|overline)\{([^{}]+)\}/g, "$1̅")
    .replace(/\\([A-Za-z]+)/g, (all, name) => greek[name] ?? all);
  s = s.replace(/\^\{?([0-9+\-]+)\}?/g, (_, n: string) =>
    [...n]
      .map(
        (c) => "⁰¹²³⁴⁵⁶⁷⁸⁹"["0123456789".indexOf(c)] ?? (c === "+" ? "⁺" : "⁻")
      )
      .join("")
  );
  s = s.replace(/_\{?([0-9]+)\}?/g, (_, n: string) =>
    [...n].map((c) => "₀₁₂₃₄₅₆₇₈₉"[Number(c)]).join("")
  );
  if (/[\\{}]/.test(s))
    throw new Error(
      "ラベルの数式は vec/overrightarrow、bar/overline、ギリシャ文字、数字の上付き・下付きに対応しています"
    );
  if (s.length > 90) throw new Error("ラベルは90文字以内にしてください");
  return s;
}
export function parseMathCConfig(
  type: string,
  raw: string,
  sourceLine = 0
): { ok: true; config: MathCConfig } | { ok: false; errors: string[] } {
  try {
    return { ok: true, config: build(type, raw, sourceLine) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      errors: [
        message.startsWith(type + ":")
          ? message
          : `${type}: ${sourceLine + 1}行目 ${message}`,
      ],
    };
  }
}
function build(type: string, raw: string, sourceLine: number): MathCConfig {
  const { config: c, locations } = parseFigureSource(raw, type, sourceLine);
  function fail(path: string, message: string): never {
    let p = path;
    while (p && !locations.has(p)) {
      const parent = p.replace(/(?:\.[^.\[]+|\[\d+\])$/, "");
      p = parent === p ? "" : parent;
    }
    throw new Error(
      `${type}: ${locations.get(p) ?? sourceLine + 1}行目 ${path}: ${message}`
    );
  }
  function obj(v: Value | undefined, p: string): Mapping {
    if (!v || Array.isArray(v) || typeof v !== "object")
      fail(p, "キーと値の辞書を指定してください");
    return v as Mapping;
  }
  function num(v: Value | undefined, p: string, fallback?: number): number {
    if (v === undefined && fallback !== undefined) return fallback;
    if (typeof v !== "number" || !Number.isFinite(v) || Math.abs(v) > 1e6)
      fail(p, "絶対値1000000以下の有限数を指定してください");
    return v as number;
  }
  function str(v: Value | undefined, p: string): string {
    if (typeof v !== "string" || !v.length)
      fail(p, "空でない文字列を指定してください");
    return v as string;
  }
  function bool(v: Value | undefined, p: string, fallback = false): boolean {
    if (v === undefined) return fallback;
    if (typeof v !== "boolean") fail(p, "true または false を指定してください");
    return v as boolean;
  }
  function arr(v: Value | undefined, p: string): Value[] {
    if (v === undefined) return [];
    if (!Array.isArray(v) || v.length > 150)
      fail(p, "150項目以内の配列を指定してください");
    return v as Value[];
  }
  function keys(o: Mapping, allowed: string[], p: string) {
    for (const k of Object.keys(o))
      if (!allowed.includes(k))
        fail(
          p ? `${p}.${k}` : k,
          `未対応の項目です。使用可能: ${allowed.join(", ")}`
        );
  }
  const styles = [
    "label",
    "labelOffset",
    "dashed",
    "style",
    "arrow",
    "stroke",
    "fill",
  ];
  keys(
    c,
    [
      "caption",
      "xRange",
      "yRange",
      "axes",
      "grid",
      "points",
      "vectors",
      "segments",
      "lines",
      "rays",
      "polygons",
      "circles",
      "ellipses",
      "arcs",
      "angleMarks",
      "constructions",
      "projection",
      "midpoint",
      "internalDivision",
      "externalDivision",
      "parallelThrough",
      "perpendicularThrough",
      "conjugate",
      "rotation",
      "perpendicularBisector",
      "boundaries",
      "regions",
      "regionMode",
      "type",
      "labels",
      "showHiddenEdges",
      "highlightSegments",
      "dashedSegments",
      "sections",
      "edges",
      "view",
      "dimensions",
      "curves",
      "tRange",
      "thetaRange",
      "x",
      "y",
      "r",
      "polarGrid",
    ],
    ""
  );
  const entries = (key: string) =>
    arr(c[key], key).map((v, i) => ({
      o: obj(v, `${key}[${i}]`),
      p: `${key}[${i}]`,
    }));
  function pair(v: Value | undefined, p: string): Point {
    const a = arr(v, p);
    if (a.length !== 2) fail(p, "2数の配列を指定してください（例: [0, 1]）");
    return [num(a[0], p), num(a[1], p)];
  }
  function range(v: Value | undefined, p: string, fallback: Point): Point {
    const a = v === undefined ? fallback : pair(v, p);
    if (a[1] <= a[0] || a[1] - a[0] < 1e-6)
      fail(p, "最小値 < 最大値、幅は0.000001以上にしてください");
    return a;
  }
  const points: Record<string, Point> = Object.create(null);
  const pointLabels: { id: string; label: string; offset?: Value }[] = [];
  const extraSegments: Mapping[] = [],
    extraLines: Mapping[] = [];
  function addPoint(
    id: string,
    xy: Point,
    p: string,
    label = id,
    offset?: Value
  ) {
    if (points[id]) fail(p, `点 "${id}" が重複しています`);
    if (!xy.every(Number.isFinite))
      fail(p, "計算した座標が有限数ではありません");
    points[id] = xy;
    pointLabels.push({ id, label, offset });
  }
  function ref(v: Value | undefined, p: string): Point {
    if (Array.isArray(v)) return pair(v, p);
    const id = str(v, p);
    if (!points[id])
      fail(
        p,
        `点 "${id}" が未定義です。points または先行する構成で定義してください`
      );
    return points[id];
  }
  const solid = type === "solid-geometry";
  let solidProject: ((q: number[]) => Point) | undefined;
  let solidEdges: [string, string][] = [],
    solidHidden = new Set<string>();
  if (solid) {
    const kind = c.type ?? "cube";
    if (
      !["cube", "cuboid", "tetrahedron", "triangular-prism", "custom"].includes(
        String(kind)
      )
    )
      fail(
        "type",
        "cube / cuboid / tetrahedron / triangular-prism / custom を指定してください"
      );
    const dims =
      c.dimensions === undefined
        ? [1, 1, 1]
        : arr(c.dimensions, "dimensions").map((n, i) =>
            num(n, `dimensions[${i}]`)
          );
    if (dims.length !== 3 || dims.some((n) => n <= 0))
      fail("dimensions", "正の3数を指定してください");
    const [a, b, d] = dims;
    const defaults: Record<string, number[]> =
      kind === "tetrahedron"
        ? {
            A: [0, 0, 0],
            B: [a, 0, 0],
            C: [a / 2, (b * Math.sqrt(3)) / 2, 0],
            D: [a / 2, (b * Math.sqrt(3)) / 6, d * Math.sqrt(2 / 3)],
          }
        : kind === "triangular-prism"
        ? {
            A: [0, 0, 0],
            B: [a, 0, 0],
            C: [a / 2, b, 0],
            D: [0, 0, d],
            E: [a, 0, d],
            F: [a / 2, b, d],
          }
        : {
            A: [0, 0, 0],
            B: [a, 0, 0],
            C: [a, b, 0],
            D: [0, b, 0],
            E: [0, 0, d],
            F: [a, 0, d],
            G: [a, b, d],
            H: [0, b, d],
          };
    const labels =
      c.labels === undefined
        ? kind === "custom"
          ? {}
          : defaults
        : obj(c.labels, "labels");
    const view = c.view === undefined ? [35, 25] : pair(c.view, "view");
    const az = (view[0] * Math.PI) / 180,
      el = (view[1] * Math.PI) / 180;
    if (Math.abs(view[1]) >= 89)
      fail("view", "仰角は -89 度より大きく89度より小さくしてください");
    solidProject = (q) => [
      q[0] * Math.cos(az) - q[1] * Math.sin(az),
      -q[0] * Math.sin(az) * Math.sin(el) -
        q[1] * Math.cos(az) * Math.sin(el) +
        q[2] * Math.cos(el),
    ];
    const xyz: Record<string, number[]> = {};
    for (const [id, v] of Object.entries(labels)) {
      const q = arr(v as Value, `labels.${id}`).map((n, i) =>
        num(n, `labels.${id}[${i}]`)
      );
      if (q.length !== 3)
        fail(`labels.${id}`, "3次元座標 [x,y,z] を指定してください");
      xyz[id] = q;
      addPoint(
        id,
        [
          q[0] * Math.cos(az) - q[1] * Math.sin(az),
          -q[0] * Math.sin(az) * Math.sin(el) -
            q[1] * Math.cos(az) * Math.sin(el) +
            q[2] * Math.cos(el),
        ],
        `labels.${id}`
      );
    }
    const faces =
      kind === "tetrahedron"
        ? [
            ["A", "C", "B"],
            ["A", "B", "D"],
            ["B", "C", "D"],
            ["C", "A", "D"],
          ]
        : kind === "triangular-prism"
        ? [
            ["A", "C", "B"],
            ["D", "E", "F"],
            ["A", "B", "E", "D"],
            ["B", "C", "F", "E"],
            ["C", "A", "D", "F"],
          ]
        : [
            ["A", "D", "C", "B"],
            ["E", "F", "G", "H"],
            ["A", "B", "F", "E"],
            ["B", "C", "G", "F"],
            ["C", "D", "H", "G"],
            ["D", "A", "E", "H"],
          ];
    if (kind !== "custom") {
      const all = Object.values(xyz),
        center = [0, 1, 2].map(
          (i) => all.reduce((s, p) => s + p[i], 0) / all.length
        );
      const visible = new Map<string, boolean>();
      for (const face of faces) {
        for (const id of face)
          if (!xyz[id])
            fail(
              "labels",
              `基本立体の頂点 ${id} が必要です。任意の頂点名には type: custom を使用してください`
            );
        const p = xyz[face[0]],
          u = xyz[face[1]].map((v, i) => v - p[i]),
          v = xyz[face[2]].map((v, i) => v - p[i]);
        let n = [
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        ];
        if (n.reduce((s, k, i) => s + k * (p[i] - center[i]), 0) < 0)
          n = n.map((k) => -k);
        const front =
          n[0] * Math.sin(az) * Math.cos(el) +
            n[1] * Math.cos(az) * Math.cos(el) +
            n[2] * Math.sin(el) >
          1e-9;
        for (let i = 0; i < face.length; i++) {
          const edge = [face[i], face[(i + 1) % face.length]].sort().join("|");
          visible.set(edge, (visible.get(edge) ?? false) || front);
        }
      }
      solidEdges = [...visible.keys()].map(
        (k) => k.split("|") as [string, string]
      );
      solidHidden = new Set([...visible].filter(([, v]) => !v).map(([k]) => k));
    }
    if (c.edges !== undefined)
      solidEdges = arr(c.edges, "edges").map((v, i) => {
        const q = arr(v, `edges[${i}]`);
        if (q.length !== 2) fail(`edges[${i}]`, "頂点名2つを指定してください");
        ref(q[0], `edges[${i}]`);
        ref(q[1], `edges[${i}]`);
        return [String(q[0]), String(q[1])];
      });
    if (!Object.keys(points).length)
      fail("labels", "少なくとも1点の3次元座標を指定してください");
  }
  for (const { o, p } of entries("points")) {
    keys(o, ["id", "x", "y", "label", "labelOffset"], p);
    addPoint(
      str(o.id, p + ".id"),
      [num(o.x, p + ".x"), num(o.y, p + ".y")],
      p,
      o.label === undefined ? String(o.id) : String(o.label),
      o.labelOffset
    );
  }
  const operations = [
    "projection",
    "midpoint",
    "internalDivision",
    "externalDivision",
    "parallelThrough",
    "perpendicularThrough",
    "conjugate",
    "rotation",
    "perpendicularBisector",
  ];
  const constructions: { o: Mapping; p: string }[] = [
    ...entries("constructions"),
    ...operations.flatMap((key) =>
      entries(key).map((e) => ({ ...e, o: { ...e.o, type: key } }))
    ),
  ];
  for (const { o, p } of constructions) {
    keys(
      o,
      [
        "type",
        "id",
        "from",
        "to",
        "point",
        "line",
        "ratio",
        "through",
        "angle",
        "center",
        "label",
        "labelOffset",
        "guides",
        "dashed",
      ],
      p
    );
    const kind = str(o.type, p + ".type");
    if (!operations.includes(kind)) fail(p + ".type", `未対応の構成 ${kind}`);
    let q: Point;
    if (kind === "conjugate") {
      const a = ref(o.point, p + ".point");
      q = [a[0], -a[1]];
    } else if (kind === "rotation") {
      const a = ref(o.point, p + ".point"),
        b = o.center === undefined ? [0, 0] : ref(o.center, p + ".center"),
        t = (num(o.angle, p + ".angle") * Math.PI) / 180;
      q = [
        b[0] + (a[0] - b[0]) * Math.cos(t) - (a[1] - b[1]) * Math.sin(t),
        b[1] + (a[0] - b[0]) * Math.sin(t) + (a[1] - b[1]) * Math.cos(t),
      ];
    } else {
      const line =
        o.line === undefined ? [o.from, o.to] : arr(o.line, p + ".line");
      if (line.length !== 2) fail(p + ".line", "2点を指定してください");
      const a = ref(line[0], p + ".from"),
        b = ref(line[1], p + ".to"),
        dx = b[0] - a[0],
        dy = b[1] - a[1],
        len = dx * dx + dy * dy;
      if (len < 1e-16) fail(p, "異なる2点が必要です");
      if (
        [
          "parallelThrough",
          "perpendicularThrough",
          "perpendicularBisector",
        ].includes(kind)
      ) {
        const h: Point =
          kind === "perpendicularBisector"
            ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
            : ref(o.through, p + ".through");
        const v = kind === "parallelThrough" ? [dx, dy] : [-dy, dx];
        extraLines.push({
          through: [h, [h[0] + v[0], h[1] + v[1]]],
          dashed: o.dashed ?? true,
          label: o.label ?? "",
        });
        continue;
      }
      if (kind === "projection") {
        const h = ref(o.point, p + ".point"),
          t = ((h[0] - a[0]) * dx + (h[1] - a[1]) * dy) / len;
        q = [a[0] + t * dx, a[1] + t * dy];
        if (bool(o.guides, p + ".guides", true))
          extraSegments.push({ from: h, to: q, dashed: true });
      } else {
        let t = 0.5;
        if (kind !== "midpoint") {
          const [m, n] = pair(o.ratio, p + ".ratio");
          if (m <= 0 || n <= 0)
            fail(p + ".ratio", "比は正の2数を指定してください");
          if (kind === "externalDivision" && Math.abs(m - n) < 1e-12)
            fail(p + ".ratio", "外分比 m:n は m ≠ n が必要です");
          t = kind === "externalDivision" ? m / (m - n) : m / (m + n);
        }
        q = [a[0] + t * dx, a[1] + t * dy];
      }
    }
    const id = str(o.id, p + ".id");
    addPoint(
      id,
      q,
      p,
      o.label === undefined ? id : String(o.label),
      o.labelOffset
    );
  }
  const all = Object.values(points),
    auto = (axis: number): Point => {
      const vs = all.map((p) => p[axis]);
      const lo = Math.min(...vs),
        hi = Math.max(...vs),
        pad = Math.max((hi - lo) * 0.22, 0.3);
      return [lo - pad, hi + pad];
    };
  const xr = range(c.xRange, "xRange", solid ? auto(0) : [-5, 5]),
    yr = range(c.yRange, "yRange", solid ? auto(1) : [-5, 5]);
  const scale = Math.min(536 / (xr[1] - xr[0]), 336 / (yr[1] - yr[0]));
  const width = Math.max(240, (xr[1] - xr[0]) * scale + 104),
    height = Math.max(200, (yr[1] - yr[0]) * scale + 84);
  const left = (width - (xr[1] - xr[0]) * scale) / 2,
    top = (height - (yr[1] - yr[0]) * scale) / 2;
  const sx = (x: number) => left + (x - xr[0]) * scale,
    sy = (y: number) => top + (yr[1] - y) * scale;
  const primitives: Primitive[] = [],
    labels: Primitive[] = [],
    occupied: { x: number; y: number; w: number; h: number }[] = [];
  const add = (
    tag: Primitive["tag"],
    attrs: Primitive["attrs"],
    text?: string
  ) => primitives.push({ tag, attrs, text });
  const inside = (p: Point) =>
    p[0] >= xr[0] - 1e-8 &&
    p[0] <= xr[1] + 1e-8 &&
    p[1] >= yr[0] - 1e-8 &&
    p[1] <= yr[1] + 1e-8;
  function label(
    value: Value | undefined,
    at: Point,
    p: string,
    offset?: Value
  ) {
    if (value === undefined || value === "") return;
    let text: string;
    try {
      text = mathLabel(String(value));
    } catch (e) {
      fail(p, (e as Error).message);
    }
    const accent = /[⃗̅]/.test(text!)
      ? text!.includes("⃗")
        ? "arrow"
        : "bar"
      : "";
    text = text!.replace(/[⃗̅]/g, "");
    const w = Math.max(14, [...text!].length * 8),
      h = 18;
    const candidates =
      offset === undefined
        ? [
            [10, -12],
            [10, 22],
            [-w - 10, -12],
            [-w - 10, 22],
            [14, -30],
            [-w / 2, 35],
          ]
        : [pair(offset, p + ".labelOffset")];
    let chosen = {
      x: sx(at[0]) + candidates[0][0],
      y: sy(at[1]) + candidates[0][1],
      w,
      h,
    };
    let best = Infinity;
    for (const [dx, dy] of candidates) {
      const x = sx(at[0]) + dx,
        y = sy(at[1]) + dy;
      let score =
        occupied.filter(
          (b) => x < b.x + b.w && x + w > b.x && y - h < b.y && y > b.y - b.h
        ).length * 100;
      score +=
        Math.max(0, -x) +
        Math.max(0, x + w - width) +
        Math.max(0, h - y) +
        Math.max(0, y - height);
      if (score < best) {
        best = score;
        chosen = { x, y, w, h };
      }
    }
    occupied.push(chosen);
    if (accent) {
      const y = chosen.y - 17,
        x = chosen.x;
      labels.push({
        tag: "line",
        attrs: {
          x1: x,
          y1: y,
          x2: x + w,
          y2: y,
          stroke: ink,
          "stroke-width": 1,
        },
      });
      if (accent === "arrow")
        labels.push({
          tag: "polyline",
          attrs: {
            points: `${x + w - 5},${y - 3} ${x + w},${y} ${x + w - 5},${y + 3}`,
            stroke: ink,
            fill: "none",
            "stroke-width": 1,
          },
        });
    }
    labels.push({
      tag: "text",
      attrs: { x: chosen.x, y: chosen.y, "font-size": 15, fill: ink },
      text: text!,
    });
  }
  function style(o: Mapping, p: string): Primitive["attrs"] {
    if (o.style !== undefined && !["solid", "dashed"].includes(String(o.style)))
      fail(p + ".style", "solid または dashed を指定してください");
    return {
      stroke: blue,
      "stroke-width": 2,
      fill: "none",
      ...(bool(o.dashed, p + ".dashed") || o.style === "dashed"
        ? { "stroke-dasharray": "7 5" }
        : {}),
    };
  }
  function clip(a: Point, b: Point, kind: string): [Point, Point] | null {
    const d = [b[0] - a[0], b[1] - a[1]];
    let lo = kind === "line" ? -Infinity : 0,
      hi = kind === "segment" ? 1 : Infinity;
    for (let i = 0; i < 2; i++) {
      const r = i ? yr : xr;
      if (Math.abs(d[i]) < 1e-14) {
        if (a[i] < r[0] || a[i] > r[1]) return null;
      } else {
        const u = (r[0] - a[i]) / d[i],
          v = (r[1] - a[i]) / d[i];
        lo = Math.max(lo, Math.min(u, v));
        hi = Math.min(hi, Math.max(u, v));
      }
    }
    if (lo > hi || !Number.isFinite(lo + hi)) return null;
    return [
      [a[0] + lo * d[0], a[1] + lo * d[1]],
      [a[0] + hi * d[0], a[1] + hi * d[1]],
    ];
  }
  function line(
    a: Point,
    b: Point,
    o: Mapping = {},
    kind = "segment",
    p = "line"
  ) {
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-12)
      fail(p, "始点と終点は異なる点にしてください");
    const ends = clip(a, b, kind);
    if (!ends) return;
    const [u, v] = ends,
      st = style(o, p);
    add("line", {
      x1: sx(u[0]),
      y1: sy(u[1]),
      x2: sx(v[0]),
      y2: sy(v[1]),
      ...st,
    });
    if (bool(o.arrow, p + ".arrow") && (kind !== "segment" || inside(b))) {
      const t = Math.atan2(sy(v[1]) - sy(u[1]), sx(v[0]) - sx(u[0])),
        x = sx(v[0]),
        y = sy(v[1]);
      add("polygon", {
        points: `${x},${y} ${x - 10 * Math.cos(t) + 4 * Math.sin(t)},${
          y - 10 * Math.sin(t) - 4 * Math.cos(t)
        } ${x - 10 * Math.cos(t) - 4 * Math.sin(t)},${
          y - 10 * Math.sin(t) + 4 * Math.cos(t)
        }`,
        fill: blue,
      });
    }
    label(
      o.label,
      [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2],
      p + ".label",
      o.labelOffset
    );
  }
  // Adaptive, bounded ticks; equal unit scales preserve circles and angles.
  const grid = bool(c.grid, "grid"),
    axes = bool(c.axes, "axes", !solid);
  if (grid || (axes && !solid)) {
    for (let axis = 0; axis < 2; axis++) {
      const r = axis ? yr : xr,
        rough = (r[1] - r[0]) / 8,
        pow = 10 ** Math.floor(Math.log10(rough)),
        step = [1, 2, 5, 10].find((k) => k * pow >= rough)! * pow;
      for (
        let v = Math.ceil(r[0] / step) * step, n = 0;
        v <= r[1] + step * 1e-8 && n++ < 30;
        v += step
      ) {
        if (grid)
          add(
            "line",
            axis
              ? {
                  x1: sx(xr[0]),
                  x2: sx(xr[1]),
                  y1: sy(v),
                  y2: sy(v),
                  stroke: "#dfe7ed",
                  "stroke-width": 0.8,
                }
              : {
                  x1: sx(v),
                  x2: sx(v),
                  y1: sy(yr[0]),
                  y2: sy(yr[1]),
                  stroke: "#dfe7ed",
                  "stroke-width": 0.8,
                }
          );
        if (axes && Math.abs(v) > step * 1e-6)
          labels.push({
            tag: "text",
            attrs: {
              x: axis
                ? sx(Math.max(xr[0], Math.min(xr[1], 0))) - 24
                : sx(v) - 4,
              y: axis
                ? sy(v) + 4
                : sy(Math.max(yr[0], Math.min(yr[1], 0))) + 20,
              "font-size": 12,
              fill: ink,
            },
            text: String(Number(v.toPrecision(6))),
          });
      }
    }
  }
  if (axes && solidProject) {
    for (let i = 0; i < 3; i++) {
      const q = [0, 0, 0];
      q[i] = 1.15;
      const p = solidProject(q);
      line([0, 0], p, { arrow: true });
      label(["x", "y", "z"][i], p, "axes");
    }
  }
  if (axes && !solid) {
    if (yr[0] <= 0 && yr[1] >= 0) {
      line([xr[0], 0], [xr[1], 0], { arrow: true });
      label(
        type === "complex-plane" ? "Re" : "x",
        [xr[1], 0],
        "axes",
        [-12, -14]
      );
    }
    if (xr[0] <= 0 && xr[1] >= 0) {
      line([0, yr[0]], [0, yr[1]], { arrow: true });
      label(type === "complex-plane" ? "Im" : "y", [0, yr[1]], "axes", [10, 0]);
    }
    if (!points.O && inside([0, 0])) label("O", [0, 0], "axes", [-18, 18]);
  }
  function safeRelation(v: Value | undefined, p: string) {
    try {
      return relation(str(v, p));
    } catch (e) {
      fail(p, (e as Error).message);
    }
  }
  // Region polygons use triangle clipping of a sampled implicit field. This gives
  // smooth sub-cell boundaries without raster images or per-pixel SVG rectangles.
  function region(
    conditions: ReturnType<typeof relation>[],
    fill: string,
    p: string
  ) {
    if (!["light", "hatch"].includes(fill))
      fail(p + ".fill", "light または hatch を指定してください");
    const n = 100,
      m = Math.max(30, Math.round((n * (yr[1] - yr[0])) / (xr[1] - xr[0]))),
      ny = Math.min(160, m),
      dx = (xr[1] - xr[0]) / n,
      dy = (yr[1] - yr[0]) / ny;
    const signed = (x: number, y: number) =>
      Math.max(
        ...conditions.map((cond) => {
          const d = cond.value(x, y);
          if (!Number.isFinite(d)) return Infinity;
          return cond.test(x, y) ? -Math.abs(d) : Math.abs(d) || 1e-12;
        })
      );
    const rows = Array.from({ length: ny + 1 }, (_, j) =>
      Array.from({ length: n + 1 }, (_, i) =>
        signed(xr[0] + i * dx, yr[0] + j * dy)
      )
    );
    let path = "";
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < n; i++) {
        const q: Point[] = [
            [xr[0] + i * dx, yr[0] + j * dy],
            [xr[0] + (i + 1) * dx, yr[0] + j * dy],
            [xr[0] + (i + 1) * dx, yr[0] + (j + 1) * dy],
            [xr[0] + i * dx, yr[0] + (j + 1) * dy],
          ],
          vals = [
            rows[j][i],
            rows[j][i + 1],
            rows[j + 1][i + 1],
            rows[j + 1][i],
          ];
        for (const ids of [
          [0, 1, 2],
          [0, 2, 3],
        ]) {
          const poly: Point[] = [];
          for (let k = 0; k < 3; k++) {
            const a = ids[k],
              b = ids[(k + 1) % 3],
              va = vals[a],
              vb = vals[b];
            if (va <= 0) poly.push(q[a]);
            if (
              va <= 0 !== vb <= 0 &&
              Number.isFinite(va) &&
              Number.isFinite(vb)
            ) {
              const t = va / (va - vb);
              poly.push([
                q[a][0] + t * (q[b][0] - q[a][0]),
                q[a][1] + t * (q[b][1] - q[a][1]),
              ]);
            }
          }
          if (poly.length >= 3)
            path +=
              poly
                .map(
                  (a, k) =>
                    `${k ? "L" : "M"}${sx(a[0]).toFixed(2)},${sy(a[1]).toFixed(
                      2
                    )}`
                )
                .join("") + "Z";
        }
      }
    primitives.unshift({
      tag: "path",
      attrs: {
        d: path,
        fill: blue,
        "fill-opacity": fill === "hatch" ? 0.18 : 0.13,
        stroke: "none",
      },
    });
    if (fill === "hatch") {
      // clip each short hatch run by actual conditions
      for (let offset = -height; offset < width; offset += 12) {
        let start: Point | null = null;
        for (let py = top; py <= height - top; py += 2) {
          const px = offset + py,
            x = xr[0] + (px - left) / scale,
            y = yr[1] - (py - top) / scale,
            ok =
              px >= left &&
              px <= width - left &&
              conditions.every((r) => r.test(x, y));
          if (ok && !start) start = [px, py];
          if ((!ok || py + 2 > height - top) && start) {
            add("line", {
              x1: start[0],
              y1: start[1],
              x2: px - 2,
              y2: py - 2,
              stroke: blue,
              "stroke-width": 0.65,
              "stroke-opacity": 0.55,
            });
            start = null;
          }
        }
      }
    }
  }
  const regions = entries("regions");
  if (regions.length > 8) fail("regions", "領域は8件以内にしてください");
  if (
    c.regionMode !== undefined &&
    !["intersection", "overlay"].includes(String(c.regionMode))
  )
    fail("regionMode", "intersection または overlay を指定してください");
  const regionSpecs = regions.map(({ o, p }) => {
    keys(o, ["condition", "conditions", "fill"], p);
    const values =
      o.conditions === undefined
        ? [o.condition]
        : arr(o.conditions, p + ".conditions");
    if (!values.length || values.length > 8)
      fail(p, "条件は1〜8個を指定してください");
    return {
      conditions: values.map((v, i) => {
        const s = str(v, `${p}.condition[${i}]`);
        if (!/[<>]/.test(s)) fail(p, "塗りつぶしには不等式が必要です");
        return safeRelation(v, `${p}.condition[${i}]`)!;
      }),
      fill: String(o.fill ?? "light"),
      p,
    };
  });
  if (regionSpecs.length) {
    if (c.regionMode === "overlay")
      for (const r of regionSpecs) region(r.conditions, r.fill, r.p);
    else
      region(
        regionSpecs.flatMap((r) => r.conditions),
        regionSpecs.some((r) => r.fill === "hatch")
          ? "hatch"
          : regionSpecs[0].fill,
        "regions"
      );
  }
  function curve(fn: (t: number) => Point, r: Point, o: Mapping, p: string) {
    let prev: Point | null = null;
    let d = "",
      last = "";
    const flush = () => {
      if (d) add("path", { d, ...style(o, p) });
      d = "";
      last = "";
    };
    for (let i = 0; i <= 900; i++) {
      const q = fn(r[0] + ((r[1] - r[0]) * i) / 900);
      if (!q.every(Number.isFinite)) {
        flush();
        prev = null;
        continue;
      }
      if (
        prev &&
        Math.hypot((q[0] - prev[0]) * scale, (q[1] - prev[1]) * scale) < 120
      ) {
        const end = clip(prev, q, "segment");
        if (end) {
          const start = `${sx(end[0][0]).toFixed(2)},${sy(end[0][1]).toFixed(
              2
            )}`,
            finish = `${sx(end[1][0]).toFixed(2)},${sy(end[1][1]).toFixed(2)}`;
          d += (last === start ? "" : `M${start}`) + `L${finish}`;
          last = finish;
        } else flush();
      }
      prev = q;
    }
    flush();
  }
  function implicit(
    fn: (x: number, y: number) => number,
    o: Mapping,
    p: string
  ) {
    const n = 110,
      m = 90;
    const segments: [string, string][] = [];
    let d = "";
    for (let j = 0; j < m; j++)
      for (let i = 0; i < n; i++) {
        const q: Point[] = [
            [
              xr[0] + (i * (xr[1] - xr[0])) / n,
              yr[0] + (j * (yr[1] - yr[0])) / m,
            ],
            [
              xr[0] + ((i + 1) * (xr[1] - xr[0])) / n,
              yr[0] + (j * (yr[1] - yr[0])) / m,
            ],
            [
              xr[0] + ((i + 1) * (xr[1] - xr[0])) / n,
              yr[0] + ((j + 1) * (yr[1] - yr[0])) / m,
            ],
            [
              xr[0] + (i * (xr[1] - xr[0])) / n,
              yr[0] + ((j + 1) * (yr[1] - yr[0])) / m,
            ],
          ],
          v = q.map((a) => fn(...a));
        for (const ids of [
          [0, 1, 2],
          [0, 2, 3],
        ]) {
          const hit: Point[] = [];
          for (let k = 0; k < 3; k++) {
            const a = ids[k],
              b = ids[(k + 1) % 3];
            if (
              Number.isFinite(v[a]) &&
              Number.isFinite(v[b]) &&
              v[a] <= 0 !== v[b] <= 0
            ) {
              const t = v[a] / (v[a] - v[b]);
              hit.push([
                q[a][0] + t * (q[b][0] - q[a][0]),
                q[a][1] + t * (q[b][1] - q[a][1]),
              ]);
            }
          }
          if (hit.length === 2) {
            const a = `${sx(hit[0][0]).toFixed(2)},${sy(hit[0][1]).toFixed(2)}`,
              b = `${sx(hit[1][0]).toFixed(2)},${sy(hit[1][1]).toFixed(2)}`;
            if (a !== b) segments.push([a, b]);
          }
        }
      }
    const links = new Map<string, number[]>();
    segments.forEach(([a, b], i) => {
      links.set(a, [...(links.get(a) ?? []), i]);
      links.set(b, [...(links.get(b) ?? []), i]);
    });
    const used = new Set<number>();
    const walk = (start: string) => {
      let at = start;
      d += `M${at}`;
      while (true) {
        const edge = links.get(at)?.find((i) => !used.has(i));
        if (edge === undefined) break;
        used.add(edge);
        const [a, b] = segments[edge];
        at = at === a ? b : a;
        d += `L${at}`;
      }
    };
    for (const [point, edges] of links)
      if (edges.length === 1 && !used.has(edges[0])) walk(point);
    segments.forEach(([a], i) => {
      if (!used.has(i)) walk(a);
    });
    add("path", { d, ...style(o, p) });
  }
  if (c.boundaries === undefined)
    for (const { o, p } of regions) {
      const conditions =
        o.conditions === undefined
          ? [o.condition]
          : arr(o.conditions, p + ".conditions");
      for (const condition of conditions) {
        const r = safeRelation(condition, p + ".condition")!;
        implicit(r.value, { dashed: r.strict }, p);
      }
    }
  for (const { o, p } of entries("boundaries")) {
    keys(
      o,
      ["type", "equation", "center", "radius", "xRange", "labelAt", ...styles],
      p
    );
    const kind = str(o.type, p + ".type");
    if (!["line", "circle", "curve", "parabola", "ellipse"].includes(kind))
      fail(
        p + ".type",
        "line / circle / curve / parabola / ellipse を指定してください"
      );
    if (kind === "circle" && o.equation === undefined) {
      const a = ref(o.center, p + ".center"),
        r = num(o.radius, p + ".radius");
      if (r <= 0) fail(p + ".radius", "半径は正の数にしてください");
      curve(
        (t) => [a[0] + r * Math.cos(t), a[1] + r * Math.sin(t)],
        [0, 2 * Math.PI],
        o,
        p
      );
    } else {
      const rel = safeRelation(o.equation, p + ".equation")!;
      if (o.xRange !== undefined) {
        const rr = range(o.xRange, p + ".xRange", xr);
        implicit(
          (x, y) => (x < rr[0] || x > rr[1] ? NaN : rel.value(x, y)),
          o,
          p
        );
      } else implicit(rel.value, o, p);
    }
    if (o.label !== undefined)
      label(
        o.label,
        o.labelAt === undefined
          ? [xr[0], yr[1]]
          : ref(o.labelAt, p + ".labelAt"),
        p + ".label",
        o.labelOffset
      );
  }
  for (const key of ["polygons", "sections"])
    for (const { o, p } of entries(key)) {
      keys(o, ["points", ...styles], p);
      const ps = arr(o.points, p + ".points").map((v) => ref(v, p + ".points"));
      if (ps.length < 3) fail(p + ".points", "3点以上を指定してください");
      if (ps.some((a) => !inside(a)))
        fail(
          p + ".points",
          "多角形の頂点が表示範囲外です。xRange/yRangeを広げてください"
        );
      add("polygon", {
        points: ps.map((a) => `${sx(a[0])},${sy(a[1])}`).join(" "),
        ...style(o, p),
        stroke: bool(o.stroke, p + ".stroke", true) ? blue : "none",
        fill: bool(o.fill, p + ".fill", key === "sections") ? blue : "none",
        "fill-opacity": 0.16,
      });
    }
  for (const [a, b] of solidEdges) {
    const hidden = solidHidden.has([a, b].sort().join("|"));
    if (hidden && !bool(c.showHiddenEdges, "showHiddenEdges", true)) continue;
    line(ref(a, "edges"), ref(b, "edges"), { dashed: hidden });
  }
  for (const key of ["highlightSegments", "dashedSegments"])
    arr(c[key], key).forEach((v, i) => {
      const a = arr(v, `${key}[${i}]`);
      if (a.length !== 2) fail(`${key}[${i}]`, "2頂点を指定してください");
      line(ref(a[0], `${key}[${i}]`), ref(a[1], `${key}[${i}]`), {
        dashed: key === "dashedSegments",
        arrow: false,
      });
    });
  for (const key of ["vectors", "segments", "lines", "rays"])
    for (const { o, p } of [
      ...entries(key),
      ...(key === "segments"
        ? extraSegments
        : key === "lines"
        ? extraLines
        : []
      ).map((o) => ({ o, p: "constructions" })),
    ]) {
      keys(o, ["from", "to", "through", ...styles], p);
      const refs =
        o.through === undefined
          ? [o.from, o.to]
          : arr(o.through, p + ".through");
      if (refs.length !== 2) fail(p + ".through", "2点を指定してください");
      line(
        ref(refs[0], p + ".from"),
        ref(refs[1], p + ".to"),
        { ...o, arrow: o.arrow ?? key === "vectors" },
        key === "lines" ? "line" : key === "rays" ? "ray" : "segment",
        p
      );
    }
  for (const key of ["circles", "ellipses", "arcs"])
    for (const { o, p } of entries(key)) {
      keys(
        o,
        ["center", "radius", "rx", "ry", "startAngle", "endAngle", ...styles],
        p
      );
      const a = ref(o.center, p + ".center"),
        rx = num(key === "ellipses" ? o.rx : o.radius, p + ".radius"),
        ry = key === "ellipses" ? num(o.ry, p + ".ry") : rx;
      if (rx <= 0 || ry <= 0) fail(p + ".radius", "半径は正の数にしてください");
      const r: Point =
        key === "arcs"
          ? [
              (num(o.startAngle, p + ".startAngle") * Math.PI) / 180,
              (num(o.endAngle, p + ".endAngle") * Math.PI) / 180,
            ]
          : [0, 2 * Math.PI];
      curve((t) => [a[0] + rx * Math.cos(t), a[1] + ry * Math.sin(t)], r, o, p);
      label(o.label, [a[0] + rx, a[1]], p + ".label", o.labelOffset);
    }
  for (const { o, p } of entries("angleMarks")) {
    keys(o, ["vertex", "from", "to", "radius", ...styles], p);
    const a = ref(o.vertex, p + ".vertex"),
      b = ref(o.from, p + ".from"),
      d = ref(o.to, p + ".to");
    if (
      Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-10 ||
      Math.hypot(d[0] - a[0], d[1] - a[1]) < 1e-10
    )
      fail(p, "角の両辺には頂点と異なる点が必要です");
    let t0 = Math.atan2(b[1] - a[1], b[0] - a[0]),
      delta = Math.atan2(d[1] - a[1], d[0] - a[0]) - t0;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    const r = num(o.radius, p + ".radius", 24 / scale);
    if (r <= 0) fail(p + ".radius", "正の半径が必要です");
    curve(
      (t) => [a[0] + r * Math.cos(t), a[1] + r * Math.sin(t)],
      [t0, t0 + delta],
      o,
      p
    );
    t0 += delta / 2;
    label(
      o.label,
      [a[0] + r * 1.4 * Math.cos(t0), a[1] + r * 1.4 * Math.sin(t0)],
      p + ".label",
      o.labelOffset
    );
  }
  function safeExpr(v: Value | undefined, p: string) {
    try {
      return expression(str(v, p));
    } catch (e) {
      fail(p, (e as Error).message);
    }
  }
  if (type === "polar-graph" && bool(c.polarGrid, "polarGrid", true)) {
    for (
      let radius = 1;
      radius <=
      Math.min(10, Math.max(...xr.map(Math.abs), ...yr.map(Math.abs)));
      radius++
    )
      curve(
        (t) => [radius * Math.cos(t), radius * Math.sin(t)],
        [0, 2 * Math.PI],
        { dashed: true },
        "polarGrid"
      );
    for (let a = 0; a < Math.PI; a += Math.PI / 6)
      line(
        [0, 0],
        [Math.cos(a), Math.sin(a)],
        { dashed: true },
        "line",
        "polarGrid"
      );
  }
  const curves = [...entries("curves")];
  if (type === "parametric-curve" && c.x !== undefined)
    curves.push({
      o: { x: c.x, y: c.y, tRange: c.tRange ?? [0, 2 * Math.PI] },
      p: "curve",
    });
  if (type === "polar-graph" && c.r !== undefined)
    curves.push({
      o: { r: c.r, thetaRange: c.thetaRange ?? [0, 2 * Math.PI] },
      p: "curve",
    });
  if (["parametric-curve", "polar-graph"].includes(type) && !curves.length)
    fail("curves", "少なくとも1つの曲線を指定してください");
  for (const { o, p } of curves) {
    keys(o, ["x", "y", "r", "tRange", "thetaRange", ...styles], p);
    if (o.r !== undefined) {
      const fn = safeExpr(o.r, p + ".r")!;
      curve(
        (t) => {
          const r = fn({ theta: t, t });
          return [r * Math.cos(t), r * Math.sin(t)];
        },
        range(o.thetaRange, p + ".thetaRange", [0, 2 * Math.PI]),
        o,
        p
      );
    } else {
      const fx = safeExpr(o.x, p + ".x")!,
        fy = safeExpr(o.y, p + ".y")!;
      curve(
        (t) => [fx({ t }), fy({ t })],
        range(o.tRange, p + ".tRange", [0, 2 * Math.PI]),
        o,
        p
      );
    }
  }
  for (const pt of pointLabels) {
    const a = points[pt.id];
    if (!inside(a))
      fail(
        "points",
        `点 "${pt.id}" が表示範囲外です。xRange/yRangeを広げてください`
      );
    add("circle", { cx: sx(a[0]), cy: sy(a[1]), r: 3.4, fill: ink });
    occupied.push({ x: sx(a[0]) - 5, y: sy(a[1]) + 5, w: 10, h: 10 });
  }
  for (const pt of pointLabels)
    label(pt.label, points[pt.id], "points." + pt.id + ".label", pt.offset);
  primitives.push(...labels);
  return {
    width,
    height,
    primitives,
    points,
    title: String(c.caption ?? type),
  };
}
export function mathCConfigToSvg(config: MathCConfig) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${
    config.width
  }" height="${config.height}" viewBox="0 0 ${config.width} ${
    config.height
  }" role="img" aria-label="${xml(
    config.title
  )}"><rect width="100%" height="100%" fill="white"/><g font-family="Noto Sans Japanese, Noto Sans CJK JP, DejaVu Sans, sans-serif">${config.primitives
    .map(
      (p) =>
        `<${p.tag} ${Object.entries(p.attrs)
          .map(([k, v]) => `${k}="${xml(v)}"`)
          .join(" ")}>${p.text === undefined ? "" : xml(p.text)}</${p.tag}>`
    )
    .join("")}</g></svg>`;
}
