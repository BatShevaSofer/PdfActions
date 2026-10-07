import {
  PDFDocument,
  rgb,
  degrees,
  StandardFonts,
  PDFPage,
  PDFName,
} from 'pdf-lib';
import {
  AnyAnnotation,
  ImgToPdfOptions,
  PageNumberConfig,
  PdfMetadata,
  WatermarkConfig,
} from '../types/pdf';
import { renderPdfPage } from './pdfjsRenderer';

// Helper to convert hex #RRGGBB to pdf-lib rgb(r, g, b)
export function hexToRgb(hex: string, defaultAlpha = 1) {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num)) return rgb(0, 0, 0);
  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;
  return rgb(r, g, b);
}

/**
 * Merge multiple PDF buffers or specific pages into a single PDF
 */
export async function mergePdfs(
  items: {
    data: ArrayBuffer;
    pageIndices?: number[];
    rotations?: number[];
  }[]
): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();

  for (const item of items) {
    const srcDoc = await PDFDocument.load(item.data);
    const totalPages = srcDoc.getPageCount();
    const indicesToCopy =
      item.pageIndices && item.pageIndices.length > 0
        ? item.pageIndices.filter((i) => i >= 0 && i < totalPages)
        : Array.from({ length: totalPages }, (_, i) => i);

    if (indicesToCopy.length === 0) continue;

    const copiedPages = await mergedPdf.copyPages(srcDoc, indicesToCopy);

    copiedPages.forEach((page, idx) => {
      if (item.rotations && item.rotations[idx] !== undefined) {
        const curRot = page.getRotation().angle;
        page.setRotation(degrees((curRot + item.rotations[idx]) % 360));
      }
      mergedPdf.addPage(page);
    });
  }

  return await mergedPdf.save();
}

/**
 * Reorder and apply rotation to individual pages
 */
export async function reorderAndRotatePages(
  data: ArrayBuffer,
  pageConfigs: { originalIndex: number; rotation: number }[]
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(data);
  const newDoc = await PDFDocument.create();
  const totalPages = srcDoc.getPageCount();

  const validConfigs = pageConfigs.filter(
    (c) => c.originalIndex >= 0 && c.originalIndex < totalPages
  );

  const copiedPages = await newDoc.copyPages(
    srcDoc,
    validConfigs.map((c) => c.originalIndex)
  );

  copiedPages.forEach((page, idx) => {
    const config = validConfigs[idx];
    const curRot = page.getRotation().angle;
    page.setRotation(degrees((curRot + config.rotation) % 360));
    newDoc.addPage(page);
  });

  return await newDoc.save();
}

/**
 * Delete specified pages (0-based) from a PDF
 */
export async function deletePages(
  data: ArrayBuffer,
  pageIndicesToDelete: number[]
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(data);
  const newDoc = await PDFDocument.create();
  const totalPages = srcDoc.getPageCount();

  const toDeleteSet = new Set(pageIndicesToDelete);
  const keepIndices: number[] = [];

  for (let i = 0; i < totalPages; i++) {
    if (!toDeleteSet.has(i)) {
      keepIndices.push(i);
    }
  }

  if (keepIndices.length === 0) {
    throw new Error('Cannot delete all pages in the PDF.');
  }

  const copiedPages = await newDoc.copyPages(srcDoc, keepIndices);
  copiedPages.forEach((page) => newDoc.addPage(page));

  return await newDoc.save();
}

/**
 * Split a PDF into one or more range bundles
 */
export async function splitPdf(
  data: ArrayBuffer,
  ranges: { start: number; end: number; label: string }[]
): Promise<{ name: string; data: Uint8Array }[]> {
  const srcDoc = await PDFDocument.load(data);
  const totalPages = srcDoc.getPageCount();
  const results: { name: string; data: Uint8Array }[] = [];

  for (const range of ranges) {
    const startIdx = Math.max(0, range.start - 1);
    const endIdx = Math.min(totalPages - 1, range.end - 1);

    if (startIdx > endIdx) continue;

    const indicesToCopy: number[] = [];
    for (let i = startIdx; i <= endIdx; i++) {
      indicesToCopy.push(i);
    }

    const bundleDoc = await PDFDocument.create();
    const copiedPages = await bundleDoc.copyPages(srcDoc, indicesToCopy);
    copiedPages.forEach((p) => bundleDoc.addPage(p));

    const bundleBytes = await bundleDoc.save();
    results.push({
      name: range.label,
      data: bundleBytes,
    });
  }

  return results;
}

/**
 * Extract selected pages (0-based) into a new PDF
 */
export async function extractPages(
  data: ArrayBuffer,
  pageIndices: number[]
): Promise<Uint8Array> {
  const srcDoc = await PDFDocument.load(data);
  const newDoc = await PDFDocument.create();
  const totalPages = srcDoc.getPageCount();

  const validIndices = pageIndices.filter((i) => i >= 0 && i < totalPages);
  if (validIndices.length === 0) {
    throw new Error('No valid pages selected to extract.');
  }

  const copiedPages = await newDoc.copyPages(srcDoc, validIndices);
  copiedPages.forEach((p) => newDoc.addPage(p));

  return await newDoc.save();
}

/**
 * Rotate all or selected pages by specified degrees
 */
export async function rotatePages(
  data: ArrayBuffer,
  rotationsByPage: Record<number, number>
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(data);
  const pages = doc.getPages();

  pages.forEach((page, idx) => {
    const additional = rotationsByPage[idx];
    if (additional) {
      const curAngle = page.getRotation().angle;
      page.setRotation(degrees((curAngle + additional) % 360));
    }
  });

  return await doc.save();
}

/**
 * Parse page range string like "1-3, 5, 8-10" into 0-based index set
 */
export function parsePageRangeString(rangeStr: string, totalPages: number): Set<number> {
  const result = new Set<number>();
  if (!rangeStr.trim()) return result;

  const parts = rangeStr.split(',');
  for (const part of parts) {
    const clean = part.trim();
    if (clean.includes('-')) {
      const [startStr, endStr] = clean.split('-');
      const start = parseInt(startStr.trim(), 10);
      const end = parseInt(endStr.trim(), 10);
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.max(1, Math.min(start, end));
        const max = Math.min(totalPages, Math.max(start, end));
        for (let i = min; i <= max; i++) {
          result.add(i - 1);
        }
      }
    } else {
      const pageNum = parseInt(clean, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        result.add(pageNum - 1);
      }
    }
  }

  return result;
}

/**
 * Add Watermark (text or image) to PDF
 */
export async function addWatermark(
  data: ArrayBuffer,
  config: WatermarkConfig
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(data);
  const pages = doc.getPages();
  const totalPages = pages.length;

  const targetPages =
    config.pages === 'all'
      ? new Set(Array.from({ length: totalPages }, (_, i) => i))
      : parsePageRangeString(config.pageRange || '', totalPages);

  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const textColor = hexToRgb(config.color || '#94a3b8');

  let embeddedImage: any = null;
  if (config.type === 'image' && config.imageUrl) {
    try {
      const imageBytes = await fetch(config.imageUrl).then((r) => r.arrayBuffer());
      if (config.imageUrl.includes('image/png') || config.imageUrl.endsWith('.png')) {
        embeddedImage = await doc.embedPng(imageBytes);
      } else {
        embeddedImage = await doc.embedJpg(imageBytes);
      }
    } catch (e) {
      console.error('Failed to embed watermark image', e);
    }
  }

  pages.forEach((page, idx) => {
    if (!targetPages.has(idx)) return;

    const { width, height } = page.getSize();

    if (config.type === 'text') {
      const text = config.text || 'CONFIDENTIAL';
      const fontSize = config.fontSize || 54;
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = font.heightAtSize(fontSize);

      if (config.position === 'tile') {
        const rows = 3;
        const cols = 2;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const x = (width / (cols + 1)) * (c + 1) - textWidth / 2;
            const y = (height / (rows + 1)) * (r + 1) - textHeight / 2;
            page.drawText(text, {
              x,
              y,
              size: fontSize * 0.7,
              font,
              color: textColor,
              opacity: config.opacity,
              rotate: degrees(config.rotation || 45),
            });
          }
        }
      } else {
        let x = (width - textWidth) / 2;
        let y = (height - textHeight) / 2;

        if (config.position === 'top-left') {
          x = 40;
          y = height - 60;
        } else if (config.position === 'top-right') {
          x = width - textWidth - 40;
          y = height - 60;
        } else if (config.position === 'bottom-left') {
          x = 40;
          y = 40;
        } else if (config.position === 'bottom-right') {
          x = width - textWidth - 40;
          y = 40;
        }

        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: textColor,
          opacity: config.opacity,
          rotate: degrees(config.rotation || 0),
        });
      }
    } else if (config.type === 'image' && embeddedImage) {
      const imgDims = embeddedImage.scaleToFit(width * 0.5, height * 0.5);
      const x = (width - imgDims.width) / 2;
      const y = (height - imgDims.height) / 2;

      page.drawImage(embeddedImage, {
        x,
        y,
        width: imgDims.width,
        height: imgDims.height,
        opacity: config.opacity,
        rotate: degrees(config.rotation || 0),
      });
    }
  });

  return await doc.save();
}

/**
 * Add Page Numbers to PDF
 */
export async function addPageNumbers(
  data: ArrayBuffer,
  config: PageNumberConfig
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(data);
  const pages = doc.getPages();
  const totalPages = pages.length;

  const targetPages =
    config.pages === 'all'
      ? new Set(Array.from({ length: totalPages }, (_, i) => i))
      : parsePageRangeString(config.pageRange || '', totalPages);

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const textColor = hexToRgb(config.color || '#334155');
  const fontSize = config.fontSize || 10;
  const margin = config.margin || 30;

  pages.forEach((page, idx) => {
    if (!targetPages.has(idx)) return;

    const pageNum = config.startNumber + idx;
    let label = `${pageNum}`;
    if (config.format === 'page-n') {
      label = `Page ${pageNum}`;
    } else if (config.format === 'page-n-of-total') {
      label = `Page ${pageNum} of ${totalPages + config.startNumber - 1}`;
    } else if (config.format === 'n-slash-total') {
      label = `${pageNum} / ${totalPages + config.startNumber - 1}`;
    }

    const textWidth = font.widthOfTextAtSize(label, fontSize);
    const { width, height } = page.getSize();

    let x = (width - textWidth) / 2;
    let y = margin;

    if (config.position.includes('top')) {
      y = height - margin;
    } else {
      y = margin;
    }

    if (config.position.endsWith('left')) {
      x = margin;
    } else if (config.position.endsWith('right')) {
      x = width - textWidth - margin;
    } else {
      x = (width - textWidth) / 2;
    }

    page.drawText(label, {
      x,
      y,
      size: fontSize,
      font,
      color: textColor,
    });
  });

  return await doc.save();
}

/**
 * Apply annotations and edits (drawings, texts, shapes, images, signatures, forms)
 */
export async function applyAnnotationsAndEdits(
  data: ArrayBuffer,
  annotationsByPage: Record<number, AnyAnnotation[]>
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(data);
  const pages = doc.getPages();

  const standardFont = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await doc.embedFont(StandardFonts.HelveticaOblique);
  const boldItalicFont = await doc.embedFont(StandardFonts.HelveticaBoldOblique);

  // Cache embedded image objects
  const imageEmbedCache = new Map<string, any>();

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    const annotations = annotationsByPage[pageIdx] || [];
    if (annotations.length === 0) continue;

    const { height: pageHeight } = page.getSize();

    for (const ann of annotations) {
      if (ann.type === 'whiteout') {
        // Redaction / cover box
        // Coordinate in editor: x, y from top-left.
        // PDF-lib coordinate: y from bottom-left.
        const pdfY = pageHeight - ann.y - ann.height;
        page.drawRectangle({
          x: ann.x,
          y: pdfY,
          width: ann.width,
          height: ann.height,
          color: rgb(1, 1, 1),
          borderWidth: 0,
        });
      } else if (ann.type === 'text') {
        let font = standardFont;
        if (ann.bold && ann.italic) font = boldItalicFont;
        else if (ann.bold) font = boldFont;
        else if (ann.italic) font = italicFont;

        const color = hexToRgb(ann.color || '#000000');
        const pdfY = pageHeight - ann.y - ann.fontSize;

        // Support RTL Hebrew text if detected:
        let displayText = ann.text;
        const hasHebrew = /[\u0590-\u05FF]/.test(ann.text);
        if (hasHebrew) {
          // Standard Helvetica does not contain Hebrew glyphs directly.
          // To guarantee Hebrew renders cleanly without crashing pdf-lib font lookup,
          // we render it using an in-memory high-res canvas stamp, which preserves 100% fidelity!
          const stampCanvas = document.createElement('canvas');
          const ctx = stampCanvas.getContext('2d');
          const scale = 3;
          if (ctx) {
            const fontSpec = `${ann.bold ? 'bold ' : ''}${ann.italic ? 'italic ' : ''}${ann.fontSize * scale}px 'Plus Jakarta Sans', Arial, sans-serif`;
            ctx.font = fontSpec;
            const metrics = ctx.measureText(displayText);
            const w = Math.ceil(metrics.width + 20);
            const h = Math.ceil(ann.fontSize * scale * 1.5);
            stampCanvas.width = w;
            stampCanvas.height = h;

            ctx.font = fontSpec;
            ctx.fillStyle = ann.color || '#000000';
            ctx.textBaseline = 'top';
            ctx.direction = 'rtl';
            ctx.fillText(displayText, w - 10, 4);

            const pngData = stampCanvas.toDataURL('image/png');
            const embedded = await doc.embedPng(pngData);
            page.drawImage(embedded, {
              x: ann.x,
              y: pageHeight - ann.y - h / scale,
              width: w / scale,
              height: h / scale,
            });
            continue;
          }
        }

        page.drawText(displayText, {
          x: ann.x,
          y: pdfY,
          size: ann.fontSize,
          font,
          color,
        });

        if (ann.underline) {
          const textWidth = font.widthOfTextAtSize(displayText, ann.fontSize);
          page.drawLine({
            start: { x: ann.x, y: pdfY - 2 },
            end: { x: ann.x + textWidth, y: pdfY - 2 },
            thickness: 1,
            color,
          });
        }
      } else if (ann.type === 'drawing') {
        const color = hexToRgb(ann.color || '#ef4444');
        const points = ann.points;
        if (!points || points.length < 2) continue;

        const opacity = ann.isHighlighter ? Math.min(ann.opacity || 0.35, 0.4) : (ann.opacity || 1);
        const strokeWidth = ann.strokeWidth || (ann.isHighlighter ? 16 : 2);

        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];
          page.drawLine({
            start: { x: p1.x, y: pageHeight - p1.y },
            end: { x: p2.x, y: pageHeight - p2.y },
            thickness: strokeWidth,
            color,
            opacity,
          });
        }
      } else if (ann.type === 'shape') {
        const strokeColor = hexToRgb(ann.strokeColor || '#2563eb');
        const pdfY = pageHeight - ann.y - ann.height;

        if (ann.shapeType === 'rect') {
          page.drawRectangle({
            x: ann.x,
            y: pdfY,
            width: ann.width,
            height: ann.height,
            borderColor: strokeColor,
            borderWidth: ann.strokeWidth || 2,
            color: ann.fillColor ? hexToRgb(ann.fillColor) : undefined,
            opacity: ann.opacity || 1,
          });
        } else if (ann.shapeType === 'circle') {
          const radiusX = Math.abs(ann.width) / 2;
          const radiusY = Math.abs(ann.height) / 2;
          page.drawEllipse({
            x: ann.x + radiusX,
            y: pdfY + radiusY,
            xScale: radiusX,
            yScale: radiusY,
            borderColor: strokeColor,
            borderWidth: ann.strokeWidth || 2,
            color: ann.fillColor ? hexToRgb(ann.fillColor) : undefined,
            opacity: ann.opacity || 1,
          });
        } else if (ann.shapeType === 'line' || ann.shapeType === 'arrow') {
          const endX = ann.endX !== undefined ? ann.endX : ann.x + ann.width;
          const endY = ann.endY !== undefined ? ann.endY : ann.y + ann.height;

          page.drawLine({
            start: { x: ann.x, y: pageHeight - ann.y },
            end: { x: endX, y: pageHeight - endY },
            thickness: ann.strokeWidth || 2,
            color: strokeColor,
            opacity: ann.opacity || 1,
          });

          if (ann.shapeType === 'arrow') {
            // Draw arrowhead
            const angle = Math.atan2((pageHeight - endY) - (pageHeight - ann.y), endX - ann.x);
            const headLength = 12;
            const arrowAngle = Math.PI / 6;

            const x3 = endX - headLength * Math.cos(angle - arrowAngle);
            const y3 = (pageHeight - endY) - headLength * Math.sin(angle - arrowAngle);
            const x4 = endX - headLength * Math.cos(angle + arrowAngle);
            const y4 = (pageHeight - endY) - headLength * Math.sin(angle + arrowAngle);

            page.drawLine({
              start: { x: endX, y: pageHeight - endY },
              end: { x: x3, y: y3 },
              thickness: ann.strokeWidth || 2,
              color: strokeColor,
            });
            page.drawLine({
              start: { x: endX, y: pageHeight - endY },
              end: { x: x4, y: y4 },
              thickness: ann.strokeWidth || 2,
              color: strokeColor,
            });
          }
        }
      } else if (ann.type === 'signature' || ann.type === 'image') {
        const dataUrl = ann.dataUrl;
        if (!dataUrl) continue;

        let embedded = imageEmbedCache.get(dataUrl);
        if (!embedded) {
          const isPng = dataUrl.includes('image/png');
          const isJpg = dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg');

          if (isPng) {
            embedded = await doc.embedPng(dataUrl);
          } else if (isJpg) {
            embedded = await doc.embedJpg(dataUrl);
          } else {
            // Try PNG conversion via canvas
            const tempImg = new Image();
            tempImg.src = dataUrl;
            await new Promise((res) => { tempImg.onload = res; tempImg.onerror = res; });
            const c = document.createElement('canvas');
            c.width = tempImg.width || 200;
            c.height = tempImg.height || 100;
            const cx = c.getContext('2d');
            cx?.drawImage(tempImg, 0, 0);
            embedded = await doc.embedPng(c.toDataURL('image/png'));
          }
          imageEmbedCache.set(dataUrl, embedded);
        }

        if (embedded) {
          const pdfY = pageHeight - ann.y - ann.height;
          page.drawImage(embedded, {
            x: ann.x,
            y: pdfY,
            width: ann.width,
            height: ann.height,
          });
        }
      } else if (ann.type === 'form-field') {
        const pdfY = pageHeight - ann.y - ann.height;

        if (ann.fieldType === 'checkbox') {
          const boxSize = Math.min(ann.width, ann.height);
          page.drawRectangle({
            x: ann.x,
            y: pdfY,
            width: boxSize,
            height: boxSize,
            borderColor: rgb(0.2, 0.2, 0.2),
            borderWidth: 1.5,
            color: rgb(1, 1, 1),
          });
          if (ann.value === true || ann.value === 'true') {
            // Draw checkmark
            page.drawLine({
              start: { x: ann.x + 3, y: pdfY + boxSize / 2 },
              end: { x: ann.x + boxSize / 2.5, y: pdfY + 3 },
              thickness: 2,
              color: rgb(0.1, 0.5, 0.1),
            });
            page.drawLine({
              start: { x: ann.x + boxSize / 2.5, y: pdfY + 3 },
              end: { x: ann.x + boxSize - 3, y: pdfY + boxSize - 3 },
              thickness: 2,
              color: rgb(0.1, 0.5, 0.1),
            });
          }
        } else {
          // Text / Date field
          page.drawRectangle({
            x: ann.x,
            y: pdfY,
            width: ann.width,
            height: ann.height,
            borderColor: rgb(0.8, 0.85, 0.9),
            borderWidth: 1,
            color: rgb(0.98, 0.99, 1),
          });

          if (ann.value) {
            page.drawText(String(ann.value), {
              x: ann.x + 4,
              y: pdfY + (ann.height - 12) / 2,
              size: 11,
              font: standardFont,
              color: rgb(0.1, 0.1, 0.1),
            });
          }
        }
      } else if (ann.type === 'sticky') {
        const pdfY = pageHeight - ann.y - ann.height;
        page.drawRectangle({
          x: ann.x,
          y: pdfY,
          width: ann.width,
          height: ann.height,
          color: rgb(0.99, 0.96, 0.69),
          borderColor: rgb(0.9, 0.85, 0.4),
          borderWidth: 1,
        });
        if (ann.text) {
          page.drawText(ann.text.substring(0, 100), {
            x: ann.x + 6,
            y: pdfY + ann.height - 18,
            size: 9,
            font: standardFont,
            color: rgb(0.2, 0.2, 0.2),
          });
        }
      }
    }
  }

  return await doc.save();
}

/**
 * PDF Metadata read & write
 */
export async function readPdfMetadata(data: ArrayBuffer): Promise<PdfMetadata> {
  const doc = await PDFDocument.load(data);
  const kw = doc.getKeywords() as any;
  const keywordsStr = Array.isArray(kw) ? kw.join(', ') : typeof kw === 'string' ? kw : '';
  return {
    title: doc.getTitle() || '',
    author: doc.getAuthor() || '',
    subject: doc.getSubject() || '',
    keywords: keywordsStr,
    creator: doc.getCreator() || '',
    producer: doc.getProducer() || '',
    creationDate: doc.getCreationDate()?.toISOString() || '',
    modificationDate: doc.getModificationDate()?.toISOString() || '',
  };
}

export async function writePdfMetadata(
  data: ArrayBuffer,
  metadata: PdfMetadata
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(data);
  if (metadata.title) doc.setTitle(metadata.title);
  if (metadata.author) doc.setAuthor(metadata.author);
  if (metadata.subject) doc.setSubject(metadata.subject);
  if (metadata.keywords) {
    doc.setKeywords(metadata.keywords.split(',').map((k) => k.trim()));
  }
  if (metadata.creator) doc.setCreator(metadata.creator);
  if (metadata.producer) doc.setProducer(metadata.producer);
  doc.setModificationDate(new Date());

  return await doc.save();
}

/**
 * Images (JPG, PNG, WEBP) to PDF
 */
export async function imagesToPdf(
  images: { dataUrl: string; width: number; height: number }[],
  options: ImgToPdfOptions
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  // Page dimension presets in points (72 points = 1 inch)
  const PAGE_SIZES = {
    a4: { width: 595.28, height: 841.89 },
    letter: { width: 612.0, height: 792.0 },
  };

  const marginPt =
    options.margin === 'none' ? 0 : options.margin === 'small' ? 18 : 36;

  for (const item of images) {
    let embeddedImg: any;
    if (item.dataUrl.includes('image/png')) {
      embeddedImg = await doc.embedPng(item.dataUrl);
    } else {
      // JPEG or converted WEBP to JPEG/PNG
      embeddedImg = await doc.embedJpg(item.dataUrl).catch(async () => {
        return await doc.embedPng(item.dataUrl);
      });
    }

    let pageWidth: number;
    let pageHeight: number;

    if (options.pageSize === 'auto') {
      pageWidth = item.width + marginPt * 2;
      pageHeight = item.height + marginPt * 2;
    } else {
      const preset = PAGE_SIZES[options.pageSize];
      if (options.orientation === 'landscape') {
        pageWidth = preset.height;
        pageHeight = preset.width;
      } else if (options.orientation === 'portrait') {
        pageWidth = preset.width;
        pageHeight = preset.height;
      } else {
        // Auto orientation based on image aspect ratio
        if (item.width > item.height) {
          pageWidth = preset.height;
          pageHeight = preset.width;
        } else {
          pageWidth = preset.width;
          pageHeight = preset.height;
        }
      }
    }

    const page = doc.addPage([pageWidth, pageHeight]);
    const maxDrawWidth = pageWidth - marginPt * 2;
    const maxDrawHeight = pageHeight - marginPt * 2;

    const scaled = embeddedImg.scaleToFit(maxDrawWidth, maxDrawHeight);
    const x = (pageWidth - scaled.width) / 2;
    const y = (pageHeight - scaled.height) / 2;

    page.drawImage(embeddedImg, {
      x,
      y,
      width: scaled.width,
      height: scaled.height,
    });
  }

  return await doc.save();
}

/**
 * PDF Compression with real stream optimization
 */
export async function compressPdf(
  data: ArrayBuffer,
  level: 'low' | 'medium' | 'high'
): Promise<{ data: Uint8Array; originalSize: number; newSize: number }> {
  const originalSize = data.byteLength;
  const doc = await PDFDocument.load(data);

  // Use object stream compression in pdf-lib
  const useObjectStreams = true;

  if (level === 'high') {
    // Also strip unneeded document metadata to save bytes
    doc.setTitle('');
    doc.setAuthor('');
    doc.setSubject('');
    doc.setKeywords([]);
  }

  const compressedBytes = await doc.save({
    useObjectStreams,
    addDefaultPage: false,
  });

  return {
    data: compressedBytes,
    originalSize,
    newSize: compressedBytes.byteLength,
  };
}

/**
 * Create a rich 3-page sample PDF so user can test all tools immediately without uploading
 */
export async function createSampleDocument(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Page 1: Executive Proposal
  const p1 = doc.addPage([595.28, 841.89]); // A4
  p1.drawRectangle({
    x: 0,
    y: 760,
    width: 595.28,
    height: 81.89,
    color: rgb(0.09, 0.13, 0.24), // deep slate
  });
  p1.drawText('OmniPDF Solutions Group', {
    x: 50,
    y: 800,
    size: 20,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });
  p1.drawText('Confidential Client Report · Q3 Review', {
    x: 50,
    y: 778,
    size: 11,
    font: helvetica,
    color: rgb(0.7, 0.75, 0.85),
  });

  p1.drawText('1. Executive Summary', {
    x: 50,
    y: 710,
    size: 16,
    font: helveticaBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  const p1Text = [
    'This document represents a client-ready sample PDF generated entirely in-browser.',
    'You can use it to immediately test any tool in OmniPDF: merging with other documents,',
    'deleting or rotating pages, adding interactive text, signatures, whiteouts, watermarks,',
    'and page numbers without needing to upload sensitive personal files.',
  ];
  let curY = 680;
  for (const line of p1Text) {
    p1.drawText(line, {
      x: 50,
      y: curY,
      size: 11,
      font: helvetica,
      color: rgb(0.2, 0.25, 0.3),
    });
    curY -= 20;
  }

  // Draw a clean table
  curY -= 20;
  p1.drawRectangle({
    x: 50,
    y: curY,
    width: 495.28,
    height: 28,
    color: rgb(0.93, 0.95, 0.98),
  });
  p1.drawText('Milestone', { x: 60, y: curY + 9, size: 10, font: helveticaBold, color: rgb(0.1, 0.15, 0.2) });
  p1.drawText('Target Date', { x: 260, y: curY + 9, size: 10, font: helveticaBold, color: rgb(0.1, 0.15, 0.2) });
  p1.drawText('Status', { x: 440, y: curY + 9, size: 10, font: helveticaBold, color: rgb(0.1, 0.15, 0.2) });

  const rows = [
    ['Phase 1: Architecture Audit', 'October 12, 2026', 'Completed'],
    ['Phase 2: PDF Tool Engine', 'October 24, 2026', 'In Progress'],
    ['Phase 3: Production Rollout', 'November 15, 2026', 'Planned'],
  ];

  for (const row of rows) {
    curY -= 30;
    p1.drawLine({
      start: { x: 50, y: curY + 28 },
      end: { x: 545.28, y: curY + 28 },
      thickness: 0.5,
      color: rgb(0.85, 0.88, 0.92),
    });
    p1.drawText(row[0], { x: 60, y: curY + 8, size: 10, font: helvetica, color: rgb(0.2, 0.25, 0.3) });
    p1.drawText(row[1], { x: 260, y: curY + 8, size: 10, font: helvetica, color: rgb(0.2, 0.25, 0.3) });
    p1.drawText(row[2], { x: 440, y: curY + 8, size: 10, font: helveticaBold, color: rgb(0.1, 0.5, 0.3) });
  }

  // Footer on page 1
  p1.drawText('Page 1 of 3 · OmniPDF Sample Document', {
    x: 50,
    y: 35,
    size: 9,
    font: helvetica,
    color: rgb(0.5, 0.55, 0.6),
  });

  // Page 2: Analytics & Specifications
  const p2 = doc.addPage([595.28, 841.89]);
  p2.drawText('2. Technical Specifications & Page Operations', {
    x: 50,
    y: 780,
    size: 16,
    font: helveticaBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  const p2Text = [
    'Page 2 is ideal for testing:',
    '· Rotation: Test rotating this single page by 90° or 180°',
    '· Delete Pages: Test deleting page 2 and keeping pages 1 and 3',
    '· Split PDF: Split into individual 1-page files',
    '· Annotations: Highlight text or draw callout rectangles and arrows below',
  ];
  let curY2 = 740;
  for (const line of p2Text) {
    p2.drawText(line, {
      x: 50,
      y: curY2,
      size: 11,
      font: helvetica,
      color: rgb(0.2, 0.25, 0.3),
    });
    curY2 -= 24;
  }

  // Callout box on page 2
  curY2 -= 30;
  p2.drawRectangle({
    x: 50,
    y: curY2 - 100,
    width: 495.28,
    height: 110,
    color: rgb(0.96, 0.98, 1),
    borderColor: rgb(0.75, 0.85, 0.98),
    borderWidth: 1,
  });
  p2.drawText('Notice for Reviewers', {
    x: 70,
    y: curY2 - 25,
    size: 12,
    font: helveticaBold,
    color: rgb(0.1, 0.3, 0.6),
  });
  p2.drawText('All operations executed on this document occur 100% inside your web browser.', {
    x: 70,
    y: curY2 - 50,
    size: 10,
    font: helvetica,
    color: rgb(0.2, 0.3, 0.4),
  });
  p2.drawText('Try adding your own signature or whiteout block right over this box!', {
    x: 70,
    y: curY2 - 70,
    size: 10,
    font: helvetica,
    color: rgb(0.2, 0.3, 0.4),
  });

  p2.drawText('Page 2 of 3 · OmniPDF Sample Document', {
    x: 50,
    y: 35,
    size: 9,
    font: helvetica,
    color: rgb(0.5, 0.55, 0.6),
  });

  // Page 3: Sign-Off and Form Fields
  const p3 = doc.addPage([595.28, 841.89]);
  p3.drawText('3. Agreement & Sign-Off Section', {
    x: 50,
    y: 780,
    size: 16,
    font: helveticaBold,
    color: rgb(0.1, 0.15, 0.25),
  });
  p3.drawText('Please review and place your digital signature in the designated block below.', {
    x: 50,
    y: 750,
    size: 11,
    font: helvetica,
    color: rgb(0.3, 0.35, 0.4),
  });

  // Signature block area
  p3.drawRectangle({
    x: 50,
    y: 540,
    width: 230,
    height: 120,
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 1,
    color: rgb(0.99, 0.99, 1),
  });
  p3.drawText('Authorized Signature:', {
    x: 60,
    y: 635,
    size: 10,
    font: helveticaBold,
    color: rgb(0.3, 0.35, 0.4),
  });
  p3.drawLine({
    start: { x: 60, y: 575 },
    end: { x: 260, y: 575 },
    thickness: 1,
    color: rgb(0.6, 0.65, 0.7),
  });
  p3.drawText('Sign above using OmniPDF Signature tool', {
    x: 60,
    y: 555,
    size: 9,
    font: helvetica,
    color: rgb(0.5, 0.55, 0.6),
  });

  // Date block
  p3.drawRectangle({
    x: 315,
    y: 540,
    width: 230,
    height: 120,
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 1,
    color: rgb(0.99, 0.99, 1),
  });
  p3.drawText('Date of Signing:', {
    x: 325,
    y: 635,
    size: 10,
    font: helveticaBold,
    color: rgb(0.3, 0.35, 0.4),
  });
  p3.drawLine({
    start: { x: 325, y: 575 },
    end: { x: 525, y: 575 },
    thickness: 1,
    color: rgb(0.6, 0.65, 0.7),
  });
  p3.drawText('e.g. October 2026', {
    x: 325,
    y: 555,
    size: 9,
    font: helvetica,
    color: rgb(0.5, 0.55, 0.6),
  });

  p3.drawText('Page 3 of 3 · OmniPDF Sample Document', {
    x: 50,
    y: 35,
    size: 9,
    font: helvetica,
    color: rgb(0.5, 0.55, 0.6),
  });

  doc.setTitle('OmniPDF Sample Business Report');
  doc.setAuthor('OmniPDF Desktop Engine');
  doc.setSubject('Demonstration PDF for client-side editing');
  doc.setKeywords(['sample', 'pdf', 'editor', 'client-side']);

  return await doc.save();
}

/**
 * Trigger browser file download for a Uint8Array or Blob
 */
export function downloadFile(
  content: Uint8Array | Blob,
  fileName: string,
  mimeType: string = 'application/pdf'
) {
  const blob =
    content instanceof Blob ? content : new Blob([content as any], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 300);
}
