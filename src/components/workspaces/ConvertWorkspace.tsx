import React, { useState } from 'react';
import {
  ArrowLeft,
  Download,
  Image as ImageIcon,
  FileImage,
  Loader2,
  Trash2,
  RotateCw,
  Plus,
  ChevronLeft,
  ChevronRight,
  PackageCheck,
} from 'lucide-react';
import JSZip from 'jszip';
import { ImgToPdfOptions, PdfFileItem } from '../../types/pdf';
import { renderPdfPage } from '../../lib/pdfjsRenderer';
import { downloadFile, imagesToPdf, parsePageRangeString } from '../../lib/pdfEngine';
import { FileDropzone } from '../FileDropzone';

interface ConvertWorkspaceProps {
  toolId: 'pdf-to-img' | 'img-to-pdf';
  initialPdf?: PdfFileItem;
  onBack: () => void;
  onUseSample?: () => void;
}

interface UploadedImage {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
  rotation: number;
}

export const ConvertWorkspace: React.FC<ConvertWorkspaceProps> = ({
  toolId,
  initialPdf,
  onBack,
  onUseSample,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');

  // PDF to Images Settings
  const [format, setFormat] = useState<'jpg' | 'png'>('jpg');
  const [resolutionScale, setResolutionScale] = useState<number>(2.0); // 2x high resolution
  const [pageScope, setPageScope] = useState<'all' | 'custom'>('all');
  const [customRange, setCustomRange] = useState('1');

  // Images to PDF Settings
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [pageSize, setPageSize] = useState<'a4' | 'letter' | 'auto'>('a4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape' | 'auto'>('portrait');
  const [margin, setMargin] = useState<'none' | 'small' | 'normal'>('small');

  // Load dropped images for Images to PDF
  const handleImagesSelected = (files: File[]) => {
    const validImageFiles = files.filter((f) =>
      f.type.startsWith('image/') || /\.(jpe?g|png|webp)$/i.test(f.name)
    );

    validImageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          const img = new Image();
          img.src = evt.target.result as string;
          img.onload = () => {
            setImages((prev) => [
              ...prev,
              {
                id: `img-${Date.now()}-${Math.random()}`,
                name: file.name,
                dataUrl: evt.target!.result as string,
                width: img.width,
                height: img.height,
                rotation: 0,
              },
            ]);
          };
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRotateImage = (index: number) => {
    setImages((prev) => {
      const next = [...prev];
      const cur = next[index];
      next[index] = {
        ...cur,
        rotation: (cur.rotation + 90) % 360,
      };
      return next;
    });
  };

  const handleDeleteImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveImage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= images.length) return;
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  // Execution: PDF -> JPG/PNG
  const handleConvertPdfToImages = async () => {
    if (!initialPdf) return;
    setIsProcessing(true);

    try {
      const totalPages = initialPdf.pageCount;
      const targetIndices =
        pageScope === 'all'
          ? Array.from({ length: totalPages }, (_, i) => i + 1)
          : Array.from(parsePageRangeString(customRange, totalPages)).map((i) => i + 1);

      if (targetIndices.length === 0) {
        alert('Please specify at least one valid page number.');
        setIsProcessing(false);
        return;
      }

      const zip = new JSZip();
      const mime = format === 'png' ? 'image/png' : 'image/jpeg';
      const ext = format === 'png' ? 'png' : 'jpg';

      for (let i = 0; i < targetIndices.length; i++) {
        const pageNum = targetIndices[i];
        setProgressText(`Rendering page ${pageNum} (${i + 1}/${targetIndices.length})...`);

        const offscreen = document.createElement('canvas');
        await renderPdfPage(initialPdf.data, pageNum, offscreen, resolutionScale);

        const blob = await new Promise<Blob | null>((res) =>
          offscreen.toBlob((b) => res(b), mime, 0.92)
        );

        if (blob) {
          zip.file(`page_${pageNum}.${ext}`, blob);
        }
      }

      if (targetIndices.length === 1) {
        // Download single image directly
        setProgressText('Preparing download...');
        const singleBlob = await zip.file(`page_${targetIndices[0]}.${ext}`)?.async('blob');
        if (singleBlob) {
          downloadFile(
            singleBlob,
            `${initialPdf.name.replace('.pdf', '')}_page_${targetIndices[0]}.${ext}`,
            mime
          );
        }
      } else {
        // Download ZIP
        setProgressText('Compressing ZIP archive...');
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadFile(
          zipBlob,
          `${initialPdf.name.replace('.pdf', '')}_images.zip`,
          'application/zip'
        );
      }
    } catch (err: any) {
      console.error('PDF to Image conversion error', err);
      alert(`Conversion failed: ${err.message || 'Error rendering pages'}`);
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  // Execution: Images -> PDF
  const handleConvertImagesToPdf = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);
    setProgressText('Compiling PDF from images...');

    try {
      // If any image has rotation, rotate canvas first
      const processedImages: { dataUrl: string; width: number; height: number }[] = [];

      for (const img of images) {
        if (img.rotation === 0) {
          processedImages.push({
            dataUrl: img.dataUrl,
            width: img.width,
            height: img.height,
          });
        } else {
          // Render rotated image to canvas
          const c = document.createElement('canvas');
          const is90or270 = img.rotation === 90 || img.rotation === 270;
          c.width = is90or270 ? img.height : img.width;
          c.height = is90or270 ? img.width : img.height;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.translate(c.width / 2, c.height / 2);
            ctx.rotate((img.rotation * Math.PI) / 180);
            const rawImg = new Image();
            rawImg.src = img.dataUrl;
            await new Promise((r) => { rawImg.onload = r; });
            ctx.drawImage(rawImg, -img.width / 2, -img.height / 2);
            processedImages.push({
              dataUrl: c.toDataURL('image/jpeg', 0.95),
              width: c.width,
              height: c.height,
            });
          }
        }
      }

      const options: ImgToPdfOptions = {
        pageSize,
        orientation,
        margin,
      };

      const pdfBytes = await imagesToPdf(processedImages, options);
      downloadFile(pdfBytes, 'converted_images.pdf');
    } catch (err: any) {
      console.error('Images to PDF error', err);
      alert(`Could not compile PDF: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgressText('');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-neutral-900">
              {toolId === 'pdf-to-img' ? 'Convert PDF to JPG / PNG' : 'Convert Images to PDF'}
            </h2>
            <p className="text-xs text-neutral-500">
              {toolId === 'pdf-to-img'
                ? initialPdf?.name
                : `${images.length} images uploaded`}
            </p>
          </div>
        </div>

        <button
          onClick={
            toolId === 'pdf-to-img'
              ? handleConvertPdfToImages
              : handleConvertImagesToPdf
          }
          disabled={isProcessing || (toolId === 'img-to-pdf' && images.length === 0)}
          className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 transition-all shadow-sm"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{progressText || 'Converting...'}</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>
                {toolId === 'pdf-to-img' ? 'Export Images (ZIP)' : 'Create & Download PDF'}
              </span>
            </>
          )}
        </button>
      </div>

      {toolId === 'pdf-to-img' && initialPdf && (
        <div className="max-w-2xl mx-auto mt-8 bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              PDF
            </div>
            <div>
              <h4 className="text-sm font-semibold text-neutral-900">{initialPdf.name}</h4>
              <p className="text-xs text-neutral-500">
                {initialPdf.pageCount} pages · {(initialPdf.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-2">
              Image Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFormat('jpg')}
                className={`p-3 border rounded-xl text-left transition-colors ${
                  format === 'jpg'
                    ? 'border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="text-sm font-bold text-neutral-900">JPG (Standard)</div>
                <div className="text-xs text-neutral-500">Smaller file size, ideal for web & sharing</div>
              </button>
              <button
                onClick={() => setFormat('png')}
                className={`p-3 border rounded-xl text-left transition-colors ${
                  format === 'png'
                    ? 'border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="text-sm font-bold text-neutral-900">PNG (Lossless)</div>
                <div className="text-xs text-neutral-500">Crisp text and transparency preservation</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-2">
              Resolution Quality
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { scale: 1.0, label: 'Standard (72 DPI)' },
                { scale: 2.0, label: 'High (150 DPI)' },
                { scale: 3.0, label: 'Ultra (300 DPI)' },
              ].map((res) => (
                <button
                  key={res.scale}
                  onClick={() => setResolutionScale(res.scale)}
                  className={`py-2 px-3 border rounded-xl text-xs font-medium text-center transition-colors ${
                    resolutionScale === res.scale
                      ? 'border-neutral-900 bg-neutral-900 text-white'
                      : 'border-neutral-200 hover:border-neutral-300 text-neutral-700'
                  }`}
                >
                  {res.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-2">
              Pages to Convert
            </label>
            <div className="flex items-center gap-4 text-xs mb-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  checked={pageScope === 'all'}
                  onChange={() => setPageScope('all')}
                  className="text-neutral-900"
                />
                <span>All {initialPdf.pageCount} pages</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  checked={pageScope === 'custom'}
                  onChange={() => setPageScope('custom')}
                  className="text-neutral-900"
                />
                <span>Select page range</span>
              </label>
            </div>
            {pageScope === 'custom' && (
              <input
                type="text"
                value={customRange}
                onChange={(e) => setCustomRange(e.target.value)}
                placeholder="e.g. 1-3, 5"
                className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-neutral-900"
              />
            )}
          </div>
        </div>
      )}

      {toolId === 'img-to-pdf' && (
        <div className="mt-6 space-y-6">
          {/* Top Options Bar */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-700">Page Size:</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(e.target.value as any)}
                  className="px-2.5 py-1.5 border border-neutral-300 rounded-lg outline-none"
                >
                  <option value="a4">A4 (210 × 297 mm)</option>
                  <option value="letter">US Letter (8.5 × 11 in)</option>
                  <option value="auto">Auto (Fit to image)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-700">Orientation:</span>
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as any)}
                  className="px-2.5 py-1.5 border border-neutral-300 rounded-lg outline-none"
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                  <option value="auto">Auto detect</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-neutral-700">Margins:</span>
                <select
                  value={margin}
                  onChange={(e) => setMargin(e.target.value as any)}
                  className="px-2.5 py-1.5 border border-neutral-300 rounded-lg outline-none"
                >
                  <option value="none">No Margin (0)</option>
                  <option value="small">Small Margin</option>
                  <option value="normal">Standard Margin</option>
                </select>
              </div>
            </div>

            <label className="cursor-pointer px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-medium rounded-lg flex items-center gap-1.5 transition-colors">
              <Plus className="w-3.5 h-3.5" />
              <span>Add Images</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleImagesSelected(Array.from(e.target.files));
                }}
              />
            </label>
          </div>

          {/* Upload Dropzone if no images */}
          {images.length === 0 ? (
            <FileDropzone
              isImageMode
              multiple
              accept="image/png,image/jpeg,image/webp"
              title="Upload JPG, PNG, or WEBP images"
              subtitle="Drag & drop images here or browse files to combine into a PDF document"
              onFilesSelected={handleImagesSelected}
            />
          ) : (
            /* Grid of Images to Reorder */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {images.map((img, idx) => (
                <div
                  key={img.id}
                  className="bg-white rounded-2xl border border-neutral-200 overflow-hidden flex flex-col hover:border-neutral-400 transition-colors shadow-xs"
                >
                  <div className="p-2 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-700">Image {idx + 1}</span>
                    <div className="flex items-center gap-1">
                      <button
                        disabled={idx === 0}
                        onClick={() => handleMoveImage(idx, idx - 1)}
                        className="p-0.5 hover:bg-neutral-200 rounded disabled:opacity-30"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        disabled={idx === images.length - 1}
                        onClick={() => handleMoveImage(idx, idx + 1)}
                        className="p-0.5 hover:bg-neutral-200 rounded disabled:opacity-30"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="aspect-[3/4] p-3 flex items-center justify-center bg-neutral-100/50">
                    <img
                      src={img.dataUrl}
                      alt={img.name}
                      style={{ transform: `rotate(${img.rotation}deg)` }}
                      className="max-h-full max-w-full object-contain rounded shadow-xs transition-transform"
                    />
                  </div>

                  <div className="p-2 border-t border-neutral-100 flex items-center justify-between text-neutral-600">
                    <button
                      onClick={() => handleRotateImage(idx)}
                      title="Rotate 90°"
                      className="p-1 hover:bg-neutral-100 rounded"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteImage(idx)}
                      title="Remove"
                      className="p-1 hover:bg-rose-50 hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
