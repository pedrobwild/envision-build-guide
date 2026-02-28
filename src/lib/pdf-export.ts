import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function exportBudgetPdf(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Element not found");

  // Temporarily expand everything for capture
  const hiddenEls = element.querySelectorAll('[data-pdf-hide]');
  hiddenEls.forEach(el => (el as HTMLElement).style.display = 'none');

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: 900,
  });

  hiddenEls.forEach(el => (el as HTMLElement).style.display = '');

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

    // Calculate the source crop for this page
    const sourceY = (yOffset / imgHeight) * canvas.height;
    const sourceHeight = Math.min(
      ((pageHeight - margin * 2) / imgHeight) * canvas.height,
      canvas.height - sourceY
    );
    const destHeight = (sourceHeight / canvas.height) * imgHeight;

    // Create a cropped canvas for this page
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
}
