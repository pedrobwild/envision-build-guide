import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Prepare a single element for capture:
 * - Force framer-motion elements visible
 * - Hide maps, video, iframes
 * - Expand collapsed sections
 * - Wait for images
 */
async function prepareElement(element: HTMLElement) {
  // Hide data-pdf-hide elements
  const hiddenEls = element.querySelectorAll('[data-pdf-hide]');
  hiddenEls.forEach(el => (el as HTMLElement).style.display = 'none');

  const allElements = element.querySelectorAll('*') as NodeListOf<HTMLElement>;
  const savedStyles: { el: HTMLElement; opacity: string; transform: string; visibility: string }[] = [];

  allElements.forEach(el => {
    const computed = window.getComputedStyle(el);
    if (
      computed.opacity !== '1' ||
      (computed.transform && computed.transform !== 'none') ||
      computed.visibility === 'hidden'
    ) {
      savedStyles.push({
        el,
        opacity: el.style.opacity,
        transform: el.style.transform,
        visibility: el.style.visibility,
      });
      el.style.opacity = '1';
      el.style.transform = 'none';
      el.style.visibility = 'visible';
    }
  });

  // Hide interactive elements that html2canvas can't render
  const selectorsToHide = ['.maplibregl-map', '[class*="maplibregl"]', 'iframe', 'video'];
  const hiddenInteractive: { el: HTMLElement; display: string }[] = [];
  selectorsToHide.forEach(selector => {
    element.querySelectorAll(selector).forEach(el => {
      const htmlEl = el as HTMLElement;
      hiddenInteractive.push({ el: htmlEl, display: htmlEl.style.display });
      htmlEl.style.display = 'none';
    });
  });

  // Expand collapsed elements
  const collapsedEls: { el: HTMLElement; maxHeight: string; overflow: string }[] = [];
  allElements.forEach(el => {
    const computed = window.getComputedStyle(el);
    if (computed.maxHeight === '0px' && computed.overflow === 'hidden') {
      collapsedEls.push({ el, maxHeight: el.style.maxHeight, overflow: el.style.overflow });
      el.style.maxHeight = 'none';
      el.style.overflow = 'visible';
    }
  });

  // Force sticky/fixed to static
  const stickyEls: { el: HTMLElement; position: string }[] = [];
  allElements.forEach(el => {
    const computed = window.getComputedStyle(el);
    if (computed.position === 'sticky' || computed.position === 'fixed') {
      stickyEls.push({ el, position: el.style.position });
      el.style.position = 'static';
    }
  });

  // Wait for images
  const images = element.querySelectorAll('img');
  const imagePromises: Promise<void>[] = [];
  images.forEach(img => {
    if (!img.complete && img.src) {
      imagePromises.push(
        new Promise<void>(resolve => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          setTimeout(resolve, 3000);
        })
      );
    }
  });
  if (imagePromises.length > 0) {
    await Promise.all(imagePromises);
  }

  return {
    restore() {
      hiddenEls.forEach(el => (el as HTMLElement).style.display = '');
      savedStyles.forEach(({ el, opacity, transform, visibility }) => {
        el.style.opacity = opacity;
        el.style.transform = transform;
        el.style.visibility = visibility;
      });
      hiddenInteractive.forEach(({ el, display }) => {
        el.style.display = display;
      });
      collapsedEls.forEach(({ el, maxHeight, overflow }) => {
        el.style.maxHeight = maxHeight;
        el.style.overflow = overflow;
      });
      stickyEls.forEach(({ el, position }) => {
        el.style.position = position;
      });
    },
  };
}

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 10;
const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_MM * 2;
const CONTENT_HEIGHT_MM = A4_HEIGHT_MM - MARGIN_MM * 2;
const SECTION_GAP_MM = 3;

export async function exportBudgetPdf(elementId: string, filename: string) {
  const container = document.getElementById(elementId);
  if (!container) throw new Error("Element not found");

  const cleanup = await prepareElement(container);

  try {
    // Find all sections marked with data-pdf-section
    const sectionEls = Array.from(
      container.querySelectorAll('[data-pdf-section]')
    ) as HTMLElement[];

    // If no sections marked, fall back to capturing the whole container as one
    if (sectionEls.length === 0) {
      sectionEls.push(container);
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    let currentY = MARGIN_MM;
    let isFirstPage = true;

    for (const section of sectionEls) {
      // Skip hidden or zero-height sections
      if (section.offsetHeight === 0 || section.offsetWidth === 0) continue;

      const canvas = await html2canvas(section, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 900,
      });

      const scaleFactor = CONTENT_WIDTH_MM / (canvas.width / 2);
      const heightMM = (canvas.height / 2) * scaleFactor;

      // If section is taller than a full page, we need to slice it
      if (heightMM > CONTENT_HEIGHT_MM) {
        // Slice this tall section into page-sized chunks with smart breaks
        const maxSlicePx = Math.floor(CONTENT_HEIGHT_MM / scaleFactor) * 2; // in canvas pixels (scale=2)

        let sliceY = 0;
        while (sliceY < canvas.height) {
          const remaining = canvas.height - sliceY;
          let sliceHeight: number;

          if (remaining <= maxSlicePx) {
            sliceHeight = remaining;
          } else {
            // Find a safe cut point (mostly white row)
            sliceHeight = findSafeCut(canvas, sliceY + maxSlicePx, maxSlicePx);
            sliceHeight = sliceHeight - sliceY;
          }

          const sliceHeightMM = (sliceHeight / 2) * scaleFactor;
          const remainingSpace = A4_HEIGHT_MM - MARGIN_MM - currentY;

          if (sliceHeightMM > remainingSpace && currentY > MARGIN_MM) {
            pdf.addPage();
            currentY = MARGIN_MM;
          }

          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = canvas.width;
          pageCanvas.height = sliceHeight;
          const ctx = pageCanvas.getContext("2d")!;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(canvas, 0, sliceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

          const imgData = pageCanvas.toDataURL("image/jpeg", 0.92);
          pdf.addImage(imgData, "JPEG", MARGIN_MM, currentY, CONTENT_WIDTH_MM, sliceHeightMM);

          currentY += sliceHeightMM + SECTION_GAP_MM;
          sliceY += sliceHeight;
        }
      } else {
        // Section fits on a page — check if there's room
        const remainingSpace = A4_HEIGHT_MM - MARGIN_MM - currentY;

        if (heightMM > remainingSpace && currentY > MARGIN_MM) {
          pdf.addPage();
          currentY = MARGIN_MM;
        }

        const imgData = canvas.toDataURL("image/jpeg", 0.92);
        pdf.addImage(imgData, "JPEG", MARGIN_MM, currentY, CONTENT_WIDTH_MM, heightMM);

        currentY += heightMM + SECTION_GAP_MM;
      }

      isFirstPage = false;
    }

    pdf.save(filename);
  } finally {
    cleanup.restore();
  }
}

/**
 * Scan backwards from targetY to find a row that is mostly white (safe to cut).
 * Returns the Y position of the safe cut in canvas pixels.
 */
function findSafeCut(canvas: HTMLCanvasElement, targetY: number, maxSlicePx: number): number {
  const ctx = canvas.getContext("2d")!;
  const searchRange = Math.min(Math.floor(maxSlicePx * 0.15), 300);
  const sampleWidth = Math.min(canvas.width, 600);
  const xOffset = Math.floor((canvas.width - sampleWidth) / 2);

  for (let row = targetY; row > targetY - searchRange && row > 0; row--) {
    const data = ctx.getImageData(xOffset, row, sampleWidth, 1).data;
    let whiteCount = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) {
        whiteCount++;
      }
    }
    if (whiteCount / sampleWidth > 0.92) return row;
  }
  return targetY;
}
