import { PAGINATION_CONFIG } from "./config";
import { measurePageGeometry } from "./measure";

export type PageOverflow = {
  page: number;
  nodeId: string;
  nodeType: string;
  overflowPx: number;
  actualContentBottom: number;
  allowedContentBottom: number;
  reason: string;
};

export type PageContentBounds = {
  page: number;
  actualContentBottom: number;
  allowedContentBottom: number;
  overflowPx: number;
};

export type PaginationAnomaly = {
  page: number;
  nodeId: string;
  line: number;
  kind:
    | "orphan-heading"
    | "orphan-problem-title"
    | "orphan-box-title"
    | "tiny-text-fragment"
    | "widow-line"
    | "figure-split"
    | "invalid-table-fragment"
    | "container-frame"
    | "excessive-whitespace";
  severity: "error" | "warning";
  reason: string;
};

export function paginationAnomalyTitle(kind: PaginationAnomaly["kind"]) {
  const titles: Record<PaginationAnomaly["kind"], string> = {
    "orphan-heading": "孤立見出し",
    "orphan-problem-title": "孤立した問題タイトル",
    "orphan-box-title": "孤立したBOXタイトル",
    "tiny-text-fragment": "短い文章の孤立",
    "widow-line": "段落の1行孤立",
    "figure-split": "図表の不正分割",
    "invalid-table-fragment": "表の不正分割",
    "container-frame": "BOX枠の異常",
    "excessive-whitespace": "不自然な大きい空白",
  };
  return titles[kind];
}

export function inspectPageContentBounds(container: HTMLElement): PageContentBounds[] {
  const pages = Array.from(container.querySelectorAll<HTMLElement>(".paper"));
  return pages.map((page, index) => {
    const content = page.querySelector<HTMLElement>(".paper-content");
    const geometry = measurePageGeometry(page);
    const pageRect = page.getBoundingClientRect();
    const scale = Math.max(0.0001, geometry.coordinateScale);
    const topLevelBlocks = content
      ? Array.from(content.children).filter((element): element is HTMLElement =>
          element instanceof HTMLElement && element.matches("[data-measure='block']")
        )
      : [];
    const actualContentBottom = topLevelBlocks.reduce(
      (bottom, block) => Math.max(bottom, (block.getBoundingClientRect().bottom - pageRect.top) / scale),
      geometry.contentTop,
    );
    const roundedScrollOverflow = content
      ? Math.max(0, content.scrollHeight - content.clientHeight)
      : 0;
    const geometryOverflow = Math.max(0, actualContentBottom - geometry.contentBottom);
    return {
      page: Number(page.dataset.pageNumber ?? index + 1),
      actualContentBottom,
      allowedContentBottom: geometry.contentBottom,
      overflowPx: Math.max(roundedScrollOverflow, geometryOverflow),
    };
  });
}

export function inspectPageOverflow(container: HTMLElement): PageOverflow[] {
  const failures: PageOverflow[] = [];
  const pages = Array.from(container.querySelectorAll<HTMLElement>(".paper"));
  const bounds = inspectPageContentBounds(container);
  for (const [index, page] of pages.entries()) {
    const content = page.querySelector<HTMLElement>(".paper-content");
    const pageBounds = bounds[index];
    if (!content || !pageBounds || pageBounds.overflowPx <= PAGINATION_CONFIG.overflowTolerancePx) continue;
    const geometry = measurePageGeometry(page);
    const pageRect = page.getBoundingClientRect();
    const scale = Math.max(0.0001, geometry.coordinateScale);
    const overflowingNode = Array.from(
      content.querySelectorAll<HTMLElement>("[data-block-id]"),
    ).find((node) =>
      (node.getBoundingClientRect().bottom - pageRect.top) / scale >
      geometry.contentBottom + PAGINATION_CONFIG.overflowTolerancePx
    );
    failures.push({
      page: Number(page.dataset.pageNumber ?? index + 1),
      nodeId: overflowingNode?.dataset.blockId ?? "unknown",
      nodeType: overflowingNode?.dataset.paginationNodeType ?? "unknown",
      overflowPx: pageBounds.overflowPx,
      actualContentBottom: pageBounds.actualContentBottom,
      allowedContentBottom: pageBounds.allowedContentBottom,
      reason: overflowingNode
        ? "描画後の要素が実Page DOMの安全な本文下端を超えています。"
        : "本文コンテナのscrollHeightが許容高を超えています。",
    });
  }
  return failures;
}

export function assertNoPageOverflow(container: HTMLElement) {
  const failures = inspectPageOverflow(container);
  if (!failures.length) return;
  const first = failures[0];
  throw new Error(
    `PDF生成を中止しました。${first.page}ページ目の${first.nodeType}（${first.nodeId}）が本文領域を${first.overflowPx.toFixed(1)}px超えています。`,
  );
}

export function inspectPaginationAnomalies(container: HTMLElement): PaginationAnomaly[] {
  const anomalies: PaginationAnomaly[] = [];
  const pages = Array.from(container.querySelectorAll<HTMLElement>(".paper"));
  const isMeaningful = (element: HTMLElement) => {
    const nodeType = element.dataset.paginationNodeType;
    if (nodeType === "hr" || nodeType === "page-break") return false;
    if (nodeType === "figure" || nodeType === "math" || nodeType === "table" || nodeType === "code") return true;
    return Boolean(element.textContent?.replace(/\s+/gu, "").trim());
  };
  const leafBlocksFor = (content: HTMLElement) =>
    Array.from(content.querySelectorAll<HTMLElement>("[data-measure='block']"))
      .filter((element) => !element.querySelector("[data-measure='block']"))
      .filter(isMeaningful);
  const topLevelBlocksFor = (content: HTMLElement) =>
    Array.from(content.children)
      .filter((element): element is HTMLElement =>
        element instanceof HTMLElement &&
        element.matches("[data-measure='block']") &&
        isMeaningful(element)
      );

  for (const [index, page] of pages.entries()) {
    const pageNumber = Number(page.dataset.pageNumber ?? index + 1);
    const content = page.querySelector<HTMLElement>(".paper-content");
    if (!content) continue;
    const topLevelBlocks = topLevelBlocksFor(content);
    const meaningfulLeaves = leafBlocksFor(content);
    const trailingMeaningful = meaningfulLeaves.at(-1);

    if (
      trailingMeaningful?.dataset.paginationNodeType === "heading" ||
      trailingMeaningful?.dataset.paginationRole === "heading"
    ) {
      anomalies.push({
        page: pageNumber,
        nodeId: trailingMeaningful.dataset.blockId ?? "unknown",
        line: Number(trailingMeaningful.dataset.sourceLine ?? 1),
        kind: "orphan-heading",
        severity: "error",
        reason: "装飾要素を除いたページ最後の要素が見出しです。",
      });
    }

    for (const element of [topLevelBlocks[0], topLevelBlocks.at(-1)]) {
      if (!element || element.dataset.paginationNodeType !== "paragraph") continue;
      const text = element.textContent?.replace(/\s+/gu, "").trim() ?? "";
      const lineCount = Number(element.dataset.paginationLineCount ?? 0);
      const fragmentCount = Number(element.dataset.paginationFragmentCount ?? 1);
      if (lineCount > 1 || fragmentCount <= 1 || text.length > 8) continue;
      anomalies.push({
        page: pageNumber,
        nodeId: element.dataset.blockId ?? "unknown",
        line: Number(element.dataset.sourceLine ?? 1),
        kind: "tiny-text-fragment",
        severity: "warning",
        reason: "実測1行の短い文章「" + text + "」だけがページ境界に残っています。",
      });
    }

    for (const element of topLevelBlocks) {
      const fragmentCount = Number(element.dataset.paginationFragmentCount ?? 1);
      if (element.dataset.paginationNodeType === "figure" && fragmentCount > 1) {
        anomalies.push({
          page: pageNumber,
          nodeId: element.dataset.blockId ?? "unknown",
          line: Number(element.dataset.sourceLine ?? 1),
          kind: "figure-split",
          severity: "error",
          reason: "atomicな図表が複数fragmentへ分割されています。",
        });
      }
      if (
        element.dataset.paginationNodeType === "table" &&
        fragmentCount > 1 &&
        !element.querySelector("table thead")
      ) {
        anomalies.push({
          page: pageNumber,
          nodeId: element.dataset.blockId ?? "unknown",
          line: Number(element.dataset.sourceLine ?? 1),
          kind: "invalid-table-fragment",
          severity: "error",
          reason: "分割後の表でヘッダーが再表示されていません。",
        });
      }
      if (element.dataset.paginationNodeType !== "callout") continue;
      const callout = element.querySelector<HTMLElement>(":scope > .lesson-callout");
      const calloutContent = callout?.querySelector<HTMLElement>(":scope > .callout-content");
      const bodyText = calloutContent?.textContent?.replace(/\s+/gu, "").trim() ?? "";
      const nestedMeaningful = calloutContent
        ? leafBlocksFor(calloutContent)
        : [];
      if (!bodyText && !nestedMeaningful.length) {
        const role = element.dataset.paginationRole;
        anomalies.push({
          page: pageNumber,
          nodeId: element.dataset.blockId ?? "unknown",
          line: Number(element.dataset.sourceLine ?? 1),
          kind: role === "problem" ? "orphan-problem-title" : "orphan-box-title",
          severity: "error",
          reason: "BOXタイトルに同一ページ上の最初の内容fragmentがありません。",
        });
      }
      if (callout) {
        const style = window.getComputedStyle(callout);
        const frameMode = style.getPropertyValue("--pagination-box-frame-mode").trim();
        const requiresVisibleFrame = frameMode !== "intentional-none";
        if (
          requiresVisibleFrame &&
          (Number.parseFloat(style.borderTopWidth) <= 0 || Number.parseFloat(style.borderBottomWidth) <= 0)
        ) {
          anomalies.push({
            page: pageNumber,
            nodeId: element.dataset.blockId ?? "unknown",
            line: Number(element.dataset.sourceLine ?? 1),
            kind: "container-frame",
            severity: "error",
            reason: "ページfragmentのBOX上下枠が再構築されていません。",
          });
        }
      }
    }
  }

  for (let index = 0; index < pages.length - 1; index += 1) {
    const currentContent = pages[index].querySelector<HTMLElement>(".paper-content");
    const nextContent = pages[index + 1].querySelector<HTMLElement>(".paper-content");
    if (!currentContent || !nextContent) continue;
    const currentLeaves = leafBlocksFor(currentContent);
    const nextLeaves = leafBlocksFor(nextContent);
    const tail = currentLeaves.at(-1);
    const head = nextLeaves[0];
    if (tail && head) {
      const sameOrigin =
        Boolean(tail.dataset.paginationOriginBlockId) &&
        tail.dataset.paginationOriginBlockId === head.dataset.paginationOriginBlockId;
      if (
        sameOrigin &&
        tail.dataset.paginationNodeType === "paragraph" &&
        head.dataset.paginationNodeType === "paragraph"
      ) {
        const tailLines = Number(tail.dataset.paginationLineCount ?? 0);
        const headLines = Number(head.dataset.paginationLineCount ?? 0);
        if (
          tailLines < PAGINATION_CONFIG.minimumParagraphLinesAtBoundary ||
          headLines < PAGINATION_CONFIG.minimumParagraphLinesAtBoundary
        ) {
          const target = tailLines < headLines ? tail : head;
          anomalies.push({
            page: target === tail
              ? Number(pages[index].dataset.pageNumber ?? index + 1)
              : Number(pages[index + 1].dataset.pageNumber ?? index + 2),
            nodeId: target.dataset.blockId ?? "unknown",
            line: Number(target.dataset.sourceLine ?? 1),
            kind: "widow-line",
            severity: "error",
            reason: "同じ段落の実測1行だけがページ境界に孤立しています。",
          });
        }
      }
    }

    const currentBlocks = topLevelBlocksFor(currentContent);
    const nextBlocks = topLevelBlocksFor(nextContent);
    const lastBlock = currentBlocks.at(-1);
    const nextBlock = nextBlocks[0];
    if (!lastBlock || !nextBlock) continue;
    const currentPage = pages[index];
    const currentPageRect = currentPage.getBoundingClientRect();
    const geometry = measurePageGeometry(currentPage);
    const scale = Math.max(0.0001, geometry.coordinateScale);
    const lastBlockBottom = (lastBlock.getBoundingClientRect().bottom - currentPageRect.top) / scale;
    const remaining = geometry.contentBottom - lastBlockBottom;
    const debugRemaining = Number(pages[index].dataset.paginationRemainingHeight ?? Number.NaN);
    const diagnosticRemaining = Number.isFinite(debugRemaining)
      ? Math.max(remaining, debugRemaining)
      : remaining;
    const whitespaceRatio = diagnosticRemaining / Math.max(1, geometry.usableHeight);
    const breakReason = pages[index].dataset.paginationBreakReason;
    const nextFitsRemaining =
      nextBlock.dataset.paginationStrategy === "splittable" &&
      nextBlock.getBoundingClientRect().height / scale + PAGINATION_CONFIG.blockGapPx <= remaining;
    if (
      whitespaceRatio > PAGINATION_CONFIG.hugeWhitespaceRatio &&
      breakReason !== "manual" &&
      (Boolean(breakReason) || nextFitsRemaining)
    ) {
      const diagnostic = [
        `未使用領域 ${Math.round(whitespaceRatio * 100)}%`,
        `breakReason: ${breakReason ?? "unknown"}`,
        `next: ${pages[index].dataset.paginationNextNode ?? nextBlock.dataset.blockId ?? "unknown"}`,
        `type: ${pages[index].dataset.paginationNextNodeType ?? nextBlock.dataset.paginationNodeType ?? "unknown"}`,
        `nextHeight: ${pages[index].dataset.paginationNextNodeHeight ?? "unknown"}px`,
        `minimumFragment: ${pages[index].dataset.paginationMinimumFragmentHeight ?? "unknown"}px`,
        `atomic: ${pages[index].dataset.paginationAtomic ?? "unknown"}`,
        `splittable: ${pages[index].dataset.paginationSplittable ?? "unknown"}`,
        `container: ${pages[index].dataset.paginationContainer ?? "unknown"}`,
      ].join(" / ");
      anomalies.push({
        page: Number(pages[index].dataset.pageNumber ?? index + 1),
        nodeId: nextBlock.dataset.blockId ?? "unknown",
        line: Number(nextBlock.dataset.sourceLine ?? 1),
        kind: "excessive-whitespace",
        severity: "warning",
        reason: `${diagnostic}。空白は診断対象であり、安全制約を自動解除しません。`,
      });
    }
  }
  return anomalies;
}

export function assertNoOrphanHeadings(container: HTMLElement) {
  const orphan = inspectPaginationAnomalies(container)
    .find((anomaly) => anomaly.kind === "orphan-heading");
  if (!orphan) return;
  throw new Error(
    `PDF生成を中止しました。${orphan.page}ページ目の見出し（${orphan.nodeId}）に同一ページ上の本文がありません。`,
  );
}

export function assertNoUnsafePagination(container: HTMLElement) {
  const failure = inspectPaginationAnomalies(container)
    .find((anomaly) => anomaly.severity === "error");
  if (!failure) return;
  throw new Error(
    `PDF生成を中止しました。${failure.page}ページ目で「${paginationAnomalyTitle(failure.kind)}」を検出しました。${failure.reason}`,
  );
}
