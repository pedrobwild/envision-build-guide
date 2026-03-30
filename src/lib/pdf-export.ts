import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Prepare the DOM for capture:
 * - Force all framer-motion animated elements to be visible
 * - Hide elements that don't render well (maps, video, carousels nav)
 * - Wait for images to load
 */
async function prepareForCapture(element: HTMLElement) {
  // 1. Hide elements marked with data-pdf-hide
  const hiddenEls = element.querySelectorAll('[data-pdf-hide]');
  hiddenEls.forEach(el => (el as HTMLElement).style.display = 'none');

  // 2. Force all framer-motion elements to be fully visible
  //    Motion elements use style with opacity/transform
  const allElements = element.querySelectorAll('*') as NodeListOf<HTMLElement>;
  const savedStyles: { el: HTMLElement; opacity: string; transform: string; visibility: string }[] = [];

  allElements.forEach(el => {
    const style = el.style;
    const computed = window.getComputedStyle(el);
    if (
      computed.opacity !== '1' ||
      (computed.transform && computed.transform !== 'none') ||
      computed.visibility === 'hidden'
    ) {
      savedStyles.push({
        el,
        opacity: style.opacity,
        transform: style.transform,
        visibility: style.visibility,
      });
      style.opacity = '1';
      style.transform = 'none';
      style.visibility = 'visible';
    }
  });

  // 3. Hide problematic interactive components that html2canvas can't render
  const selectorsToHide = [
    '.maplibregl-map',        // MapLibre maps
    '[class*="maplibregl"]',
    'iframe',                 // Embedded iframes
    'video',                  // Video elements
  ];
  
  const hiddenInteractive: { el: HTMLElement; display: string }[] = [];
  selectorsToHide.forEach(selector => {
    element.querySelectorAll(selector).forEach(el => {
      const htmlEl = el as HTMLElement;
      hiddenInteractive.push({ el: htmlEl, display: htmlEl.style.display });
      htmlEl.style.display = 'none';
    });
  });

  // 4. Expand any collapsed elements (max-h-0, overflow-hidden)
  const collapsedEls: { el: HTMLElement; maxHeight: string; overflow: string }[] = [];
  allElements.forEach(el => {
    const computed = window.getComputedStyle(el);
    if (computed.maxHeight === '0px' && computed.overflow === 'hidden') {
      collapsedEls.push({ el, maxHeight: el.style.maxHeight, overflow: el.style.overflow });
      el.style.maxHeight = 'none';
      el.style.overflow = 'visible';
    }
  });

  // 5. Force all sticky elements to static so they render in-flow
  const stickyEls: { el: HTMLElement; position: string }[] = [];
  allElements.forEach(el => {
    const computed = window.getComputedStyle(el);
    if (computed.position === 'sticky' || computed.position === 'fixed') {
      stickyEls.push({ el, position: el.style.position });
      el.style.position = 'static';
    }
  });

  // 6. Wait for all visible images to load
  const images = element.querySelectorAll('img');
  const imagePromises: Promise<void>[] = [];
  images.forEach(img => {
    if (!img.complete && img.src) {
      imagePromises.push(
        new Promise<void>(resolve => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          // Timeout after 3s per image
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

export async function exportBudgetPdf(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Element not found");

  const cleanup = await prepareForCapture(element);

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 900,
      // Ensure we capture the full scrollable height
      height: element.scrollHeight,
      y: 0,
    });

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = pageHeight - margin * 2;
    const scale = contentWidth / canvas.width; // mm per canvas pixel
    const maxSliceHeight = Math.floor(contentHeight / scale); // max canvas pixels per page

    // Find a "safe" row to cut — scan for a row that is mostly background (white)
    function findSafeCut(startY: number): number {
      const ctx = canvas.getContext("2d")!;
      const searchRange = Math.min(Math.floor(maxSliceHeight * 0.15), 200); // look back up to 15%
      const sampleWidth = Math.min(canvas.width, 400); // sample center pixels
      const xOffset = Math.floor((canvas.width - sampleWidth) / 2);

      for (let row = startY; row > startY - searchRange && row > 0; row--) {
        const data = ctx.getImageData(xOffset, row, sampleWidth, 1).data;
        let whiteCount = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) {
            whiteCount++;
          }
        }
        const ratio = whiteCount / (sampleWidth);
        if (ratio > 0.92) return row; // found a mostly-white row
      }
      return startY; // fallback: cut at original position
    }

    let sourceY = 0;
    let page = 0;

    while (sourceY < canvas.height) {
      if (page > 0) pdf.addPage();

      let idealEnd = sourceY + maxSliceHeight;
      let sliceEnd: number;

      if (idealEnd >= canvas.height) {
        sliceEnd = canvas.height;
      } else {
        sliceEnd = findSafeCut(idealEnd);
      }

      const sliceHeight = sliceEnd - sourceY;
      const destHeight = sliceHeight * scale;

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceHeight;
      const ctx = pageCanvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
      ctx.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

      const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.92);
      pdf.addImage(pageImgData, "JPEG", margin, margin, contentWidth, destHeight);

      sourceY = sliceEnd;
      page++;
    }

    pdf.save(filename);
  } finally {
    cleanup.restore();
  }
}
