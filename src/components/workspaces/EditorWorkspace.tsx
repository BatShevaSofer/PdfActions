import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Undo2,
  Redo2,
  Type,
  Square,
  Circle,
  Highlighter,
  PenTool,
  Image as ImageIcon,
  Eraser,
  CheckSquare,
  Calendar,
  MessageSquare,
  Move,
  Trash2,
  RotateCw,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { AnyAnnotation, EditorTool, PdfFileItem, TextAnnotation } from '../../types/pdf';
import { renderPdfPage, renderPageThumbnail } from '../../lib/pdfjsRenderer';
import { applyAnnotationsAndEdits, downloadFile } from '../../lib/pdfEngine';
import { SignatureModal } from './SignatureModal';

interface EditorWorkspaceProps {
  initialFile: PdfFileItem;
  onBack: () => void;
  defaultTool?: EditorTool;
}

export const EditorWorkspace: React.FC<EditorWorkspaceProps> = ({
  initialFile,
  onBack,
  defaultTool = 'text',
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = initialFile.pageCount;

  // Viewport / Zoom
  const [scale, setScale] = useState(1.25);
  const [pageThumbnails, setPageThumbnails] = useState<string[]>([]);
  const [pageSize, setPageSize] = useState({ width: 595, height: 842 });

  // Tool Selection
  const [activeTool, setActiveTool] = useState<EditorTool>(defaultTool);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  // Annotations stored per page (0-based page index)
  const [annotations, setAnnotations] = useState<Record<number, AnyAnnotation[]>>({});
  const [history, setHistory] = useState<Record<number, AnyAnnotation[]>[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Tool Configuration
  const [textColor, setTextColor] = useState('#0f172a');
  const [fontSize, setFontSize] = useState(14);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [isRtl, setIsRtl] = useState(false);

  const [strokeColor, setStrokeColor] = useState('#2563eb');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [highlightColor, setHighlightColor] = useState('#fef08a'); // soft yellow

  // Modals & Exporting
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRenderingPage, setIsRenderingPage] = useState(false);

  // Canvas and Interaction Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const isInteractingRef = useRef(false);
  const interactionStartRef = useRef<{ x: number; y: number } | null>(null);
  const currentDrawingPointsRef = useRef<{ x: number; y: number }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save history state
  const pushHistory = (newAnnotations: Record<number, AnyAnnotation[]>) => {
    const updatedHistory = history.slice(0, historyIndex + 1);
    updatedHistory.push(JSON.parse(JSON.stringify(newAnnotations)));
    setHistory(updatedHistory);
    setHistoryIndex(updatedHistory.length - 1);
    setAnnotations(newAnnotations);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setAnnotations(JSON.parse(JSON.stringify(history[historyIndex - 1])));
      setSelectedAnnotationId(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setAnnotations(JSON.parse(JSON.stringify(history[historyIndex + 1])));
      setSelectedAnnotationId(null);
    }
  };

  // Load Page Thumbnails on Mount
  useEffect(() => {
    let cancelled = false;
    async function loadThumbs() {
      const thumbs: string[] = [];
      for (let p = 1; p <= totalPages; p++) {
        if (cancelled) return;
        try {
          const t = await renderPageThumbnail(initialFile.data, p, 160);
          thumbs.push(t);
        } catch {
          thumbs.push('');
        }
      }
      if (!cancelled) setPageThumbnails(thumbs);
    }
    loadThumbs();
    return () => {
      cancelled = true;
    };
  }, [initialFile, totalPages]);

  // Render PDF Page to Canvas whenever page or zoom changes
  useEffect(() => {
    let cancelled = false;
    async function drawPage() {
      if (!canvasRef.current) return;
      setIsRenderingPage(true);
      try {
        const dims = await renderPdfPage(
          initialFile.data,
          currentPage,
          canvasRef.current,
          scale
        );
        if (!cancelled) {
          setPageSize({
            width: dims.width / scale,
            height: dims.height / scale,
          });
        }
      } catch (err) {
        console.error('Error rendering page:', err);
      } finally {
        if (!cancelled) setIsRenderingPage(false);
      }
    }
    drawPage();
    return () => {
      cancelled = true;
    };
  }, [initialFile, currentPage, scale]);

  // Point conversion helper: screen clientX/Y to PDF points (1 pt = 1/72 inch)
  const getPdfCoordinates = (e: React.MouseEvent) => {
    if (!overlayRef.current) return { x: 0, y: 0 };
    const rect = overlayRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    return {
      x: clientX / scale,
      y: clientY / scale,
    };
  };

  // Mouse Handlers on PDF Page Overlay
  const handleOverlayMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
    const coords = getPdfCoordinates(e);
    isInteractingRef.current = true;
    interactionStartRef.current = coords;

    const pageIdx = currentPage - 1;
    const currentList = annotations[pageIdx] || [];

    if (activeTool === 'text') {
      // Place new text box
      const id = `text-${Date.now()}`;
      const newText: TextAnnotation = {
        id,
        pageIndex: pageIdx,
        type: 'text',
        x: coords.x,
        y: coords.y,
        text: 'Type text here...',
        fontSize,
        color: textColor,
        bold: isBold,
        italic: isItalic,
        underline: isUnderline,
        align: textAlign,
        isRtl,
      };
      const updated = { ...annotations, [pageIdx]: [...currentList, newText] };
      pushHistory(updated);
      setSelectedAnnotationId(id);
      setActiveTool('select');
      isInteractingRef.current = false;
    } else if (activeTool === 'whiteout') {
      // Start drawing whiteout box
      const id = `whiteout-${Date.now()}`;
      const newWhiteout: AnyAnnotation = {
        id,
        pageIndex: pageIdx,
        type: 'whiteout',
        x: coords.x,
        y: coords.y,
        width: 10,
        height: 10,
      };
      const updated = { ...annotations, [pageIdx]: [...currentList, newWhiteout] };
      pushHistory(updated);
      setSelectedAnnotationId(id);
    } else if (activeTool === 'draw' || activeTool === 'highlighter') {
      currentDrawingPointsRef.current = [coords];
      const id = `drawing-${Date.now()}`;
      const isHigh = activeTool === 'highlighter';
      const newDrawing: AnyAnnotation = {
        id,
        pageIndex: pageIdx,
        type: 'drawing',
        points: [coords],
        color: isHigh ? highlightColor : strokeColor,
        strokeWidth: isHigh ? 16 : strokeWidth,
        opacity: isHigh ? 0.35 : 1,
        isHighlighter: isHigh,
        x: coords.x,
        y: coords.y,
      };
      const updated = { ...annotations, [pageIdx]: [...currentList, newDrawing] };
      setAnnotations(updated);
      setSelectedAnnotationId(id);
    } else if (activeTool === 'rect' || activeTool === 'circle' || activeTool === 'line') {
      const id = `shape-${Date.now()}`;
      const newShape: AnyAnnotation = {
        id,
        pageIndex: pageIdx,
        type: 'shape',
        shapeType: activeTool,
        x: coords.x,
        y: coords.y,
        width: 10,
        height: 10,
        strokeColor,
        strokeWidth,
        opacity: 1,
      };
      const updated = { ...annotations, [pageIdx]: [...currentList, newShape] };
      pushHistory(updated);
      setSelectedAnnotationId(id);
    } else if (activeTool === 'form-text' || activeTool === 'form-check' || activeTool === 'form-date') {
      const id = `form-${Date.now()}`;
      const fieldType =
        activeTool === 'form-check'
          ? 'checkbox'
          : activeTool === 'form-date'
          ? 'date'
          : 'text';

      const newField: AnyAnnotation = {
        id,
        pageIndex: pageIdx,
        type: 'form-field',
        fieldType,
        label: fieldType === 'checkbox' ? '' : 'Field',
        value: fieldType === 'checkbox' ? false : '',
        x: coords.x,
        y: coords.y,
        width: fieldType === 'checkbox' ? 18 : 140,
        height: fieldType === 'checkbox' ? 18 : 28,
      };
      const updated = { ...annotations, [pageIdx]: [...currentList, newField] };
      pushHistory(updated);
      setSelectedAnnotationId(id);
      setActiveTool('select');
      isInteractingRef.current = false;
    } else if (activeTool === 'sticky') {
      const id = `sticky-${Date.now()}`;
      const newSticky: AnyAnnotation = {
        id,
        pageIndex: pageIdx,
        type: 'sticky',
        text: 'Add note here...',
        color: '#fef08a',
        x: coords.x,
        y: coords.y,
        width: 120,
        height: 90,
      };
      const updated = { ...annotations, [pageIdx]: [...currentList, newSticky] };
      pushHistory(updated);
      setSelectedAnnotationId(id);
      setActiveTool('select');
      isInteractingRef.current = false;
    }
  };

  const handleOverlayMouseMove = (e: React.MouseEvent) => {
    if (!isInteractingRef.current) return;
    const coords = getPdfCoordinates(e);
    const start = interactionStartRef.current;
    if (!start) return;

    const pageIdx = currentPage - 1;
    const currentList = annotations[pageIdx] || [];
    if (!selectedAnnotationId) return;

    if (activeTool === 'draw' || activeTool === 'highlighter') {
      currentDrawingPointsRef.current.push(coords);
      setAnnotations((prev) => {
        const list = prev[pageIdx] || [];
        return {
          ...prev,
          [pageIdx]: list.map((ann) =>
            ann.id === selectedAnnotationId && ann.type === 'drawing'
              ? { ...ann, points: [...currentDrawingPointsRef.current] }
              : ann
          ),
        };
      });
    } else if (activeTool === 'whiteout' || activeTool === 'rect' || activeTool === 'circle' || activeTool === 'line') {
      const width = coords.x - start.x;
      const height = coords.y - start.y;

      setAnnotations((prev) => {
        const list = prev[pageIdx] || [];
        return {
          ...prev,
          [pageIdx]: list.map((ann) => {
            if (ann.id !== selectedAnnotationId) return ann;
            if (ann.type === 'whiteout' || ann.type === 'shape') {
              return {
                ...ann,
                x: width >= 0 ? start.x : coords.x,
                y: height >= 0 ? start.y : coords.y,
                width: Math.abs(width),
                height: Math.abs(height),
              };
            }
            return ann;
          }),
        };
      });
    }
  };

  const handleOverlayMouseUp = () => {
    if (isInteractingRef.current) {
      isInteractingRef.current = false;
      pushHistory(annotations);
      if (activeTool !== 'draw' && activeTool !== 'highlighter') {
        setActiveTool('select');
      }
    }
  };

  // Delete active annotation
  const handleDeleteSelected = () => {
    if (!selectedAnnotationId) return;
    const pageIdx = currentPage - 1;
    const currentList = annotations[pageIdx] || [];
    const updated = {
      ...annotations,
      [pageIdx]: currentList.filter((a) => a.id !== selectedAnnotationId),
    };
    pushHistory(updated);
    setSelectedAnnotationId(null);
  };

  // Add Image Handler
  const handleImageUploaded = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          const pageIdx = currentPage - 1;
          const currentList = annotations[pageIdx] || [];
          const id = `image-${Date.now()}`;
          const newImg: AnyAnnotation = {
            id,
            pageIndex: pageIdx,
            type: 'image',
            dataUrl: evt.target.result as string,
            x: 100,
            y: 100,
            width: 150,
            height: 150,
            rotation: 0,
          };
          pushHistory({ ...annotations, [pageIdx]: [...currentList, newImg] });
          setSelectedAnnotationId(id);
          setActiveTool('select');
        }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  // Signature Added Handler
  const handleSignatureInserted = (dataUrl: string) => {
    const pageIdx = currentPage - 1;
    const currentList = annotations[pageIdx] || [];
    const id = `sig-${Date.now()}`;
    const newSig: AnyAnnotation = {
      id,
      pageIndex: pageIdx,
      type: 'signature',
      dataUrl,
      x: 120,
      y: 200,
      width: 180,
      height: 70,
    };
    pushHistory({ ...annotations, [pageIdx]: [...currentList, newSig] });
    setSelectedAnnotationId(id);
    setActiveTool('select');
  };

  // Export to modified PDF file
  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const modifiedBytes = await applyAnnotationsAndEdits(
        initialFile.data,
        annotations
      );
      downloadFile(
        modifiedBytes,
        `${initialFile.name.replace('.pdf', '')}_edited.pdf`
      );
    } catch (err: any) {
      console.error('Export error', err);
      alert(`Export failed: ${err.message || 'Please check your inputs'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const currentAnnotationList = annotations[currentPage - 1] || [];
  const selectedAnnotation = currentAnnotationList.find(
    (a) => a.id === selectedAnnotationId
  );

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-neutral-100 overflow-hidden select-none">
      {/* Top Application Toolbar */}
      <div className="bg-white border-b border-neutral-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-xs z-30">
        {/* Left: Back & Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-neutral-900 truncate max-w-[140px] sm:max-w-[200px]">
            {initialFile.name}
          </span>
          <div className="hidden sm:flex items-center gap-1 text-xs text-neutral-500 bg-neutral-100 px-2 py-1 rounded-md">
            <span>Page {currentPage} of {totalPages}</span>
          </div>
        </div>

        {/* Center: Tools selector */}
        <div className="flex items-center gap-1 bg-neutral-100/90 p-1 rounded-xl">
          <button
            title="Select & Move Tool (V)"
            onClick={() => setActiveTool('select')}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTool === 'select'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Move className="w-4 h-4" />
          </button>

          <button
            title="Add Text Tool (T)"
            onClick={() => setActiveTool('text')}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTool === 'text'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Type className="w-4 h-4" />
          </button>

          <button
            title="Whiteout / Redact Tool (Blank out existing text)"
            onClick={() => setActiveTool('whiteout')}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTool === 'whiteout'
                ? 'bg-white text-rose-600 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Eraser className="w-4 h-4" />
          </button>

          <button
            title="Pen / Freehand Draw"
            onClick={() => setActiveTool('draw')}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTool === 'draw'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <PenTool className="w-4 h-4" />
          </button>

          <button
            title="Highlighter"
            onClick={() => setActiveTool('highlighter')}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTool === 'highlighter'
                ? 'bg-white text-amber-600 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Highlighter className="w-4 h-4" />
          </button>

          <button
            title="Rectangle Shape"
            onClick={() => setActiveTool('rect')}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTool === 'rect'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Square className="w-4 h-4" />
          </button>

          <button
            title="Circle Shape"
            onClick={() => setActiveTool('circle')}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTool === 'circle'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Circle className="w-4 h-4" />
          </button>

          <button
            title="Add Signature"
            onClick={() => setIsSignatureModalOpen(true)}
            className="p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 transition-colors"
          >
            <span className="text-xs font-semibold px-1">Sign</span>
          </button>

          <label
            title="Insert Image"
            className="cursor-pointer p-1.5 rounded-lg text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60 transition-colors"
          >
            <ImageIcon className="w-4 h-4" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleImageUploaded}
            />
          </label>

          <button
            title="Add Checkbox"
            onClick={() => setActiveTool('form-check')}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTool === 'form-check'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
          </button>

          <button
            title="Add Sticky Note"
            onClick={() => setActiveTool('sticky')}
            className={`p-1.5 rounded-lg transition-colors ${
              activeTool === 'sticky'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
          </button>
        </div>

        {/* Right: History & Actions */}
        <div className="flex items-center gap-2">
          <button
            title="Undo (Ctrl+Z)"
            disabled={historyIndex <= 0}
            onClick={handleUndo}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 disabled:opacity-30 rounded-lg hover:bg-neutral-100"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            title="Redo (Ctrl+Y)"
            disabled={historyIndex >= history.length - 1}
            onClick={handleRedo}
            className="p-1.5 text-neutral-600 hover:text-neutral-900 disabled:opacity-30 rounded-lg hover:bg-neutral-100"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          {selectedAnnotationId && (
            <button
              title="Delete Selected Item"
              onClick={handleDeleteSelected}
              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleExportPdf}
            disabled={isExporting}
            className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Save PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sub-toolbar for Active Tool Customization (Font size, colors, RTL Hebrew toggle, etc.) */}
      <div className="bg-neutral-50 border-b border-neutral-200 px-4 py-1.5 flex flex-wrap items-center gap-4 text-xs shrink-0">
        {(activeTool === 'text' || (selectedAnnotation && selectedAnnotation.type === 'text')) && (
          <div className="flex items-center gap-3">
            <span className="text-neutral-500 font-medium">Text Style:</span>
            <div className="flex items-center gap-1 bg-white border border-neutral-200 rounded-md px-1.5 py-0.5">
              <span className="text-[11px] text-neutral-400">Size</span>
              <input
                type="number"
                min={8}
                max={72}
                value={fontSize}
                onChange={(e) => {
                  const sz = parseInt(e.target.value, 10) || 14;
                  setFontSize(sz);
                  if (selectedAnnotationId) {
                    setAnnotations((prev) => {
                      const list = prev[currentPage - 1] || [];
                      return {
                        ...prev,
                        [currentPage - 1]: list.map((a) =>
                          a.id === selectedAnnotationId && a.type === 'text'
                            ? { ...a, fontSize: sz }
                            : a
                        ),
                      };
                    });
                  }
                }}
                className="w-10 text-center font-mono outline-none text-neutral-900 text-xs"
              />
            </div>

            <div className="flex items-center gap-0.5 border border-neutral-200 rounded-md bg-white p-0.5">
              <button
                onClick={() => setIsBold(!isBold)}
                className={`p-1 rounded ${isBold ? 'bg-neutral-200 font-bold' : 'hover:bg-neutral-100'}`}
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsItalic(!isItalic)}
                className={`p-1 rounded ${isItalic ? 'bg-neutral-200' : 'hover:bg-neutral-100'}`}
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsUnderline(!isUnderline)}
                className={`p-1 rounded ${isUnderline ? 'bg-neutral-200' : 'hover:bg-neutral-100'}`}
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* RTL Hebrew Support Toggle */}
            <button
              onClick={() => {
                const nextRtl = !isRtl;
                setIsRtl(nextRtl);
                if (selectedAnnotationId) {
                  setAnnotations((prev) => {
                    const list = prev[currentPage - 1] || [];
                    return {
                      ...prev,
                      [currentPage - 1]: list.map((a) =>
                        a.id === selectedAnnotationId && a.type === 'text'
                          ? { ...a, isRtl: nextRtl, align: nextRtl ? 'right' : 'left' }
                          : a
                      ),
                    };
                  });
                }
              }}
              className={`px-2 py-1 rounded text-xs font-semibold border transition-colors ${
                isRtl
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-100'
              }`}
              title="Toggle Right-to-Left (Hebrew & Arabic support)"
            >
              RTL (עברית)
            </button>

            {/* Text Color Picker */}
            <div className="flex items-center gap-1.5">
              {['#000000', '#2563eb', '#dc2626', '#16a34a', '#7c3aed'].map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setTextColor(c);
                    if (selectedAnnotationId) {
                      setAnnotations((prev) => {
                        const list = prev[currentPage - 1] || [];
                        return {
                          ...prev,
                          [currentPage - 1]: list.map((a) =>
                            a.id === selectedAnnotationId && a.type === 'text'
                              ? { ...a, color: c }
                              : a
                          ),
                        };
                      });
                    }
                  }}
                  style={{ backgroundColor: c }}
                  className={`w-4 h-4 rounded-full border ${textColor === c ? 'ring-2 ring-neutral-900 scale-110' : ''}`}
                />
              ))}
            </div>
          </div>
        )}

        {(activeTool === 'draw' || activeTool === 'rect' || activeTool === 'circle') && (
          <div className="flex items-center gap-3">
            <span className="text-neutral-500 font-medium">Color:</span>
            <div className="flex items-center gap-1.5">
              {['#ef4444', '#3b82f6', '#10b981', '#000000', '#f59e0b'].map((c) => (
                <button
                  key={c}
                  onClick={() => setStrokeColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-4 h-4 rounded-full border ${strokeColor === c ? 'ring-2 ring-neutral-900 scale-110' : ''}`}
                />
              ))}
            </div>

            <span className="text-neutral-500 font-medium ml-2">Stroke:</span>
            {[2, 4, 8].map((w) => (
              <button
                key={w}
                onClick={() => setStrokeWidth(w)}
                className={`px-2 py-0.5 rounded border text-xs ${
                  strokeWidth === w ? 'bg-neutral-900 text-white' : 'bg-white'
                }`}
              >
                {w}px
              </button>
            ))}
          </div>
        )}

        {activeTool === 'whiteout' && (
          <div className="flex items-center gap-2 text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
            <Eraser className="w-3.5 h-3.5" />
            <span>Whiteout Mode: Drag a rectangle over any existing text to blank it out.</span>
          </div>
        )}

        {/* Zoom controls on right */}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
            className="p-1 hover:bg-neutral-200 rounded"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="font-mono text-[11px] w-12 text-center text-neutral-600">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
            className="p-1 hover:bg-neutral-200 rounded"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setScale(1.0)}
            className="px-1.5 py-0.5 bg-white border rounded text-[11px] hover:bg-neutral-100"
            title="Reset Zoom"
          >
            100%
          </button>
        </div>
      </div>

      {/* Main Workspace Body: Thumbnail sidebar + Interactive canvas center */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Thumbnails Sidebar */}
        <div className="w-44 bg-white border-r border-neutral-200 overflow-y-auto p-3 flex flex-col gap-3 shrink-0 hidden md:flex">
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider mb-1">
            Pages ({totalPages})
          </div>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
            const thumb = pageThumbnails[p - 1];
            return (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`relative rounded-xl border p-2 text-left transition-all ${
                  currentPage === p
                    ? 'border-neutral-900 ring-2 ring-neutral-900 bg-neutral-50 shadow-xs'
                    : 'border-neutral-200 hover:border-neutral-300 bg-white'
                }`}
              >
                <div className="aspect-[3/4] bg-neutral-100 rounded overflow-hidden flex items-center justify-center mb-1.5">
                  {thumb ? (
                    <img src={thumb} alt={`Page ${p}`} className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-neutral-400">Page {p}</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-neutral-600">
                  <span className="font-medium">Page {p}</span>
                  {(annotations[p - 1] || []).length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-blue-600" title="Has edits" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Center: Canvas Viewer & Interactive SVG/HTML Overlay */}
        <div className="flex-1 overflow-auto p-6 flex flex-col items-center justify-start bg-neutral-200/50">
          <div
            className="relative shadow-xl rounded-sm bg-white border border-neutral-300"
            style={{
              width: pageSize.width * scale,
              height: pageSize.height * scale,
            }}
          >
            {/* The Underlying PDF Rendered Canvas */}
            <canvas ref={canvasRef} className="absolute inset-0 block w-full h-full" />

            {/* Interactive Overlay Layer */}
            <div
              ref={overlayRef}
              onMouseDown={handleOverlayMouseDown}
              onMouseMove={handleOverlayMouseMove}
              onMouseUp={handleOverlayMouseUp}
              className={`absolute inset-0 ${
                activeTool === 'select'
                  ? 'cursor-default'
                  : activeTool === 'text'
                  ? 'cursor-text'
                  : activeTool === 'whiteout'
                  ? 'cursor-crosshair'
                  : 'cursor-crosshair'
              }`}
            >
              {/* Render Existing Annotations on this page */}
              {currentAnnotationList.map((ann) => {
                const isSelected = ann.id === selectedAnnotationId;
                const left = ann.x * scale;
                const top = ann.y * scale;

                if (ann.type === 'whiteout') {
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                      }}
                      style={{
                        position: 'absolute',
                        left,
                        top,
                        width: ann.width * scale,
                        height: ann.height * scale,
                        backgroundColor: '#ffffff',
                      }}
                      className={`border ${
                        isSelected ? 'border-dashed border-red-500 ring-2 ring-red-400' : 'border-neutral-200'
                      }`}
                    />
                  );
                }

                if (ann.type === 'text') {
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                      }}
                      style={{
                        position: 'absolute',
                        left,
                        top,
                        fontSize: ann.fontSize * scale,
                        color: ann.color,
                        fontWeight: ann.bold ? 'bold' : 'normal',
                        fontStyle: ann.italic ? 'italic' : 'normal',
                        textDecoration: ann.underline ? 'underline' : 'none',
                        direction: ann.isRtl ? 'rtl' : 'ltr',
                        textAlign: ann.align,
                      }}
                      className={`min-w-[40px] px-1 py-0.5 rounded cursor-move transition-shadow ${
                        isSelected
                          ? 'ring-2 ring-neutral-900 bg-white/70 shadow-xs'
                          : 'hover:ring-1 hover:ring-neutral-400'
                      }`}
                    >
                      <input
                        type="text"
                        value={ann.text}
                        dir={ann.isRtl ? 'rtl' : 'ltr'}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAnnotations((prev) => {
                            const list = prev[currentPage - 1] || [];
                            return {
                              ...prev,
                              [currentPage - 1]: list.map((a) =>
                                a.id === ann.id && a.type === 'text' ? { ...a, text: val } : a
                              ),
                            };
                          });
                        }}
                        className="bg-transparent outline-none w-full border-none p-0"
                      />
                    </div>
                  );
                }

                if (ann.type === 'drawing') {
                  const points = ann.points || [];
                  if (points.length < 2) return null;
                  const pathData = points
                    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x * scale} ${pt.y * scale}`)
                    .join(' ');

                  return (
                    <svg
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                      }}
                      className="absolute inset-0 pointer-events-none"
                    >
                      <path
                        d={pathData}
                        fill="none"
                        stroke={ann.color}
                        strokeWidth={ann.strokeWidth * scale}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={ann.opacity}
                      />
                    </svg>
                  );
                }

                if (ann.type === 'shape') {
                  const width = ann.width * scale;
                  const height = ann.height * scale;

                  if (ann.shapeType === 'rect') {
                    return (
                      <div
                        key={ann.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnnotationId(ann.id);
                        }}
                        style={{
                          position: 'absolute',
                          left,
                          top,
                          width,
                          height,
                          borderColor: ann.strokeColor,
                          borderWidth: ann.strokeWidth * scale,
                        }}
                        className={`rounded-xs ${isSelected ? 'ring-2 ring-neutral-900' : ''}`}
                      />
                    );
                  }

                  if (ann.shapeType === 'circle') {
                    return (
                      <div
                        key={ann.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnnotationId(ann.id);
                        }}
                        style={{
                          position: 'absolute',
                          left,
                          top,
                          width,
                          height,
                          borderColor: ann.strokeColor,
                          borderWidth: ann.strokeWidth * scale,
                          borderRadius: '50%',
                        }}
                        className={`${isSelected ? 'ring-2 ring-neutral-900' : ''}`}
                      />
                    );
                  }
                }

                if (ann.type === 'signature' || ann.type === 'image') {
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                      }}
                      style={{
                        position: 'absolute',
                        left,
                        top,
                        width: ann.width * scale,
                        height: ann.height * scale,
                      }}
                      className={`cursor-move p-0.5 rounded ${
                        isSelected ? 'ring-2 ring-neutral-900 shadow-md' : 'hover:ring-1 hover:ring-neutral-400'
                      }`}
                    >
                      <img
                        src={ann.dataUrl}
                        alt="Signature/Stamp"
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    </div>
                  );
                }

                if (ann.type === 'form-field') {
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                      }}
                      style={{
                        position: 'absolute',
                        left,
                        top,
                        width: ann.width * scale,
                        height: ann.height * scale,
                      }}
                      className={`flex items-center bg-blue-50/70 border border-blue-400 rounded px-1.5 ${
                        isSelected ? 'ring-2 ring-neutral-900' : ''
                      }`}
                    >
                      {ann.fieldType === 'checkbox' ? (
                        <input
                          type="checkbox"
                          checked={Boolean(ann.value)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setAnnotations((prev) => {
                              const list = prev[currentPage - 1] || [];
                              return {
                                ...prev,
                                [currentPage - 1]: list.map((a) =>
                                  a.id === ann.id && a.type === 'form-field'
                                    ? { ...a, value: checked }
                                    : a
                                ),
                              };
                            });
                          }}
                          className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                        />
                      ) : (
                        <input
                          type={ann.fieldType === 'date' ? 'date' : 'text'}
                          value={String(ann.value)}
                          placeholder="Form input..."
                          onChange={(e) => {
                            const val = e.target.value;
                            setAnnotations((prev) => {
                              const list = prev[currentPage - 1] || [];
                              return {
                                ...prev,
                                [currentPage - 1]: list.map((a) =>
                                  a.id === ann.id && a.type === 'form-field'
                                    ? { ...a, value: val }
                                    : a
                                ),
                              };
                            });
                          }}
                          className="w-full bg-transparent outline-none text-xs text-neutral-900 font-sans"
                        />
                      )}
                    </div>
                  );
                }

                if (ann.type === 'sticky') {
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnotationId(ann.id);
                      }}
                      style={{
                        position: 'absolute',
                        left,
                        top,
                        width: ann.width * scale,
                        height: ann.height * scale,
                        backgroundColor: ann.color,
                      }}
                      className={`p-2 shadow-md rounded border border-amber-300 flex flex-col ${
                        isSelected ? 'ring-2 ring-neutral-900' : ''
                      }`}
                    >
                      <textarea
                        value={ann.text}
                        onChange={(e) => {
                          const val = e.target.value;
                          setAnnotations((prev) => {
                            const list = prev[currentPage - 1] || [];
                            return {
                              ...prev,
                              [currentPage - 1]: list.map((a) =>
                                a.id === ann.id && a.type === 'sticky' ? { ...a, text: val } : a
                              ),
                            };
                          });
                        }}
                        className="w-full h-full bg-transparent resize-none outline-none text-xs text-neutral-800 font-sans"
                      />
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>

          {/* Floating bottom pagination for mobile / desktop */}
          <div className="sticky bottom-4 mt-6 bg-white/95 backdrop-blur-xs border border-neutral-200 rounded-full px-4 py-1.5 shadow-md flex items-center gap-3 text-xs z-20">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 text-neutral-600 hover:text-neutral-900 disabled:opacity-30 rounded-full"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold text-neutral-800">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 text-neutral-600 hover:text-neutral-900 disabled:opacity-30 rounded-full"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Signature Modal */}
      <SignatureModal
        isOpen={isSignatureModalOpen}
        onClose={() => setIsSignatureModalOpen(false)}
        onSaveSignature={handleSignatureInserted}
      />
    </div>
  );
};
