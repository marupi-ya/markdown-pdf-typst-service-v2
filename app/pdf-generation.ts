import { waitForStableLayout } from "./pagination/measure";
import {
  assertNoOrphanHeadings,
  assertNoPageOverflow,
  assertNoUnsafePagination,
} from "./pagination/overflow";

export type GeneratedPdfFile = {
  fileName: string;
  blob: Blob;
  pageCount: number;
};

export type PdfProgress = {
  completedPages: number;
  totalPages: number;
};

/** Keep long教材 exports responsive without lowering the normal PDF quality. */
export function pdfCaptureScaleFor(pageCount: number) {
  return pageCount >= 20 ? 1 : 1.5;
}

export function pdfCaptureConcurrencyFor(pageCount: number) {
  return pageCount >= 20 ? 3 : 1;
}

async function waitForImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll<HTMLImageElement>("img"));
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
      // The pagination validator has already classified failed images. Keep
      // export moving so one fallback cannot serialize the whole queue.
    }
  }));
}

function createCaptureHost(source: HTMLElement) {
  const host = document.createElement("div");
  host.className = "pdf-capture-host";
  host.setAttribute("aria-hidden", "true");
  for (const page of Array.from(source.querySelectorAll<HTMLElement>(".paper"))) {
    host.append(page.cloneNode(true));
  }
  document.body.append(host);
  return host;
}

export async function generateMaterialPdf(
  source: HTMLElement,
  onProgress?: (progress: PdfProgress) => void,
) {
  await waitForStableLayout(source);
  assertNoPageOverflow(source);
  assertNoOrphanHeadings(source);
  assertNoUnsafePagination(source);
  const captureHost = createCaptureHost(source);
  document.documentElement.classList.add("html2canvas-font-metrics");
  try {
    await document.fonts?.ready;
    await waitForImages(captureHost);
    const pages = Array.from(captureHost.querySelectorAll<HTMLElement>(".paper"));
    if (!pages.length) throw new Error("PDFへ変換するA4ページがありません。");
    const captureScale = pdfCaptureScaleFor(pages.length);
    const captureConcurrency = pdfCaptureConcurrencyFor(pages.length);

    const { default: html2canvas } = await import("html2canvas");
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
      putOnlyUsedFonts: true,
    });

    for (let start = 0; start < pages.length; start += captureConcurrency) {
      const batchPages = pages.slice(start, start + captureConcurrency);
      const canvases = await Promise.all(batchPages.map((page) => html2canvas(page, {
          backgroundColor: "#ffffff",
          scale: captureScale,
          logging: false,
          useCORS: true,
          // Every <img> above has already completed decode. This is only a
          // defensive timeout for resources html2canvas discovers in CSS/SVG.
          imageTimeout: 500,
          windowWidth: page.scrollWidth,
          windowHeight: page.scrollHeight,
        })));

      for (let offset = 0; offset < canvases.length; offset += 1) {
        const index = start + offset;
        const canvas = canvases[offset];
        if (index > 0) pdf.addPage("a4", "portrait");
        const image = canvas.toDataURL("image/jpeg", 0.94);
        pdf.addImage(image, "JPEG", 0, 0, 210, 297, undefined, "FAST");
        canvas.width = 1;
        canvas.height = 1;
        onProgress?.({ completedPages: index + 1, totalPages: pages.length });
      }
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    }

    return { blob: pdf.output("blob"), pageCount: pages.length };
  } finally {
    document.documentElement.classList.remove("html2canvas-font-metrics");
    captureHost.replaceChildren();
    captureHost.remove();
  }
}

export function downloadGeneratedBlob(blob: Blob, fileName: string) {
  const previous = document.querySelector<HTMLAnchorElement>("[data-last-generated-pdf]");
  if (previous) {
    URL.revokeObjectURL(previous.href);
    previous.remove();
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  const debugDownload = new URLSearchParams(window.location.search).get("paginationDebug") === "1";
  anchor.hidden = !debugDownload;
  if (debugDownload) {
    anchor.className = "generated-pdf-debug-link";
    anchor.textContent = "最新PDFを再保存";
  }
  anchor.dataset.lastGeneratedPdf = "true";
  document.body.append(anchor);
  anchor.click();
  window.addEventListener("beforeunload", () => URL.revokeObjectURL(url), { once: true });
}

export async function createBatchZip(
  files: GeneratedPdfFile[],
  reportJson: string,
  reportText: string,
) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const file of files) zip.file(file.fileName, file.blob);
  const reports = zip.folder("reports");
  reports?.file("batch-result.json", reportJson);
  reports?.file("batch-result.txt", reportText);
  return zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
    streamFiles: true,
  });
}
