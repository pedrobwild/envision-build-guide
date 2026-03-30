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

  // 4. Wait for all visible images to load
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
      // Restore hidden pdf elements
      hiddenEls.forEach(el => (el as HTMLElement).style.display = '');
      // Restore forced styles
      savedStyles.forEach(({ el, opacity, transform, visibility }) => {
        el.style.opacity = opacity;
        el.style.transform = transform;
        el.style.visibility = visibility;
      });
      // Restore hidden interactive elements
      hiddenInteractive.forEach(({ el, display }) => {
        el.style.display = display;
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

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;

    let yOffset = 0;
    let page = 0;

    while (yOffset < imgHeight) {
      if (page > 0) pdf.addPage();

      const sourceY = (yOffset / imgHeight) * canvas.height;
      const sourceHeight = Math.min(
        ((pageHeight - margin * 2) / imgHeight) * canvas.height,
        canvas.height - sourceY
      );
      const destHeight = (sourceHeight / canvas.height) * imgHeight;

      const pageCanvas = document.createElement("canvas");
      pageCanvas.width = canvas.width;
      pageCanvas.height = sourceHeight;
      const ctx = pageCanvas.getContext("2d")!;
      ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);

      const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.92);
      pdf.addImage(pageImgData, "JPEG", margin, margin, contentWidth, destHeight);

      yOffset += pageHeight - margin * 2;
      page++;
    }

    pdf.save(filename);
  } finally {
    cleanup.restore();
  }
}
