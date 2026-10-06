export type Point2 = [number, number];
export type Rect = { x: number; y: number; w: number; h: number };
export type Segment = { from: Point2; to: Point2 };
const overlap = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
function segmentHits(segment: Segment, rect: Rect) {
  // Bounded sampling is sufficient for label penalties, never changes geometry.
  for (let i = 0; i <= 12; i++) {
    const x = segment.from[0] + ((segment.to[0] - segment.from[0]) * i) / 12;
    const y = segment.from[1] + ((segment.to[1] - segment.from[1]) * i) / 12;
    if (
      x >= rect.x &&
      x <= rect.x + rect.w &&
      y >= rect.y &&
      y <= rect.y + rect.h
    )
      return true;
  }
  return false;
}
export function placeLabel(
  anchor: Point2,
  width: number,
  height: number,
  bounds: Rect,
  occupied: Rect[],
  segments: Segment[] = [],
  offset?: Point2
) {
  const offsets: Point2[] = offset
    ? [offset]
    : [
        [10, -12],
        [10, 22],
        [-width - 10, -12],
        [-width - 10, 22],
        [14, -30],
        [-width / 2, 35],
        [20, 45],
        [-width - 20, -35],
      ];
  let best: { rect: Rect; penalty: number } | undefined;
  for (const [dx, dy] of offsets) {
    const rect = {
      x: anchor[0] + dx,
      y: anchor[1] + dy - height,
      w: width,
      h: height,
    };
    const outside =
      Math.max(0, bounds.x - rect.x) +
      Math.max(0, rect.x + width - bounds.x - bounds.w) +
      Math.max(0, bounds.y - rect.y) +
      Math.max(0, rect.y + height - bounds.y - bounds.h);
    const penalty =
      outside * 100 +
      occupied.reduce((sum, b) => sum + overlap(rect, b) * 4, 0) +
      segments.filter((line) => segmentHits(line, rect)).length * 24;
    if (!best || penalty < best.penalty) best = { rect, penalty };
  }
  return { ...best!, manual: !!offset };
}

export function xml(value: unknown) {
  return String(value)
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;");
}
export const textWidth = (text: string, fontSize = 14) =>
  Array.from(text).reduce(
    (sum, char) =>
      sum + (/[\u2e80-\uffff]/u.test(char) ? fontSize : fontSize * 0.58),
    0
  );
export function inspectSvgViewport(svg: string) {
  const opening = svg.match(/<svg\b[^>]*>/iu)?.[0] ?? "";
  const viewBox = opening
    .match(/\bviewBox="([^"]+)"/u)?.[1]
    ?.split(/[\s,]+/u)
    .map(Number);
  if (
    !viewBox ||
    viewBox.length !== 4 ||
    viewBox.some((value) => !Number.isFinite(value)) ||
    viewBox[2] <= 0 ||
    viewBox[3] <= 0 ||
    viewBox[2] > 10000 ||
    viewBox[3] > 10000
  )
    throw new Error(
      "SVG viewBoxは有限の正の幅・高さ（最大10000）を指定してください。"
    );
  const [x, y, w, h] = viewBox;
  let minX = x,
    minY = y,
    maxX = x + w,
    maxY = y + h;
  const warnings: string[] = [];
  const recorded = svg.match(
    /<desc id="studio-layout-warnings">([\s\S]*?)<\/desc>/u
  )?.[1];
  if (recorded)
    warnings.push(
      ...recorded
        .replace(/&quot;/gu, '"')
        .replace(/&apos;/gu, "'")
        .replace(/&lt;/gu, "<")
        .replace(/&gt;/gu, ">")
        .replace(/&amp;/gu, "&")
        .split("\n")
        .filter(Boolean)
    );
  if (Math.max(w / h, h / w) > 12)
    warnings.push("図の縦横比が極端です。表示サイズを確認してください。");
  for (const match of svg.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/giu)) {
    const attrs = match[1];
    // Rotated/complex text remains explicitly unverified instead of guessed.
    if (/transform=|<tspan\b/u.test(attrs + match[2])) continue;
    const attr = (key: string, fallback: number) =>
      Number(
        attrs.match(new RegExp(`(?:^|\\s)${key}="([^"]+)"`))?.[1] ?? fallback
      );
    const tx = attr("x", NaN),
      ty = attr("y", NaN),
      font = attr("font-size", 15);
    if (![tx, ty, font].every(Number.isFinite)) continue;
    const width = textWidth(match[2].replace(/&[^;]+;/gu, "M"), font);
    const start =
      tx -
      (/text-anchor="middle"/u.test(attrs)
        ? width / 2
        : /text-anchor="end"/u.test(attrs)
        ? width
        : 0);
    minX = Math.min(minX, start - 4);
    maxX = Math.max(maxX, start + width + 4);
    minY = Math.min(minY, ty - font - 4);
    maxY = Math.max(maxY, ty + 4);
  }
  const expanded = minX < x || minY < y || maxX > x + w || maxY > y + h;
  if (expanded)
    warnings.push(
      "図表ラベルの切れを防ぐためSVG安全領域を拡張しました。図の座標は変更していません。"
    );
  const output = expanded
    ? svg.replace(
        opening,
        opening.replace(
          /viewBox="[^"]+"/u,
          `viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}"`
        )
      )
    : svg;
  return {
    svg: output,
    warnings,
    viewBox: [minX, minY, maxX - minX, maxY - minY],
  };
}

/** Shared geometry and label layout for new SVG extensions. */
export class SvgScene {
  readonly elements: string[] = [];
  readonly occupied: Rect[] = [];
  readonly segments: Segment[] = [];
  readonly warnings: string[] = [];
  constructor(readonly width = 640, readonly height = 360) {}
  line(from: Point2, to: Point2, style = "", arrow = false) {
    this.segments.push({ from, to });
    const stroke = style.match(/(?:^|\s)stroke="([^"]+)"/u)?.[1] ?? "#263542";
    const width = style.match(/(?:^|\s)stroke-width="([^"]+)"/u)?.[1] ?? "2";
    const rest = style.replace(/(?:^|\s)stroke(?:-width)?="[^"]+"/gu, "");
    this.elements.push(
      `<line x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${
        to[1]
      }" stroke="${stroke}" stroke-width="${width}" ${
        arrow ? 'marker-end="url(#studio-arrow)"' : ""
      } ${rest}/>`
    );
  }
  label(text: string, anchor: Point2, offset?: Point2, font = 15) {
    const placed = placeLabel(
      anchor,
      textWidth(text, font),
      font + 3,
      { x: 6, y: 6, w: this.width - 12, h: this.height - 12 },
      this.occupied,
      this.segments,
      offset
    );
    this.occupied.push(placed.rect);
    if (placed.penalty > 40)
      this.warnings.push(`ラベル「${text}」の配置を確認してください。`);
    this.elements.push(
      `<text x="${placed.rect.x}" y="${
        placed.rect.y + placed.rect.h
      }" font-size="${font}">${xml(text)}</text>`
    );
  }
  svg(alt: string) {
    const inspected = inspectSvgViewport(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${
        this.height
      }" viewBox="0 0 ${this.width} ${
        this.height
      }" role="img" aria-label="${xml(
        alt
      )}"><defs><marker id="studio-arrow" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto"><path d="M0 0 L8 3.5 L0 7 Z" fill="#263542"/></marker></defs><style>text{font-family:'Noto Sans JP','DejaVu Sans',sans-serif;fill:#263542}</style>${this.elements.join(
        ""
      )}</svg>`
    );
    const warnings = [...new Set([...this.warnings, ...inspected.warnings])];
    return warnings.length
      ? inspected.svg.replace(
          "</svg>",
          `<desc id="studio-layout-warnings">${xml(
            warnings.join("\n")
          )}</desc></svg>`
        )
      : inspected.svg;
  }
}
