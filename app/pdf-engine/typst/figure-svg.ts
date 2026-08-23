import {
  evaluatePolynomialFormula,
  parseBoxPlotConfig,
  parseCircleConfig,
  parseFunctionGraphConfig,
  parseHistogramConfig,
  parseNumberLineConfig,
  parseProbabilityDistributionConfig,
  parseScatterPlotConfig,
  parseSignChartConfig,
  parseTriangleConfig,
  parseVennDiagramConfig,
} from "../../studio-core";
import type { TypstBlockNode } from "./types";

type FigureNode = Extract<TypstBlockNode, { type: "Figure" }>;

const COLORS = ["#1769aa", "#d8560a", "#176b42", "#6b2b84", "#9c1133"];

function xml(value: unknown) {
  return String(value ?? "")
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;")
    .replace(/'/gu, "&apos;");
}

function svgFrame(body: string, width = 640, height = 350, label = "教材図表") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${xml(label)}">
  <style>
    text { font-family: "Noto Sans Japanese", "Noto Sans JP", "Noto Sans CJK JP", "DejaVu Sans", sans-serif; fill: #263542; font-size: 12px; }
    .axis { stroke: #41576a; stroke-width: 1.4; }
    .grid { stroke: #dfe7ed; stroke-width: 1; }
    .line { fill: none; stroke-width: 2.4; }
    .label { font-size: 11px; }
  </style>
  <rect width="100%" height="100%" fill="#ffffff"/>
  ${body}
</svg>`;
}

function finiteTicks(min: number, max: number, step: number, limit = 30) {
  const values: number[] = [];
  const first = Math.ceil((min - step * 1e-8) / step) * step;
  for (let value = first; value <= max + step * 1e-8 && values.length < limit; value += step) {
    values.push(Math.abs(value) < step * 1e-8 ? 0 : Number(value.toPrecision(10)));
  }
  return values;
}

function functionGraph(node: FigureNode) {
  const result = parseFunctionGraphConfig(node.params);
  if (!result.ok) throw new Error(result.errors.join(" "));
  const { xRange, yRange, xTick, yTick, showGrid, series, points, guides } = result.config;
  const left = 54;
  const right = 615;
  const top = 30;
  const bottom = 312;
  const sx = (value: number) => left + (value - xRange[0]) / (xRange[1] - xRange[0]) * (right - left);
  const sy = (value: number) => bottom - (value - yRange[0]) / (yRange[1] - yRange[0]) * (bottom - top);
  const xTicks = finiteTicks(xRange[0], xRange[1], xTick ?? (xRange[1] - xRange[0]) / 8);
  const yTicks = finiteTicks(yRange[0], yRange[1], yTick ?? (yRange[1] - yRange[0]) / 8);
  const grid = showGrid ? [
    ...xTicks.map((value) => `<line class="grid" x1="${sx(value)}" y1="${top}" x2="${sx(value)}" y2="${bottom}"/>`),
    ...yTicks.map((value) => `<line class="grid" x1="${left}" y1="${sy(value)}" x2="${right}" y2="${sy(value)}"/>`),
  ].join("\n") : "";
  const tickLabels = [
    ...xTicks.map((value) => `<text class="label" text-anchor="middle" x="${sx(value)}" y="${bottom + 18}">${xml(value)}</text>`),
    ...yTicks.map((value) => `<text class="label" text-anchor="end" x="${left - 7}" y="${sy(value) + 4}">${xml(value)}</text>`),
  ].join("\n");
  const curves = series.map((item, seriesIndex) => {
    const segments: string[] = [];
    let current: string[] = [];
    for (let index = 0; index <= 360; index += 1) {
      const x = xRange[0] + (xRange[1] - xRange[0]) * index / 360;
      const y = evaluatePolynomialFormula(item.formula, x);
      if (!Number.isFinite(y) || y < yRange[0] - (yRange[1] - yRange[0]) || y > yRange[1] + (yRange[1] - yRange[0])) {
        if (current.length > 1) segments.push(current.join(" "));
        current = [];
      } else current.push(`${sx(x).toFixed(2)},${sy(y).toFixed(2)}`);
    }
    if (current.length > 1) segments.push(current.join(" "));
    const dash = item.style === "dashed" ? "8 5" : item.style === "dotted" ? "2 5" : "none";
    return segments.map((segment) => `<polyline class="line" stroke="${COLORS[seriesIndex % COLORS.length]}" stroke-dasharray="${dash}" points="${segment}"/>`).join("\n");
  }).join("\n");
  const guideLines = guides.map((guide) => guide.axis === "x"
    ? `<line x1="${sx(guide.value)}" y1="${top}" x2="${sx(guide.value)}" y2="${bottom}" stroke="#8a99a6" stroke-dasharray="5 5"/>`
    : `<line x1="${left}" y1="${sy(guide.value)}" x2="${right}" y2="${sy(guide.value)}" stroke="#8a99a6" stroke-dasharray="5 5"/>`
  ).join("\n");
  const pointMarks = points.map((point) => `<g><circle cx="${sx(point.x)}" cy="${sy(point.y)}" r="4.5" fill="${point.marker === "open" ? "#fff" : "#173a67"}" stroke="#173a67" stroke-width="2"/><text x="${sx(point.x) + 8}" y="${sy(point.y) - 7}">${xml(point.label)}</text></g>`).join("\n");
  const axes = `<rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" fill="none" stroke="#657786"/>
    ${yRange[0] <= 0 && yRange[1] >= 0 ? `<line class="axis" x1="${left}" y1="${sy(0)}" x2="${right}" y2="${sy(0)}"/>` : ""}
    ${xRange[0] <= 0 && xRange[1] >= 0 ? `<line class="axis" x1="${sx(0)}" y1="${top}" x2="${sx(0)}" y2="${bottom}"/>` : ""}`;
  return svgFrame(`${grid}${axes}${guideLines}${curves}${pointMarks}${tickLabels}`, 640, 350, node.params.caption ?? "関数グラフ");
}

function dataChart(node: FigureNode) {
  const labels = (node.params.labels ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const values = (node.params.values ?? "").split(",").map(Number);
  if (!labels.length || labels.length !== values.length || values.some((value) => !Number.isFinite(value))) {
    throw new Error("labelsとvaluesを同じ個数の有限値で指定してください。");
  }
  const max = Math.max(1, ...values);
  const left = 54;
  const right = 610;
  const top = 30;
  const bottom = 300;
  const line = node.params.type === "line";
  const step = (right - left) / Math.max(1, labels.length);
  const x = (index: number) => left + step * (index + 0.5);
  const y = (value: number) => bottom - value / max * (bottom - top - 18);
  const marks = line
    ? `<polyline class="line" stroke="${COLORS[0]}" points="${values.map((value, index) => `${x(index)},${y(value)}`).join(" ")}"/>${values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="4" fill="${COLORS[0]}"/>`).join("")}`
    : values.map((value, index) => `<rect x="${x(index) - step * 0.28}" y="${y(value)}" width="${step * 0.56}" height="${bottom - y(value)}" rx="3" fill="${COLORS[index % COLORS.length]}"/>`).join("\n");
  const labelsSvg = labels.map((label, index) => `<text text-anchor="middle" x="${x(index)}" y="${bottom + 19}">${xml(label)}</text><text text-anchor="middle" x="${x(index)}" y="${y(values[index]) - 7}">${xml(values[index])}</text>`).join("\n");
  return svgFrame(`<line class="axis" x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}"/><line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${bottom}"/>${marks}${labelsSvg}`, 640, 340, node.params.caption ?? "データグラフ");
}

function numberLine(node: FigureNode) {
  const result = parseNumberLineConfig(node.params);
  if (!result.ok) throw new Error(result.errors.join(" "));
  const { min, max, interval, endpoints, points, tickStep } = result.config;
  const left = 55;
  const right = 585;
  const axisY = 105;
  const sx = (value: number) => left + (value - min) / (max - min) * (right - left);
  const ticks = finiteTicks(min, max, tickStep ?? (max - min) / 10);
  const intervalSvg = interval ? `<line x1="${sx(interval[0])}" y1="${axisY}" x2="${sx(interval[1])}" y2="${axisY}" stroke="${COLORS[0]}" stroke-width="7" stroke-linecap="round"/>
    ${[0, 1].map((index) => `<circle cx="${sx(interval[index])}" cy="${axisY}" r="7" fill="${endpoints[index] === "open" ? "#fff" : COLORS[0]}" stroke="${COLORS[0]}" stroke-width="2"/>`).join("")}` : "";
  const pointsSvg = points.map((point) => `<circle cx="${sx(point.value)}" cy="${axisY}" r="5" fill="${point.marker === "open" ? "#fff" : "#173a67"}" stroke="#173a67" stroke-width="2"/><text text-anchor="middle" x="${sx(point.value)}" y="${axisY - 15}">${xml(point.label)}</text>`).join("\n");
  const ticksSvg = ticks.map((value) => `<line x1="${sx(value)}" y1="${axisY - 6}" x2="${sx(value)}" y2="${axisY + 6}" stroke="#41576a"/><text text-anchor="middle" x="${sx(value)}" y="${axisY + 25}">${xml(value)}</text>`).join("\n");
  return svgFrame(`<line class="axis" x1="${left}" y1="${axisY}" x2="${right}" y2="${axisY}"/>${intervalSvg}${pointsSvg}${ticksSvg}`, 640, 175, node.params.caption ?? "数直線");
}

function signChart(node: FigureNode) {
  const result = parseSignChartConfig(node.params);
  if (!result.ok) throw new Error(result.errors.join(" "));
  const { variable, criticalPoints, rows } = result.config;
  const columns = criticalPoints.length * 2 + 1;
  const cellWidth = 500 / columns;
  const left = 110;
  const top = 35;
  const rowHeight = 44;
  const headers: string[] = [];
  for (let index = 0; index < columns; index += 1) {
    if (index % 2 === 1) headers.push(`${variable}=${criticalPoints[(index - 1) / 2]}`);
    else if (index === 0) headers.push(`${variable}<${criticalPoints[0]}`);
    else if (index === columns - 1) headers.push(`${variable}>${criticalPoints.at(-1)}`);
    else headers.push(`${criticalPoints[index / 2 - 1]}<${variable}<${criticalPoints[index / 2]}`);
  }
  const lines = Array.from({ length: columns + 1 }, (_, index) => `<line x1="${left + index * cellWidth}" y1="${top}" x2="${left + index * cellWidth}" y2="${top + (rows.length + 1) * rowHeight}" stroke="#9aa8b4"/>`).join("");
  const horizontal = Array.from({ length: rows.length + 2 }, (_, index) => `<line x1="20" y1="${top + index * rowHeight}" x2="610" y2="${top + index * rowHeight}" stroke="#9aa8b4"/>`).join("");
  const content = headers.map((header, index) => `<text text-anchor="middle" x="${left + (index + 0.5) * cellWidth}" y="${top + 27}">${xml(header)}</text>`).join("") + rows.map((row, rowIndex) => `<text text-anchor="middle" x="65" y="${top + (rowIndex + 1.7) * rowHeight}">${xml(row.label)}</text>${row.cells.map((cell, index) => `<text text-anchor="middle" x="${left + (index + 0.5) * cellWidth}" y="${top + (rowIndex + 1.7) * rowHeight}">${xml(cell)}</text>`).join("")}`).join("");
  return svgFrame(`${horizontal}${lines}${content}`, 640, top * 2 + (rows.length + 1) * rowHeight, node.params.caption ?? "符号表");
}

function triangle(node: FigureNode) {
  const result = parseTriangleConfig(node.params);
  if (!result.ok) throw new Error(result.errors.join(" "));
  const { vertices, sides, angles } = result.config;
  const points = vertices.map((point) => `${point.x},${point.y}`).join(" ");
  const centroid = {
    x: vertices.reduce((sum, point) => sum + point.x, 0) / vertices.length,
    y: vertices.reduce((sum, point) => sum + point.y, 0) / vertices.length,
  };
  const direction = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: dx / length, y: dy / length };
  };
  const labels = vertices.map((point) => {
    const outward = direction(centroid, point);
    const x = point.x + outward.x * 15;
    const y = point.y + outward.y * 15 + 4;
    const anchor = outward.x > 0.25 ? "start" : outward.x < -0.25 ? "end" : "middle";
    return `<circle cx="${point.x}" cy="${point.y}" r="3.5" fill="#173a67"/><text text-anchor="${anchor}" x="${x.toFixed(2)}" y="${y.toFixed(2)}">${xml(point.label)}</text>`;
  }).join("");
  const byLabel = new Map(vertices.map((point) => [point.label, point]));
  const sideLabels = sides.map((side) => {
    const from = byLabel.get(side.from)!;
    const to = byLabel.get(side.to)!;
    const midpoint = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    const outward = direction(centroid, midpoint);
    return `<text text-anchor="middle" dominant-baseline="middle" x="${(midpoint.x + outward.x * 13).toFixed(2)}" y="${(midpoint.y + outward.y * 13).toFixed(2)}">${xml(side.label)}</text>`;
  }).join("");
  const angleLabels = angles.filter((angle) => angle.label.trim() !== angle.vertex.trim()).map((angle) => {
    const point = byLabel.get(angle.vertex)!;
    const inward = direction(point, centroid);
    return `<text text-anchor="middle" dominant-baseline="middle" x="${(point.x + inward.x * 21).toFixed(2)}" y="${(point.y + inward.y * 21).toFixed(2)}">${xml(angle.label)}</text>`;
  }).join("");
  return svgFrame(`<polygon points="${points}" fill="#edf5fb" stroke="#173a67" stroke-width="2"/>${labels}${sideLabels}${angleLabels}`, 440, 270, node.params.caption ?? "三角形");
}

function circle(node: FigureNode) {
  const result = parseCircleConfig(node.params);
  if (!result.ok) throw new Error(result.errors.join(" "));
  const { center, radius, points, segments, showCenter } = result.config;
  const cx = 220;
  const cy = 145;
  const pointMap = new Map(points.map((point) => {
    const radians = point.angle * Math.PI / 180;
    return [point.label, { x: cx + radius * Math.cos(radians), y: cy - radius * Math.sin(radians) }];
  }));
  pointMap.set(center, { x: cx, y: cy });
  const lines = segments.map((segment) => {
    const from = pointMap.get(segment.from);
    const to = pointMap.get(segment.to);
    if (!from || !to) return "";
    return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="#1769aa" stroke-width="1.8"/><text text-anchor="middle" x="${(from.x + to.x) / 2}" y="${(from.y + to.y) / 2 - 6}">${xml(segment.label)}</text>`;
  }).join("");
  const marks = points.map((point) => {
    const value = pointMap.get(point.label)!;
    return `<circle cx="${value.x}" cy="${value.y}" r="3.5" fill="#173a67"/><text x="${value.x + 7}" y="${value.y - 7}">${xml(point.label)}</text>`;
  }).join("");
  return svgFrame(`<circle cx="${cx}" cy="${cy}" r="${radius}" fill="#f4f9fd" stroke="#173a67" stroke-width="2"/>${lines}${marks}${showCenter ? `<circle cx="${cx}" cy="${cy}" r="3.5" fill="#173a67"/><text x="${cx + 7}" y="${cy - 7}">${xml(center)}</text>` : ""}`, 440, 290, node.params.caption ?? "円");
}

function histogram(node: FigureNode) {
  const result = parseHistogramConfig(node.params);
  if (!result.ok) throw new Error(result.errors.join(" "));
  const { boundaries, frequencies, yMax, xLabel, yLabel } = result.config;
  const left = 62;
  const right = 610;
  const top = 28;
  const bottom = 295;
  const sx = (value: number) => left + (value - boundaries[0]) / (boundaries.at(-1)! - boundaries[0]) * (right - left);
  const sy = (value: number) => bottom - value / yMax * (bottom - top);
  const bars = frequencies.map((value, index) => `<rect x="${sx(boundaries[index])}" y="${sy(value)}" width="${sx(boundaries[index + 1]) - sx(boundaries[index])}" height="${bottom - sy(value)}" fill="#b9d8ee" stroke="#1769aa"/><text text-anchor="middle" x="${(sx(boundaries[index]) + sx(boundaries[index + 1])) / 2}" y="${sy(value) - 6}">${xml(value)}</text>`).join("");
  const ticks = boundaries.map((value) => `<text text-anchor="middle" x="${sx(value)}" y="${bottom + 18}">${xml(value)}</text>`).join("");
  return svgFrame(`<line class="axis" x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}"/><line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${bottom}"/>${bars}${ticks}<text text-anchor="middle" x="${(left + right) / 2}" y="330">${xml(xLabel)}</text><text x="12" y="24">${xml(yLabel)}</text>`, 640, 345, node.params.caption ?? "ヒストグラム");
}

function boxPlot(node: FigureNode) {
  const result = parseBoxPlotConfig(node.params);
  if (!result.ok) throw new Error(result.errors.join(" "));
  const { series, range } = result.config;
  const left = 82;
  const right = 600;
  const sx = (value: number) => left + (value - range[0]) / (range[1] - range[0]) * (right - left);
  const marks = series.map((item, index) => {
    const y = 55 + index * 62;
    const [min, q1, median, q3, max] = item.fiveNumber;
    return `<text text-anchor="end" x="${left - 10}" y="${y + 5}">${xml(item.label)}</text><line x1="${sx(min)}" y1="${y}" x2="${sx(max)}" y2="${y}" stroke="#173a67"/><line x1="${sx(min)}" y1="${y - 10}" x2="${sx(min)}" y2="${y + 10}" stroke="#173a67"/><line x1="${sx(max)}" y1="${y - 10}" x2="${sx(max)}" y2="${y + 10}" stroke="#173a67"/><rect x="${sx(q1)}" y="${y - 17}" width="${sx(q3) - sx(q1)}" height="34" fill="#dcecf8" stroke="#1769aa"/><line x1="${sx(median)}" y1="${y - 17}" x2="${sx(median)}" y2="${y + 17}" stroke="#9c1133" stroke-width="2"/>${item.outliers.map((value) => `<circle cx="${sx(value)}" cy="${y}" r="3" fill="#d8560a"/>`).join("")}`;
  }).join("");
  return svgFrame(marks, 640, Math.max(140, 90 + series.length * 62), node.params.caption ?? "箱ひげ図");
}

function scatter(node: FigureNode) {
  const result = parseScatterPlotConfig(node.params);
  if (!result.ok) throw new Error(result.errors.join(" "));
  const { points, xRange, yRange, trend } = result.config;
  const left = 60;
  const right = 610;
  const top = 28;
  const bottom = 305;
  const sx = (value: number) => left + (value - xRange[0]) / (xRange[1] - xRange[0]) * (right - left);
  const sy = (value: number) => bottom - (value - yRange[0]) / (yRange[1] - yRange[0]) * (bottom - top);
  const marks = points.map((point) => `<circle cx="${sx(point.x)}" cy="${sy(point.y)}" r="4" fill="#1769aa"/>${point.label ? `<text x="${sx(point.x) + 6}" y="${sy(point.y) - 6}">${xml(point.label)}</text>` : ""}`).join("");
  const trendLine = trend ? `<line x1="${sx(xRange[0])}" y1="${sy(trend.slope * xRange[0] + trend.intercept)}" x2="${sx(xRange[1])}" y2="${sy(trend.slope * xRange[1] + trend.intercept)}" stroke="#d8560a" stroke-width="2" stroke-dasharray="7 5"/>` : "";
  return svgFrame(`<rect x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" fill="none" stroke="#657786"/>${trendLine}${marks}`, 640, 335, node.params.caption ?? "散布図");
}

function probability(node: FigureNode) {
  const result = parseProbabilityDistributionConfig(node.params);
  if (!result.ok) throw new Error(result.errors.join(" "));
  const { distribution, n, p, mean, standardDeviation, xRange } = result.config;
  const left = 55;
  const right = 610;
  const top = 32;
  const bottom = 300;
  const sx = (value: number) => left + (value - xRange[0]) / (xRange[1] - xRange[0]) * (right - left);
  if (distribution === "binomial") {
    const factorial = (value: number) => Array.from({ length: value }, (_, index) => index + 1).reduce((a, b) => a * b, 1);
    const values = Array.from({ length: (n ?? 0) + 1 }, (_, k) => factorial(n ?? 0) / (factorial(k) * factorial((n ?? 0) - k)) * (p ?? 0) ** k * (1 - (p ?? 0)) ** ((n ?? 0) - k));
    const max = Math.max(...values, 1e-6);
    const bars = values.map((value, k) => `<rect x="${sx(k) - 7}" y="${bottom - value / max * (bottom - top)}" width="14" height="${value / max * (bottom - top)}" fill="#1769aa"/>`).join("");
    return svgFrame(`<line class="axis" x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}"/>${bars}`, 640, 330, node.params.caption ?? "二項分布");
  }
  const samples = Array.from({ length: 241 }, (_, index) => {
    const x = xRange[0] + (xRange[1] - xRange[0]) * index / 240;
    const y = Math.exp(-0.5 * ((x - mean) / standardDeviation) ** 2);
    return `${sx(x)},${bottom - y * (bottom - top)}`;
  });
  return svgFrame(`<line class="axis" x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}"/><polyline class="line" stroke="#1769aa" points="${samples.join(" ")}"/>`, 640, 330, node.params.caption ?? "正規分布");
}

function venn(node: FigureNode) {
  const result = parseVennDiagramConfig(node.params);
  if (!result.ok) throw new Error(result.errors.join(" "));
  const { sets, universe, showUniverse } = result.config;
  const positions = sets.length === 2
    ? [{ x: 230, y: 145 }, { x: 350, y: 145 }]
    : [{ x: 240, y: 130 }, { x: 350, y: 130 }, { x: 295, y: 205 }];
  const circles = sets.map((set, index) => `<circle cx="${positions[index].x}" cy="${positions[index].y}" r="92" fill="${COLORS[index]}22" stroke="${COLORS[index]}" stroke-width="2"/><text text-anchor="middle" x="${positions[index].x}" y="${positions[index].y - 100}">${xml(set.label)}</text>`).join("");
  return svgFrame(`${showUniverse ? `<rect x="55" y="28" width="530" height="285" fill="none" stroke="#41576a"/><text x="65" y="48">${xml(universe)}</text>` : ""}${circles}`, 640, 340, node.params.caption ?? "ベン図");
}

function simpleTree(node: FigureNode) {
  const rootRaw = (node.params.root ?? "root | 開始").split("|").map((item) => item.trim());
  const rootId = rootRaw[0].split(":")[0].trim();
  const rootLabel = rootRaw[1] || rootRaw[0].split(":")[1] || rootId;
  const branches = (node.params.branches ?? "").split(";").map((item) => item.trim()).filter(Boolean).map((entry) => {
    const [edge = "", label = "", probabilityText = ""] = entry.split("|").map((item) => item.trim());
    const [from = "", to = ""] = edge.split(">").map((item) => item.trim());
    return { from, to, label, probabilityText };
  });
  if (!rootId || branches.length < 2) throw new Error("rootと2本以上のbranchesを指定してください。");
  const levels = new Map<string, number>([[rootId, 0]]);
  for (let pass = 0; pass < 10; pass += 1) for (const branch of branches) if (levels.has(branch.from) && !levels.has(branch.to)) levels.set(branch.to, (levels.get(branch.from) ?? 0) + 1);
  const maxLevel = Math.max(...levels.values());
  const nodesByLevel = Array.from({ length: maxLevel + 1 }, () => [] as string[]);
  for (const [id, level] of levels) nodesByLevel[level].push(id);
  const coordinates = new Map<string, { x: number; y: number }>();
  nodesByLevel.forEach((ids, level) => ids.forEach((id, index) => coordinates.set(id, { x: 70 + level * (500 / Math.max(1, maxLevel)), y: 55 + index * (250 / Math.max(1, ids.length - 1)) })));
  const edges = branches.map((branch) => {
    const from = coordinates.get(branch.from);
    const to = coordinates.get(branch.to);
    if (!from || !to) return "";
    return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="#657786"/><text text-anchor="middle" x="${(from.x + to.x) / 2}" y="${(from.y + to.y) / 2 - 6}">${xml([branch.label, branch.probabilityText].filter(Boolean).join(" "))}</text>`;
  }).join("");
  const labels = [...coordinates].map(([id, point]) => `<circle cx="${point.x}" cy="${point.y}" r="16" fill="#edf5fb" stroke="#1769aa"/><text text-anchor="middle" x="${point.x}" y="${point.y + 4}">${xml(id === rootId ? rootLabel : id)}</text>`).join("");
  return svgFrame(`${edges}${labels}`, 640, 340, node.params.caption ?? "樹形図");
}

export function sanitizeMermaidSvg(svg: string) {
  if (!/^\s*<svg\b/iu.test(svg) || !/<\/svg>\s*$/iu.test(svg)) throw new Error("Mermaid SVGの形式が正しくありません。");
  if (/<(?:script|foreignObject|iframe|object|embed)\b/iu.test(svg)) throw new Error("Mermaid SVGに許可されていない要素があります。");
  if (/\b(?:href|src)\s*=\s*["'](?:https?:|file:|data:|\/\/)/iu.test(svg)) throw new Error("Mermaid SVGから外部資産は参照できません。");
  if (/<!DOCTYPE|<!ENTITY/iu.test(svg)) throw new Error("Mermaid SVGでDTDは使用できません。");
  return svg
    .replace(/<\?xml[\s\S]*?\?>/giu, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/giu, "");
}

export function generateFigureSvg(node: FigureNode, mermaidAssets: Record<string, string> = {}) {
  if (node.figureType === "mermaid") {
    const supplied = mermaidAssets[node.assetPath];
    if (!supplied) throw new Error("Mermaid図のSVG生成が完了していません。");
    return sanitizeMermaidSvg(supplied);
  }
  if (node.figureType === "function-graph") return functionGraph(node);
  if (node.figureType === "data-chart" || node.figureType === "bar-chart" || node.figureType === "line-chart") return dataChart(node);
  if (node.figureType === "number-line") return numberLine(node);
  if (node.figureType === "sign-chart") return signChart(node);
  if (node.figureType === "triangle") return triangle(node);
  if (node.figureType === "circle") return circle(node);
  if (node.figureType === "venn-diagram" || node.figureType === "venn") return venn(node);
  if (node.figureType === "tree-diagram") return simpleTree(node);
  if (node.figureType === "histogram") return histogram(node);
  if (node.figureType === "box-plot") return boxPlot(node);
  if (node.figureType === "scatter-plot" || node.figureType === "scatter") return scatter(node);
  if (node.figureType === "probability-distribution") return probability(node);
  throw new Error(`Typst Engineはfigure ${node.figureType}にまだ対応していません。`);
}
