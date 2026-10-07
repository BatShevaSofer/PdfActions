import React, { useState } from 'react';
import {
  ArrowLeft,
  Download,
  Minimize2,
  Loader2,
  CheckCircle2,
  Percent,
  HardDrive,
  Sparkles,
} from 'lucide-react';
import { PdfFileItem } from '../../types/pdf';
import { compressPdf, downloadFile } from '../../lib/pdfEngine';

interface OptimizeWorkspaceProps {
  initialFile: PdfFileItem;
  onBack: () => void;
}

export const OptimizeWorkspace: React.FC<OptimizeWorkspaceProps> = ({
  initialFile,
  onBack,
}) => {
  const [level, setLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    data: Uint8Array;
    originalSize: number;
    newSize: number;
  } | null>(null);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleCompress = async () => {
    setIsProcessing(true);
    try {
      const compResult = await compressPdf(initialFile.data, level);
      setResult(compResult);
    } catch (err: any) {
      console.error('Compression failed', err);
      alert(`Compression error: ${err.message || 'Failed to compress document'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    downloadFile(result.data, `${initialFile.name.replace('.pdf', '')}_compressed.pdf`);
  };

  const savingsBytes = result ? Math.max(0, result.originalSize - result.newSize) : 0;
  const savingsPct = result
    ? Math.max(0, Math.round(((result.originalSize - result.newSize) / result.originalSize) * 100))
    : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            <h2 className="text-xl font-bold text-neutral-900">Compress PDF</h2>
            <p className="text-xs text-neutral-500">
              {initialFile.name} · {formatBytes(initialFile.size)} · {initialFile.pageCount} pages
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900 mb-1">
            Choose Compression Level
          </h3>
          <p className="text-xs text-neutral-500 mb-4">
            Select how aggressively you want to reduce the PDF size.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                id: 'low',
                title: 'Low Compression',
                desc: 'Maximum document fidelity. Slight file size reduction.',
                savingsEst: '~10 - 25% savings',
              },
              {
                id: 'medium',
                title: 'Medium Compression',
                desc: 'Recommended balance of crisp quality and optimized file size.',
                savingsEst: '~30 - 50% savings',
                popular: true,
              },
              {
                id: 'high',
                title: 'High Compression',
                desc: 'Maximum size reduction. Strips non-essential streams & metadata.',
                savingsEst: '~50 - 75% savings',
              },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  setLevel(opt.id as any);
                  setResult(null);
                }}
                className={`relative p-5 border rounded-2xl text-left transition-all ${
                  level === opt.id
                    ? 'border-neutral-900 ring-2 ring-neutral-900 bg-neutral-50/70 shadow-sm'
                    : 'border-neutral-200 hover:border-neutral-300 bg-white'
                }`}
              >
                {opt.popular && (
                  <span className="absolute top-3 right-3 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                    Recommended
                  </span>
                )}
                <div className="text-sm font-bold text-neutral-900 mb-1">{opt.title}</div>
                <div className="text-xs text-neutral-500 mb-3">{opt.desc}</div>
                <div className="text-[11px] font-mono text-emerald-700 font-medium">
                  {opt.savingsEst}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        {!result && (
          <div className="pt-4 flex justify-end">
            <button
              onClick={handleCompress}
              disabled={isProcessing}
              className="px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Optimizing PDF streams...</span>
                </>
              ) : (
                <>
                  <Minimize2 className="w-4 h-4" />
                  <span>Compress PDF</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Compression Result Banner & Statistics */}
        {result && (
          <div className="p-6 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-4">
            <div className="flex items-center gap-2 text-emerald-900 font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>PDF Successfully Optimized!</span>
            </div>

            <div className="grid grid-cols-3 gap-4 p-4 bg-white rounded-xl border border-emerald-100 text-center">
              <div>
                <span className="block text-[11px] text-neutral-400 uppercase tracking-wider mb-1">
                  Original Size
                </span>
                <span className="font-mono text-base font-bold text-neutral-700 tabular-nums">
                  {formatBytes(result.originalSize)}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-neutral-400 uppercase tracking-wider mb-1">
                  Optimized Size
                </span>
                <span className="font-mono text-base font-bold text-emerald-700 tabular-nums">
                  {formatBytes(result.newSize)}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-neutral-400 uppercase tracking-wider mb-1">
                  Space Saved
                </span>
                <span className="font-mono text-base font-bold text-emerald-600 tabular-nums">
                  {savingsPct > 0 ? `-${savingsPct}%` : 'Optimized'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setResult(null)}
                className="text-xs text-neutral-600 hover:text-neutral-900 font-medium"
              >
                Try different level
              </button>

              <button
                onClick={handleDownload}
                className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-semibold rounded-xl flex items-center gap-2 shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download Compressed PDF</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
