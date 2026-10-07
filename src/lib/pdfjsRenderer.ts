import { pdfjsLib } from './pdfjs';

export interface PageDimension {
  pageNumber: number;
  width: number;
  height: number;
  rotation: number;
}

// In-memory cache for loaded pdfjs documents to prevent repeated parsing
const docCache = new WeakMap<ArrayBuffer, any>();

export async function getPdfJsDoc(data: ArrayBuffer, password?: string) {
  if (docCache.has(data) && !password) {
    return docCache.get(data);
  }
  // Make a copy of buffer to avoid detachment issues if transferred
  const copyBuffer = data.slice(0);
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(copyBuffer),
    password,
    cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/cmaps/',
    cMapPacked: true,
  });
  const doc = await loadingTask.promise;
  if (!password) {
    docCache.set(data, doc);
  }
  return doc;
}

export async function getPdfInfo(data: ArrayBuffer): Promise<{
  pageCount: number;
  dimensions: PageDimension[];
}> {
  const doc = await getPdfJsDoc(data);
  const pageCount = doc.numPages;
  const dimensions: PageDimension[] = [];

  for (let i = 1; i <= pageCount; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1.0 });
    dimensions.push({
      pageNumber: i,
      width: viewport.width,
      height: viewport.height,
      rotation: viewport.rotation,
    });
  }

  return { pageCount, dimensions };
}

export async function renderPdfPage(
  data: ArrayBuffer,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5,
  rotationOffset: number = 0
): Promise<{ width: number; height: number }> {
  const doc = await getPdfJsDoc(data);
  const page = await doc.getPage(pageNumber);
  
  // Calculate combined rotation
  const baseRotation = page.rotate || 0;
  const effectiveRotation = (baseRotation + rotationOffset) % 360;
  
  const viewport = page.getViewport({ scale, rotation: effectiveRotation });
  
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Could not obtain canvas 2D context');

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: context,
    viewport,
  };

  await page.render(renderContext).promise;
  return { width: viewport.width, height: viewport.height };
}

export async function renderPageThumbnail(
  data: ArrayBuffer,
  pageNumber: number,
  maxDimension: number = 240,
  rotationOffset: number = 0
): Promise<string> {
  const doc = await getPdfJsDoc(data);
  const page = await doc.getPage(pageNumber);

  const baseRotation = page.rotate || 0;
  const effectiveRotation = (baseRotation + rotationOffset) % 360;

  const initialViewport = page.getViewport({ scale: 1.0, rotation: effectiveRotation });
  const scale = Math.min(
    maxDimension / initialViewport.width,
    maxDimension / initialViewport.height
  );

  const viewport = page.getViewport({ scale, rotation: effectiveRotation });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return '';

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return canvas.toDataURL('image/jpeg', 0.85);
}
