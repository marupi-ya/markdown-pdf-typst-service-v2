import {
  derivePaginationPageGeometry,
  type BlockMeasurement,
  type PaginationPageGeometry,
} from "../studio-core";
import { PAGINATION_CONFIG } from "./config";

function renderedTextMetrics(element: HTMLElement) {
  const owner = element.ownerDocument;
  const walker = owner.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.textContent?.trim()
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  const lines = new Set<number>();
  const lineBreakOffsets: number[] = [];
  let textContent = "";
  let previousTop: number | null = null;
  let globalOffset = 0;
  let node = walker.nextNode();
  while (node) {
    const parent = node.parentElement;
    if (parent?.closest(".katex-mathml,[aria-hidden='true']")) {
      node = walker.nextNode();
      continue;
    }
    const value = node.textContent ?? "";
    textContent += value;
    if (element.dataset.paginationNodeType === "paragraph") {
      let localOffset = 0;
      for (const character of Array.from(value)) {
        const nextOffset = localOffset + character.length;
        const range = owner.createRange();
        range.setStart(node, localOffset);
        range.setEnd(node, nextOffset);
        const rect = Array.from(range.getClientRects()).find((candidate) => candidate.width > 0.2 && candidate.height > 0.2);
        range.detach();
        if (rect) {
          const top = Math.round(rect.top * 2) / 2;
          lines.add(top);
          if (previousTop !== null && Math.abs(top - previousTop) > 0.75) {
            lineBreakOffsets.push(globalOffset + localOffset);
          }
          previousTop = top;
        }
        localOffset = nextOffset;
      }
    } else {
      const range = owner.createRange();
      range.selectNodeContents(node);
      for (const rect of Array.from(range.getClientRects())) {
        if (rect.width > 0.2 && rect.height > 0.2) lines.add(Math.round(rect.top * 2) / 2);
      }
      range.detach();
    }
    globalOffset += value.length;
    node = walker.nextNode();
  }
  return { lineCount: lines.size, lineBreakOffsets, textContent };
}

function cssPixels(value: string, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function outerBlockHeight(element: HTMLElement | null) {
  if (!element) return 0;
  const style = window.getComputedStyle(element);
  return element.getBoundingClientRect().height +
    cssPixels(style.marginTop) +
    cssPixels(style.marginBottom);
}

function continuationChildMarginAdjustment(content: HTMLElement | null) {
  const firstWrapper = content?.firstElementChild;
  const firstInner = firstWrapper?.firstElementChild;
  if (
    !content ||
    !(firstWrapper instanceof HTMLElement) ||
    !(firstInner instanceof HTMLElement)
  ) return 0;

  // The final Page DOM may merge this fragment after an earlier child. Probe
  // that exact :first-child state without adding any layout height.
  const clone = firstWrapper.cloneNode(true);
  if (!(clone instanceof HTMLElement)) return 0;
  clone.setAttribute("aria-hidden", "true");
  clone.style.position = "absolute";
  clone.style.visibility = "hidden";
  clone.style.pointerEvents = "none";
  content.append(clone);
  const clonedInner = clone.firstElementChild;
  const continuedMargin = clonedInner instanceof HTMLElement
    ? cssPixels(window.getComputedStyle(clonedInner).marginTop)
    : cssPixels(window.getComputedStyle(firstInner).marginTop);
  const firstMargin = cssPixels(window.getComputedStyle(firstInner).marginTop);
  clone.remove();
  return continuedMargin - firstMargin;
}

/**
 * Reads all page landmarks in one unscaled CSS-pixel coordinate system.
 * Preview transforms affect getBoundingClientRect(), so every DOM landmark is
 * normalized by the page's observed scale before pagination compares it.
 */
export function measurePageGeometry(page: HTMLElement): PaginationPageGeometry {
  const pageRect = page.getBoundingClientRect();
  const pageStyle = window.getComputedStyle(page);
  const computedPageHeight = cssPixels(pageStyle.height, page.offsetHeight || pageRect.height);
  const coordinateScale = pageRect.height > 0 && computedPageHeight > 0
    ? pageRect.height / computedPageHeight
    : 1;
  const normalizeY = (value: number) => (value - pageRect.top) / Math.max(0.0001, coordinateScale);
  const content = page.querySelector<HTMLElement>("[data-pagination-content],.paper-content");
  if (!content) {
    return derivePaginationPageGeometry({
      coordinateScale,
      pageHeight: computedPageHeight,
      pageContentTop: 0,
      pageContentBottom: computedPageHeight,
      requiredFooterGap: 0,
    });
  }

  const contentRect = content.getBoundingClientRect();
  const header = content.querySelector<HTMLElement>(":scope > [data-pagination-header],:scope > .paper-header");
  const footer = page.querySelector<HTMLElement>(":scope > [data-pagination-footer],:scope > .paper-footer");
  const requiredFooterGap = cssPixels(
    pageStyle.getPropertyValue("--footer-required-gap"),
    0,
  );
  const headerStyle = header ? window.getComputedStyle(header) : null;

  return derivePaginationPageGeometry({
    coordinateScale,
    pageHeight: computedPageHeight,
    pageContentTop: normalizeY(contentRect.top),
    pageContentBottom: normalizeY(contentRect.bottom),
    headerBottom: header ? normalizeY(header.getBoundingClientRect().bottom) : undefined,
    headerMarginBottom: headerStyle ? cssPixels(headerStyle.marginBottom) : undefined,
    footerTop: footer ? normalizeY(footer.getBoundingClientRect().top) : undefined,
    requiredFooterGap,
  });
}

function minimumRenderedFragmentHeight(
  element: HTMLElement,
  textMetrics: ReturnType<typeof renderedTextMetrics>,
) {
  const rect = element.getBoundingClientRect();
  const nodeType = element.dataset.paginationNodeType;

  if (nodeType === "paragraph") {
    const paragraph = element.querySelector<HTMLElement>("p") ?? element;
    const style = window.getComputedStyle(paragraph);
    const lineHeight = cssPixels(
      style.lineHeight,
      cssPixels(style.fontSize, 12) * 1.2,
    );
    const renderedLines = Math.max(1, textMetrics.lineCount);
    const verticalChrome = Math.max(0, rect.height - lineHeight * renderedLines);
    return Math.min(
      rect.height,
      verticalChrome + lineHeight * Math.min(
        PAGINATION_CONFIG.minimumParagraphLinesWithHeading,
        renderedLines,
      ),
    );
  }

  if (nodeType === "list") {
    const list = element.querySelector<HTMLElement>("ul,ol");
    const firstItem = list?.querySelector<HTMLElement>(":scope > li");
    if (list && firstItem) {
      const style = window.getComputedStyle(list);
      return Math.min(
        rect.height,
        firstItem.getBoundingClientRect().height +
          cssPixels(style.marginTop) +
          cssPixels(style.marginBottom),
      );
    }
  }

  if (nodeType === "callout") {
    const callout = element.querySelector<HTMLElement>(":scope > .lesson-callout");
    const content = callout?.querySelector<HTMLElement>(":scope > .callout-content");
    const firstContent = content
      ? Array.from(content.children).find((candidate): candidate is HTMLElement => {
          if (!(candidate instanceof HTMLElement)) return false;
          const type = candidate.dataset.paginationNodeType;
          return type !== "hr" && type !== "page-break";
        })
      : null;
    if (callout && content && firstContent) {
      const chromeHeight = Math.max(
        0,
        callout.getBoundingClientRect().height - content.getBoundingClientRect().height,
      );
      return Math.min(
        rect.height,
        chromeHeight + firstContent.getBoundingClientRect().height,
      );
    }
  }

  // Atomic nodes and already prepared safe fragments use their complete DOM
  // box. The paginator never invents a smaller height from character counts.
  return rect.height;
}

export function collectBlockMeasurements(root: HTMLElement) {
  const measurements = new Map<string, BlockMeasurement>();
  for (const element of Array.from(
    root.querySelectorAll<HTMLElement>("[data-pagination-block-id]"),
  )) {
    const id = element.dataset.paginationBlockId;
    if (!id) continue;
    const rect = element.getBoundingClientRect();
    const textMetrics = renderedTextMetrics(element);
    const callout = element.dataset.paginationNodeType === "callout"
      ? element.querySelector<HTMLElement>(".lesson-callout")
      : null;
    const calloutContent = callout?.querySelector<HTMLElement>(":scope > .callout-content");
    const containerContentHeight = calloutContent?.getBoundingClientRect().height;
    const containerContinuationAdjustmentHeight = continuationChildMarginAdjustment(calloutContent ?? null);
    const continuationMarker = callout?.querySelector<HTMLElement>(":scope > .box-continuation-marker");
    const list = element.dataset.paginationNodeType === "list"
      ? element.querySelector<HTMLElement>(":scope > ul,:scope > ol")
      : null;
    const listItems = list
      ? Array.from(list.children).filter((candidate): candidate is HTMLElement => candidate instanceof HTMLElement)
      : [];
    const firstListItemStyle = listItems[0] ? window.getComputedStyle(listItems[0]) : null;
    const lastListItem = listItems.at(-1);
    const lastListItemStyle = lastListItem ? window.getComputedStyle(lastListItem) : null;
    const listBodyHeight = list?.getBoundingClientRect().height;
    const listMergeGapHeight = firstListItemStyle && lastListItemStyle
      ? Math.max(
          cssPixels(firstListItemStyle.marginTop),
          cssPixels(lastListItemStyle.marginBottom),
        )
      : undefined;
    const table = element.dataset.paginationNodeType === "table"
      ? element.querySelector<HTMLTableElement>("table")
      : null;
    const tableBody = table?.querySelector<HTMLTableSectionElement>(":scope > tbody");
    const tableBodyHeight = tableBody?.getBoundingClientRect().height;
    measurements.set(id, {
      height: rect.height,
      width: Math.max(rect.width, element.scrollWidth),
      clientWidth: element.clientWidth,
      minimumFragmentHeight: minimumRenderedFragmentHeight(element, textMetrics),
      containerContentHeight,
      containerContinuationAdjustmentHeight: containerContentHeight === undefined
        ? undefined
        : containerContinuationAdjustmentHeight,
      containerChromeHeight: containerContentHeight === undefined
        ? undefined
        : Math.max(0, rect.height - containerContentHeight),
      continuationMarkerHeight: continuationMarker
        ? outerBlockHeight(continuationMarker)
        : undefined,
      listBodyHeight,
      listMergeGapHeight,
      tableBodyHeight,
      tableChromeHeight: tableBodyHeight === undefined
        ? undefined
        : Math.max(0, rect.height - tableBodyHeight),
      ...textMetrics,
    });
  }
  return measurements;
}

async function waitForImages(root: HTMLElement) {
  const images = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(images.map(async (image) => {
    try {
      if (typeof image.decode === "function") await image.decode();
      else if (!image.complete) {
        await new Promise<void>((resolve) => {
          const finish = () => resolve();
          image.addEventListener("load", finish, { once: true });
          image.addEventListener("error", finish, { once: true });
          window.setTimeout(finish, 5000);
        });
      }
    } catch {
      // A failed image remains a local fallback node and is still measurable.
    }
  }));
}

function nextFrame() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

function sizeSignature(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-pagination-block-id]"))
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return `${element.dataset.paginationBlockId}:${rect.width.toFixed(2)}x${rect.height.toFixed(2)}`;
    })
    .join("|");
}

export async function waitForStableLayout(root: HTMLElement) {
  await document.fonts?.ready;
  await waitForImages(root);
  const deadline = Date.now() + PAGINATION_CONFIG.renderTimeoutMs;
  while (root.querySelector(".figure-loading") && Date.now() < deadline) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 60));
  }

  let previous = "";
  let stableFrames = 0;
  for (let pass = 0; pass < PAGINATION_CONFIG.maxLayoutPasses; pass += 1) {
    await nextFrame();
    const signature = sizeSignature(root);
    if (signature === previous) stableFrames += 1;
    else stableFrames = 0;
    if (stableFrames >= PAGINATION_CONFIG.layoutStableFrames) return;
    previous = signature;
  }
}
