import React, { useRef, useState, useEffect } from 'react';
import { X, Eraser, Check, Upload, PenTool, Type as TypeIcon } from 'lucide-react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSignature: (dataUrl: string) => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  onClose,
  onSaveSignature,
}) => {
  const [tab, setTab] = useState<'draw' | 'type' | 'upload'>('draw');
  const [typedName, setTypedName] = useState('');
  const [fontFamily, setFontFamily] = useState<'cursive' | 'serif' | 'italic'>('cursive');
  const [penColor, setPenColor] = useState('#0f172a'); // slate-900

  // Drawing canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (isOpen && tab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set high DPI scale
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 2;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = penColor;
      ctx.lineWidth = 2.5;
    }
  }, [isOpen, tab, penColor]);

  if (!isOpen) return null;

  // Drawing mouse/touch handlers
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawingRef.current = true;
    setHasDrawn(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.strokeStyle = penColor;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSave = () => {
    if (tab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      onSaveSignature(canvas.toDataURL('image/png'));
      onClose();
    } else if (tab === 'type') {
      if (!typedName.trim()) return;
      const offscreen = document.createElement('canvas');
      offscreen.width = 600;
      offscreen.height = 200;
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = penColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      let fontSpec = "italic 52px 'Brush Script MT', 'Caveat', cursive";
      if (fontFamily === 'serif') {
        fontSpec = "italic 44px 'Georgia', serif";
      } else if (fontFamily === 'italic') {
        fontSpec = "italic 46px 'Plus Jakarta Sans', sans-serif";
      }

      ctx.font = fontSpec;
      ctx.fillText(typedName, 300, 100);
      onSaveSignature(offscreen.toDataURL('image/png'));
      onClose();
    }
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          onSaveSignature(evt.target.result as string);
          onClose();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-neutral-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PenTool className="w-4 h-4 text-neutral-800" />
            <h3 className="text-base font-semibold text-neutral-900">Create Signature</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab buttons */}
        <div className="flex border-b border-neutral-100 px-4 pt-2 gap-4 text-xs font-medium">
          <button
            onClick={() => setTab('draw')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors ${
              tab === 'draw'
                ? 'border-neutral-900 text-neutral-900 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Draw</span>
          </button>
          <button
            onClick={() => setTab('type')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors ${
              tab === 'type'
                ? 'border-neutral-900 text-neutral-900 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <TypeIcon className="w-3.5 h-3.5" />
            <span>Type</span>
          </button>
          <button
            onClick={() => setTab('upload')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition-colors ${
              tab === 'upload'
                ? 'border-neutral-900 text-neutral-900 font-semibold'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 flex-1">
          {/* Color selector */}
          {tab !== 'upload' && (
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="text-neutral-500 font-medium">Ink Color:</span>
              <div className="flex items-center gap-2">
                {[
                  { color: '#0f172a', label: 'Black' },
                  { color: '#1d4ed8', label: 'Blue' },
                  { color: '#b91c1c', label: 'Red' },
                ].map((item) => (
                  <button
                    key={item.color}
                    onClick={() => setPenColor(item.color)}
                    style={{ backgroundColor: item.color }}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${
                      penColor === item.color
                        ? 'border-neutral-900 scale-110 shadow-xs'
                        : 'border-transparent hover:scale-105'
                    }`}
                    title={item.label}
                  />
                ))}
              </div>
            </div>
          )}

          {tab === 'draw' && (
            <div>
              <div className="relative border-2 border-dashed border-neutral-200 rounded-xl bg-neutral-50/50 h-52 touch-none overflow-hidden">
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-full cursor-crosshair"
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-neutral-400 text-xs">
                    <PenTool className="w-6 h-6 mb-1 opacity-50" />
                    <span>Sign your name here with mouse or finger</span>
                  </div>
                )}
                {/* Subtle baseline */}
                <div className="absolute bottom-10 left-8 right-8 border-b border-neutral-300 pointer-events-none" />
              </div>

              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="text-xs text-neutral-500 hover:text-neutral-900 flex items-center gap-1 font-medium"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          )}

          {tab === 'type' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">
                  Type your name:
                </label>
                <input
                  type="text"
                  value={typedName}
                  onChange={(e) => setTypedName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-3.5 py-2 border border-neutral-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-2">
                  Signature Style:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'cursive', label: 'Script', style: "font-serif italic" },
                    { id: 'serif', label: 'Classic Serif', style: "font-serif" },
                    { id: 'italic', label: 'Modern Italic', style: "italic" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFontFamily(f.id as any)}
                      className={`p-3 border rounded-xl text-center text-sm transition-all ${
                        fontFamily === f.id
                          ? 'border-neutral-900 bg-neutral-50 font-bold'
                          : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <span className={f.style}>{typedName || 'Signature'}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 border rounded-xl bg-neutral-50 flex items-center justify-center min-h-[90px]">
                <span
                  style={{ color: penColor }}
                  className={`text-3xl ${
                    fontFamily === 'cursive'
                      ? 'italic font-serif'
                      : fontFamily === 'serif'
                      ? 'font-serif'
                      : 'italic'
                  }`}
                >
                  {typedName || 'Your Signature'}
                </span>
              </div>
            </div>
          )}

          {tab === 'upload' && (
            <div className="text-center py-8">
              <label className="cursor-pointer border-2 border-dashed border-neutral-300 hover:border-neutral-400 rounded-xl p-8 flex flex-col items-center justify-center transition-colors">
                <Upload className="w-8 h-8 text-neutral-400 mb-2" />
                <span className="text-sm font-semibold text-neutral-800 mb-1">
                  Upload an image of your signature
                </span>
                <span className="text-xs text-neutral-500 mb-4">
                  PNG with transparent background or JPG
                </span>
                <span className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-xs font-medium">
                  Browse Device
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="hidden"
                  onChange={handleUploadImage}
                />
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        {tab !== 'upload' && (
          <div className="p-4 border-t border-neutral-100 flex items-center justify-end gap-2 bg-neutral-50/50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 rounded-lg hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={tab === 'draw' ? !hasDrawn : !typedName.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-300 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Insert Signature</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
