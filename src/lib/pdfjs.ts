import * as pdfjsLib from 'pdfjs-dist';

// Configure worker
if (typeof window !== 'undefined') {
  // Use cloudflare CDN or unpkg matching the version, or local worker
  try {
    const version = (pdfjsLib as any).version || '4.10.38';
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('Worker configuration notice', e);
  }
}

export { pdfjsLib };
