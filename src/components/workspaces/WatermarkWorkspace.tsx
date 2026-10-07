import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Download,
  Stamp,
  Hash,
  Loader2,
  Upload,
  Eye,
} from 'lucide-react';
import { PageNumberConfig, PdfFileItem, ToolId, WatermarkConfig } from '../../types/pdf';
import { renderPdfPage } from '../../lib/pdfjsRenderer';
import { addPageNumbers, addWatermark, downloadFile } from '../../lib/pdfEngine';

interface WatermarkWorkspaceProps {
  toolId: 'watermark' | 'page-numbers';
  initialFile: PdfFileItem;
  onBack: () => void;
}

export const WatermarkWorkspace: React.FC<WatermarkWorkspaceProps> = ({
  toolId,
  initialFile,
  onBack,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  // Watermark Settings
  const [wmType, setWmType] = useState<'text' | 'image'>('text');
  const [wmText, setWmText] = useState('CONFIDENTIAL');
  const [wmImageUrl, setWmImageUrl] = useState<string | undefined>();
  const [wmFontSize, setWmFontSize] = useState(48);
  const [wmOpacity, setWmOpacity] = useState(0.3);
  const [wmRotation, setWmRotation] = useState(45);
  const [wmColor, setWmColor] = useState('#64748b');
  const [wmPosition, setWmPosition] = useState<
    'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'tile'
  >('center');
  const [wmPages, setWmPages] = useState<'all' | 'custom'>('all');
  const [wmPageRange, setWmPageRange] = useState('1');

  // Page Number Settings
  const [pnFormat, setPnFormat] = useState<
    'n' | 'page-n' | 'page-n-of-total' | 'n-slash-total'
  >('page-n-of-total');
  const [pnPosition, setPnPosition] = useState<
    | 'bottom-center'
    | 'bottom-right'
    | 'bottom-left'
    | 'top-center'
    | 'top-right'
    | 'top-left'
  >('bottom-center');
  const [pnStartNum, setPnStartNum] = useState(1);
  const [pnFontSize, setPnFontSize] = useState(10);
  const [pnColor, setPnColor] = useState('#334155');

  // Preview canvas ref
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [previewDims, setPreviewDims] = useState({ width: 400, height: 560 });

  useEffect(() => {
    let cancelled = false;
    async function renderPreview() {
      if (!canvasRef.current) return;
      try {
        const dims = await renderPdfPage(initialFile.data, 1, canvasRef.current, 0.9);
        if (!cancelled) {
          setPreviewDims(dims);
        }
      } catch (e) {
        console.warn('Preview render error', e);
      }
    }
    renderPreview();
    return () => {
      cancelled = true;
    };
  }, [initialFile]);

  // Image upload for image watermark
  const handleWatermarkImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          setWmImageUrl(evt.target.result as string);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleApplyAndDownload = async () => {
    setIsProcessing(true);
    try {
      if (toolId === 'watermark') {
        const config: WatermarkConfig = {
          type: wmType,
          text: wmText,
          imageUrl: wmImageUrl,
          fontSize: wmFontSize,
          opacity: wmOpacity,
          rotation: wmRotation,
          color: wmColor,
          position: wmPosition,
          pages: wmPages,
          pageRange: wmPageRange,
        };
        const resultBytes = await addWatermark(initialFile.data, config);
        downloadFile(resultBytes, `${initialFile.name.replace('.pdf', '')}_watermarked.pdf`);
      } else {
        const config: PageNumberConfig = {
          format: pnFormat,
          position: pnPosition,
          startNumber: pnStartNum,
          fontSize: pnFontSize,
          color: pnColor,
          pages: 'all',
          margin: 30,
        };
        const resultBytes = await addPageNumbers(initialFile.data, config);
        downloadFile(resultBytes, `${initialFile.name.replace('.pdf', '')}_numbered.pdf`);
      }
    } catch (err: any) {
      console.error('Failed to apply:', err);
      alert(`Error applying changes: ${err.message || 'Please check your inputs'}`);
    } finally {
      setIsProcessing(false);
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
              {toolId === 'watermark' ? 'Watermark PDF' : 'Add Page Numbers'}
            </h2>
            <p className="text-xs text-neutral-500">
              {initialFile.name} · {initialFile.pageCount} page(s)
            </p>
          </div>
        </div>

        <button
          onClick={handleApplyAndDownload}
          disabled={isProcessing}
          className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 transition-all shadow-sm"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Applying...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Save & Download PDF</span>
            </>
          )}
        </button>
      </div>

      {/* Main Grid: Controls on left, Live preview on right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
        {/* Controls Column */}
        <div className="lg:col-span-5 space-y-6">
          {toolId === 'watermark' ? (
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-5">
              <h3 className="text-sm font-semibold text-neutral-900">Watermark Configuration</h3>

              {/* Type Switcher */}
              <div className="flex rounded-lg bg-neutral-100 p-1 text-xs font-medium">
                <button
                  onClick={() => setWmType('text')}
                  className={`flex-1 py-1.5 rounded-md transition-colors ${
                    wmType === 'text' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600'
                  }`}
                >
                  Text Watermark
                </button>
                <button
                  onClick={() => setWmType('image')}
                  className={`flex-1 py-1.5 rounded-md transition-colors ${
                    wmType === 'image' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600'
                  }`}
                >
                  Image Watermark
                </button>
              </div>

              {wmType === 'text' ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      Watermark Text
                    </label>
                    <input
                      type="text"
                      value={wmText}
                      onChange={(e) => setWmText(e.target.value)}
                      placeholder="e.g. CONFIDENTIAL, DRAFT, SAMPLE"
                      className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Font Size ({wmFontSize}pt)
                      </label>
                      <input
                        type="range"
                        min="20"
                        max="90"
                        value={wmFontSize}
                        onChange={(e) => setWmFontSize(parseInt(e.target.value, 10))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1">
                        Rotation ({wmRotation}°)
                      </label>
                      <input
                        type="range"
                        min="-90"
                        max="90"
                        step="15"
                        value={wmRotation}
                        onChange={(e) => setWmRotation(parseInt(e.target.value, 10))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-2">
                    Upload Logo / Image
                  </label>
                  <label className="cursor-pointer border-2 border-dashed border-neutral-300 hover:border-neutral-400 rounded-xl p-4 flex flex-col items-center justify-center transition-colors">
                    <Upload className="w-6 h-6 text-neutral-400 mb-1" />
                    <span className="text-xs font-medium text-neutral-700">
                      {wmImageUrl ? 'Image selected' : 'Choose PNG/JPG watermark'}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={handleWatermarkImageUpload}
                    />
                  </label>
                </div>
              )}

              {/* Opacity slider */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Opacity ({Math.round(wmOpacity * 100)}%)
                </label>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={wmOpacity}
                  onChange={(e) => setWmOpacity(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Position */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Position</label>
                <select
                  value={wmPosition}
                  onChange={(e) => setWmPosition(e.target.value as any)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-xs outline-none"
                >
                  <option value="center">Center</option>
                  <option value="tile">Tile Across Page</option>
                  <option value="top-left">Top Left</option>
                  <option value="top-right">Top Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="bottom-right">Bottom Right</option>
                </select>
              </div>

              {/* Pages target */}
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Apply To</label>
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={wmPages === 'all'}
                      onChange={() => setWmPages('all')}
                      className="text-neutral-900"
                    />
                    <span>All Pages</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      checked={wmPages === 'custom'}
                      onChange={() => setWmPages('custom')}
                      className="text-neutral-900"
                    />
                    <span>Specific Pages</span>
                  </label>
                </div>
                {wmPages === 'custom' && (
                  <input
                    type="text"
                    value={wmPageRange}
                    onChange={(e) => setWmPageRange(e.target.value)}
                    placeholder="e.g. 1-3, 5"
                    className="mt-2 w-full px-3 py-1.5 border border-neutral-300 rounded-lg text-xs"
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-5">
              <h3 className="text-sm font-semibold text-neutral-900">Page Numbers Configuration</h3>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Format</label>
                <select
                  value={pnFormat}
                  onChange={(e) => setPnFormat(e.target.value as any)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-xs outline-none"
                >
                  <option value="page-n-of-total">Page 1 of {initialFile.pageCount}</option>
                  <option value="n-slash-total">1 / {initialFile.pageCount}</option>
                  <option value="page-n">Page 1</option>
                  <option value="n">1 (Number only)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Position</label>
                <select
                  value={pnPosition}
                  onChange={(e) => setPnPosition(e.target.value as any)}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-xs outline-none"
                >
                  <option value="bottom-center">Bottom Center</option>
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-center">Top Center</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Start At Number
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={pnStartNum}
                    onChange={(e) => setPnStartNum(parseInt(e.target.value, 10) || 1)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Font Size ({pnFontSize}pt)
                  </label>
                  <input
                    type="number"
                    min="8"
                    max="24"
                    value={pnFontSize}
                    onChange={(e) => setPnFontSize(parseInt(e.target.value, 10) || 10)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Live Visual Preview Column */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-3 text-xs text-neutral-500">
            <Eye className="w-3.5 h-3.5" />
            <span>Interactive Real-time Page 1 Preview</span>
          </div>

          <div
            className="relative border border-neutral-300 rounded-lg shadow-lg overflow-hidden bg-white"
            style={{ width: previewDims.width, height: previewDims.height }}
          >
            <canvas ref={canvasRef} className="block w-full h-full" />

            {/* Overlaid preview watermark */}
            {toolId === 'watermark' && wmType === 'text' && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <span
                  style={{
                    color: wmColor,
                    opacity: wmOpacity,
                    fontSize: `${wmFontSize * 0.9}px`,
                    fontWeight: 'bold',
                    transform: `rotate(${wmRotation}deg)`,
                    userSelect: 'none',
                    letterSpacing: '0.05em',
                  }}
                >
                  {wmText}
                </span>
              </div>
            )}

            {/* Overlaid preview page number */}
            {toolId === 'page-numbers' && (
              <div
                style={{
                  position: 'absolute',
                  left: pnPosition.includes('center')
                    ? '50%'
                    : pnPosition.includes('left')
                    ? '24px'
                    : undefined,
                  right: pnPosition.includes('right') ? '24px' : undefined,
                  bottom: pnPosition.includes('bottom') ? '16px' : undefined,
                  top: pnPosition.includes('top') ? '16px' : undefined,
                  transform: pnPosition.includes('center') ? 'translateX(-50%)' : undefined,
                }}
                className="pointer-events-none text-neutral-700 font-sans"
              >
                <span style={{ fontSize: `${pnFontSize}px` }}>
                  {pnFormat === 'page-n-of-total'
                    ? `Page 1 of ${initialFile.pageCount}`
                    : pnFormat === 'n-slash-total'
                    ? `1 / ${initialFile.pageCount}`
                    : '1'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
