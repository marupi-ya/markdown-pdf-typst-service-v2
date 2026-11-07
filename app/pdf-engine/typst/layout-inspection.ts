export const PDF_LAYOUT_CONTENT_TYPE = "application/vnd.studio.pdf-layout";
export const MAX_LAYOUT_BYTES = 600_000;

export type PdfPosition = { page: number; x: number; y: number };
export type PdfSourceSpan = {
  id: string;
  line: number;
  kind: string;
  start: PdfPosition;
  end: PdfPosition;
};
export type PdfLayoutInspection = {
  spans: PdfSourceSpan[];
  keepOverflow: number[];
};

export function readLayoutInspection(metadata: unknown[], pages: number): PdfLayoutInspection {
  const starts = new Map<string, Omit<PdfSourceSpan, "end">>();
  const ends = new Map<string, PdfPosition>();
  const keepOverflow = new Set<number>();
  const isLine = (line: unknown): line is number => typeof line === "number" && Number.isInteger(line) && line > 0;
  for (const value of metadata) {
    if (!value || typeof value !== "object") continue;
    const mark = value as Record<string, unknown>;
    if (isLine(mark.keepOverflow)) keepOverflow.add(mark.keepOverflow);
    const { layoutId, line, kind, page, x, y } = mark;
    if (typeof layoutId !== "string" || typeof kind !== "string" || !isLine(line) ||
        !isLine(page) || page > pages || typeof x !== "number" || typeof y !== "number" ||
        !Number.isFinite(x) || !Number.isFinite(y)) continue;
    const position = { page, x, y };
    if (mark.edge === "start") starts.set(layoutId, { id: layoutId, line, kind, start: position });
    else if (mark.edge === "end") ends.set(layoutId, position);
  }
  const spans = [...starts.values()].flatMap(start => {
    const end = ends.get(start.id);
    return end && end.page >= start.start.page ? [{ ...start, end }] : [];
  });
  return { spans, keepOverflow: [...keepOverflow] };
}
