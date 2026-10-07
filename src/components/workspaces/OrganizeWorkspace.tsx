import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  RotateCw,
  Trash2,
  Undo2,
  Download,
  Copy,
  ChevronLeft,
  ChevronRight,
  Plus,
  Layers,
  Split as SplitIcon,
  CheckCircle2,
  Loader2,
  FileText,
  LayoutGrid,
  ArrowLeftRight,
} from 'lucide-react';
import JSZip from 'jszip';
import { PageItem, PdfFileItem, ToolId } from '../../types/pdf';
import { renderPageThumbnail } from '../../lib/pdfjsRenderer';
import {
  deletePages,
  downloadFile,
  extractPages,
  mergePdfs,
  parsePageRangeString,
  reorderAndRotatePages,
  splitPdf,
} from '../../lib/pdfEngine';
import { FileDropzone } from '../FileDropzone';

interface OrganizeWorkspaceProps {
  toolId: ToolId;
  initialFiles: PdfFileItem[];
  onBack: () => void;
  onAddMoreFiles: (files: File[]) => void;
  onUseSample: () => void;
}

export const OrganizeWorkspace: React.FC<OrganizeWorkspaceProps> = ({
  toolId,
  initialFiles,
  onBack,
  onAddMoreFiles,
  onUseSample,
}) => {
  const [pages, setPages] = useState<PageItem[]>([]);
  const [isLoadingThumbnails, setIsLoadingThumbnails] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rangeInput, setRangeInput] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Split specific state:
  const [splitMode, setSplitMode] = useState<'all' | 'ranges' | 'extract'>('all');
  const [splitRangesInput, setSplitRangesInput] = useState('1-2, 3');

  // Display grid columns & reading direction (RTL / LTR)
  const [columnsPerRow, setColumnsPerRow] = useState<number | 'auto'>('auto');
  const [isRtlLayout, setIsRtlLayout] = useState<boolean>(true); // Default to Right-to-Left (מימין לשמאל)

  // Load pages and generate thumbnails whenever initialFiles change
  useEffect(() => {
    let isCancelled = false;

    async function loadThumbnails() {
      if (initialFiles.length === 0) {
        setPages([]);
        return;
      }

      setIsLoadingThumbnails(true);
      const newPages: PageItem[] = [];

      for (const file of initialFiles) {
        for (let p = 0; p < file.pageCount; p++) {
          const pageId = `${file.id}-page-${p}`;
          newPages.push({
            id: pageId,
            fileId: file.id,
            fileName: file.name,
            originalPageIndex: p,
            displayPageNumber: p + 1,
            rotation: 0,
            width: 595,
            height: 842,
            isDeleted: false,
          });
        }
      }

      setPages(newPages);

      // Now progressively render thumbnails
      for (const file of initialFiles) {
        for (let p = 0; p < file.pageCount; p++) {
          if (isCancelled) return;
          try {
            const thumb = await renderPageThumbnail(file.data, p + 1, 240);
            if (isCancelled) return;
            const pageId = `${file.id}-page-${p}`;
            setPages((prev) =>
              prev.map((pg) => (pg.id === pageId ? { ...pg, thumbnailUrl: thumb } : pg))
            );
          } catch (e) {
            console.warn('Thumbnail generation failed for page', p, e);
          }
        }
      }

      if (!isCancelled) {
        setIsLoadingThumbnails(false);
      }
    }

    loadThumbnails();

    return () => {
      isCancelled = true;
    };
  }, [initialFiles]);

  // Page manipulation actions
  const handleRotatePage = (index: number) => {
    setPages((prev) => {
      const next = [...prev];
      const cur = next[index];
      next[index] = {
        ...cur,
        rotation: (cur.rotation + 90) % 360,
      };
      return next;
    });
  };

  const handleRotateAll = (degreesToAdd: number) => {
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        rotation: (p.rotation + degreesToAdd) % 360,
      }))
    );
  };

  const handleToggleDelete = (index: number) => {
    setPages((prev) => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        isDeleted: !next[index].isDeleted,
      };
      return next;
    });
  };

  const handleDuplicatePage = (index: number) => {
    setPages((prev) => {
      const next = [...prev];
      const target = next[index];
      const duplicated: PageItem = {
        ...target,
        id: `${target.id}-dup-${Date.now()}`,
      };
      next.splice(index + 1, 0, duplicated);
      return next;
    });
  };

  const handleMovePage = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= pages.length) return;
    setPages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  // Drag and Drop reordering
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (index: number) => {
    if (draggedIndex !== null && draggedIndex !== index) {
      handleMovePage(draggedIndex, index);
    }
    setDraggedIndex(null);
  };

  // Selection logic
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === pages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pages.map((p) => p.id)));
    }
  };

  // Range input for Delete (e.g. 2, 5, 8-12)
  const applyDeleteRange = () => {
    if (!rangeInput.trim()) return;
    const indicesToDelete = parsePageRangeString(rangeInput, pages.length);
    setPages((prev) =>
      prev.map((p, idx) => ({
        ...p,
        isDeleted: indicesToDelete.has(idx) ? true : p.isDeleted,
      }))
    );
  };

  const undoAllDeletions = () => {
    setPages((prev) => prev.map((p) => ({ ...p, isDeleted: false })));
  };

  // Final Action Execution
  const handleExecuteOperation = async () => {
    if (initialFiles.length === 0) return;
    setIsProcessing(true);

    try {
      if (toolId === 'merge') {
        // Merge all pages in their current display order, skipping deleted pages
        const activePages = pages.filter((p) => !p.isDeleted);
        if (activePages.length === 0) {
          alert('No pages remaining to merge.');
          setIsProcessing(false);
          return;
        }

        // Group active pages by file
        // To preserve arbitrary reordering across files, we can process page by page:
        const fileMap = new Map<string, ArrayBuffer>();
        initialFiles.forEach((f) => fileMap.set(f.id, f.data));

        const mergeQueue = activePages.map((pg) => ({
          data: fileMap.get(pg.fileId)!,
          pageIndices: [pg.originalPageIndex],
          rotations: [pg.rotation],
        }));

        const mergedBytes = await mergePdfs(mergeQueue);
        downloadFile(mergedBytes, 'merged_document.pdf');
      } else if (toolId === 'delete-pages') {
        const firstFile = initialFiles[0];
        // If the user modified the order or rotation in addition to deleting:
        const remainingPages = pages.filter((p) => !p.isDeleted);
        if (remainingPages.length === 0) {
          alert('Cannot delete all pages in the document.');
          setIsProcessing(false);
          return;
        }

        const configs = remainingPages.map((p) => ({
          originalIndex: p.originalPageIndex,
          rotation: p.rotation,
        }));

        const resultBytes = await reorderAndRotatePages(firstFile.data, configs);
        downloadFile(resultBytes, `${firstFile.name.replace('.pdf', '')}_edited.pdf`);
      } else if (toolId === 'reorder' || toolId === 'rotate') {
        const firstFile = initialFiles[0];
        const activePages = pages.filter((p) => !p.isDeleted);
        const configs = activePages.map((p) => ({
          originalIndex: p.originalPageIndex,
          rotation: p.rotation,
        }));
        const resultBytes = await reorderAndRotatePages(firstFile.data, configs);
        downloadFile(
          resultBytes,
          `${firstFile.name.replace('.pdf', '')}_${toolId === 'rotate' ? 'rotated' : 'reordered'}.pdf`
        );
      } else if (toolId === 'extract-pages') {
        const firstFile = initialFiles[0];
        const selectedIndices = pages
          .map((p, idx) => (selectedIds.has(p.id) ? p.originalPageIndex : -1))
          .filter((i) => i !== -1);

        if (selectedIndices.length === 0) {
          alert('Please select at least one page to extract.');
          setIsProcessing(false);
          return;
        }

        const extractedBytes = await extractPages(firstFile.data, selectedIndices);
        downloadFile(extractedBytes, `${firstFile.name.replace('.pdf', '')}_extracted.pdf`);
      } else if (toolId === 'split') {
        const firstFile = initialFiles[0];
        const total = firstFile.pageCount;

        if (splitMode === 'all') {
          // Split every page into individual PDF and package into ZIP
          const zip = new JSZip();
          for (let p = 1; p <= total; p++) {
            const single = await splitPdf(firstFile.data, [
              { start: p, end: p, label: `page_${p}.pdf` },
            ]);
            zip.file(single[0].name, single[0].data);
          }
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          downloadFile(zipBlob, `${firstFile.name.replace('.pdf', '')}_split_pages.zip`, 'application/zip');
        } else if (splitMode === 'ranges') {
          // Parse ranges like "1-3, 4-7"
          const rangeItems = splitRangesInput.split(',').map((item, idx) => {
            const clean = item.trim();
            if (clean.includes('-')) {
              const [s, e] = clean.split('-');
              return {
                start: parseInt(s.trim(), 10) || 1,
                end: parseInt(e.trim(), 10) || 1,
                label: `split_part_${idx + 1}_pages_${clean}.pdf`,
              };
            } else {
              const pageNum = parseInt(clean, 10) || 1;
              return {
                start: pageNum,
                end: pageNum,
                label: `split_part_${idx + 1}_page_${pageNum}.pdf`,
              };
            }
          });

          const splitResults = await splitPdf(firstFile.data, rangeItems);
          if (splitResults.length === 1) {
            downloadFile(splitResults[0].data, splitResults[0].name);
          } else {
            const zip = new JSZip();
            splitResults.forEach((res) => zip.file(res.name, res.data));
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            downloadFile(zipBlob, `${firstFile.name.replace('.pdf', '')}_split_ranges.zip`, 'application/zip');
          }
        } else if (splitMode === 'extract') {
          const selectedIndices = pages
            .map((p) => (selectedIds.has(p.id) ? p.originalPageIndex : -1))
            .filter((i) => i !== -1);

          if (selectedIndices.length === 0) {
            alert('Please select pages to extract.');
            setIsProcessing(false);
            return;
          }
          const extractedBytes = await extractPages(firstFile.data, selectedIndices);
          downloadFile(extractedBytes, `${firstFile.name.replace('.pdf', '')}_extracted.pdf`);
        }
      }
    } catch (err: any) {
      console.error('Operation failed', err);
      alert(`Operation failed: ${err.message || 'Please check your document'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const activePagesCount = pages.filter((p) => !p.isDeleted).length;
  const deletedPagesCount = pages.filter((p) => p.isDeleted).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-neutral-900 capitalize">
              {toolId.replace('-', ' ')}
            </h2>
            <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5">
              <span>{initialFiles.length} file(s) loaded</span>
              <span aria-hidden="true">·</span>
              <span>{activePagesCount} active pages</span>
              {deletedPagesCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-rose-600 font-medium">
                    {deletedPagesCount} marked for deletion
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Global Toolbar controls depending on tool */}
        <div className="flex flex-wrap items-center gap-2">
          {toolId === 'rotate' && (
            <>
              <button
                onClick={() => handleRotateAll(90)}
                className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Rotate All 90°</span>
              </button>
              <button
                onClick={() => handleRotateAll(180)}
                className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Rotate All 180°</span>
              </button>
            </>
          )}

          {toolId === 'delete-pages' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-white border border-neutral-300 rounded-lg p-1 text-xs">
                <input
                  type="text"
                  value={rangeInput}
                  onChange={(e) => setRangeInput(e.target.value)}
                  placeholder="e.g. 2, 5, 8-12"
                  className="px-2 py-1 outline-none text-neutral-900 w-28 sm:w-36"
                />
                <button
                  onClick={applyDeleteRange}
                  className="px-2 py-1 bg-neutral-900 hover:bg-neutral-800 text-white rounded font-medium"
                >
                  Mark
                </button>
              </div>

              {deletedPagesCount > 0 && (
                <button
                  onClick={undoAllDeletions}
                  className="px-2.5 py-1.5 text-xs text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg flex items-center gap-1"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Restore All</span>
                </button>
              )}
            </div>
          )}

          {toolId === 'merge' && (
            <label className="cursor-pointer px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors">
              <Plus className="w-3.5 h-3.5" />
              <span>Add More PDFs</span>
              <input
                type="file"
                accept=".pdf,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) onAddMoreFiles(Array.from(e.target.files));
                }}
              />
            </label>
          )}

          {(toolId === 'extract-pages' || (toolId === 'split' && splitMode === 'extract')) && (
            <button
              onClick={handleSelectAll}
              className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-medium rounded-lg"
            >
              {selectedIds.size === pages.length ? 'Deselect All' : 'Select All'}
            </button>
          )}

          {/* Primary Action Button */}
          <button
            onClick={handleExecuteOperation}
            disabled={isProcessing || activePagesCount === 0}
            className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 disabled:bg-neutral-400 text-white text-xs sm:text-sm font-semibold rounded-xl flex items-center gap-2 transition-all shadow-sm"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Processing PDF...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>
                  {toolId === 'merge'
                    ? 'Merge PDFs'
                    : toolId === 'delete-pages'
                    ? 'Save & Download'
                    : toolId === 'split'
                    ? 'Split & Download'
                    : toolId === 'extract-pages'
                    ? 'Extract & Download'
                    : 'Download Result'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Split Mode Options Selector */}
      {toolId === 'split' && (
        <div className="mt-4 p-4 bg-white border border-neutral-200 rounded-xl flex flex-wrap items-center gap-4 text-xs">
          <span className="font-semibold text-neutral-800">Split Method:</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSplitMode('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                splitMode === 'all'
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              Split all pages (ZIP)
            </button>
            <button
              onClick={() => setSplitMode('ranges')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                splitMode === 'ranges'
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              Split by page ranges
            </button>
            <button
              onClick={() => setSplitMode('extract')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                splitMode === 'extract'
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              Select pages to extract
            </button>
          </div>

          {splitMode === 'ranges' && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-neutral-500">Ranges:</span>
              <input
                type="text"
                value={splitRangesInput}
                onChange={(e) => setSplitRangesInput(e.target.value)}
                placeholder="e.g. 1-2, 3"
                className="px-2.5 py-1 bg-neutral-50 border border-neutral-300 rounded-lg text-neutral-900 text-xs w-36 outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>
          )}
        </div>
      )}

      {/* Empty State / Upload zone */}
      {initialFiles.length === 0 ? (
        <div className="mt-8">
          <FileDropzone
            multiple={toolId === 'merge'}
            onFilesSelected={onAddMoreFiles}
            onUseSample={onUseSample}
            title={
              toolId === 'merge'
                ? 'Select PDF files to merge'
                : `Upload PDF to ${toolId.replace('-', ' ')}`
            }
          />
        </div>
      ) : (
        /* Visual Page Grid */
        <div className="mt-6">
          {/* Grid Toolbar: Layout, Columns per row, and RTL/LTR Direction */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 bg-white border border-neutral-200 rounded-xl">
            <div className="flex flex-wrap items-center gap-3">
              {/* Columns Per Row Selector */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-neutral-700 flex items-center gap-1">
                  <LayoutGrid className="w-3.5 h-3.5 text-neutral-500" />
                  <span>הצג דפים בשורה:</span>
                </span>
                <div className="flex items-center bg-neutral-100 p-0.5 rounded-lg">
                  {[
                    { id: 1, label: '1 (אחד אחד)', title: 'דף 1 בכל שורה' },
                    { id: 2, label: '2 (שניים שניים)', title: '2 דפים בכל שורה' },
                    { id: 3, label: '3 (שלוש שלוש)', title: '3 דפים בכל שורה' },
                    { id: 4, label: '4', title: '4 דפים בכל שורה' },
                    { id: 6, label: '6', title: '6 דפים בכל שורה' },
                    { id: 'auto', label: 'אוטומטי', title: 'פריסה רספונסיבית' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setColumnsPerRow(item.id as any)}
                      title={item.title}
                      className={`px-2.5 py-1 rounded-md font-medium text-xs transition-colors ${
                        columnsPerRow === item.id
                          ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                          : 'text-neutral-600 hover:text-neutral-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reading Direction Toggle (RTL / LTR) */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-neutral-700">סדר קריאה:</span>
                <button
                  onClick={() => setIsRtlLayout(!isRtlLayout)}
                  className={`px-3 py-1 rounded-lg border font-medium flex items-center gap-1.5 transition-colors ${
                    isRtlLayout
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
                  }`}
                  title={isRtlLayout ? 'הצגה מימין לשמאל פעילה (RTL)' : 'הצגה משמאל לימין פעילה (LTR)'}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  <span>{isRtlLayout ? 'מימין לשמאל (RTL)' : 'משמאל לימין (LTR)'}</span>
                </button>
              </div>
            </div>

            {isLoadingThumbnails && (
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-neutral-700" />
                <span>טוען תצוגה מקדימה...</span>
              </div>
            )}
          </div>

          <p className="text-xs text-neutral-500 mb-3" dir={isRtlLayout ? 'rtl' : 'ltr'}>
            {isRtlLayout
              ? 'גרור תמונות ממוזערות כדי לשנות את סדר הדפים. הדפים מוצגים מימין לשמאל.'
              : 'Drag thumbnails to reorder pages. Use page controls to rotate or delete individual pages.'}
          </p>

          <div
            dir={isRtlLayout ? 'rtl' : 'ltr'}
            className={
              columnsPerRow === 1
                ? 'grid grid-cols-1 max-w-xl mx-auto gap-6'
                : columnsPerRow === 2
                ? 'grid grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto gap-5'
                : columnsPerRow === 3
                ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 max-w-5xl mx-auto gap-5'
                : columnsPerRow === 4
                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4'
                : columnsPerRow === 6
                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5'
                : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-5'
            }
          >
            {pages.map((page, index) => {
              const isSelected = selectedIds.has(page.id);
              const isDraggable = !page.isDeleted;

              return (
                <div
                  key={page.id}
                  draggable={isDraggable}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDrop={() => handleDrop(index)}
                  className={`group relative bg-white rounded-2xl border transition-all duration-150 flex flex-col overflow-hidden ${
                    page.isDeleted
                      ? 'opacity-40 border-dashed border-rose-300 bg-rose-50/20'
                      : isSelected
                      ? 'border-neutral-900 ring-2 ring-neutral-900 shadow-md'
                      : 'border-neutral-200 hover:border-neutral-400 hover:shadow-sm'
                  }`}
                >
                  {/* Card Header with Page Number and Multi-Select */}
                  <div className="p-2.5 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      {(toolId === 'extract-pages' ||
                        (toolId === 'split' && splitMode === 'extract')) && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(page.id)}
                          className="rounded text-neutral-900 focus:ring-0 cursor-pointer"
                        />
                      )}
                      <span className="font-semibold text-neutral-800">
                        {isRtlLayout ? `דף ${index + 1}` : `Page ${index + 1}`}
                      </span>
                    </div>

                    {page.rotation > 0 && (
                      <span className="text-[10px] font-mono text-neutral-500 bg-neutral-200/80 px-1.5 py-0.5 rounded">
                        {page.rotation}°
                      </span>
                    )}
                  </div>

                  {/* Thumbnail Preview with Rotation Transform */}
                  <div
                    className={`relative p-3 flex items-center justify-center bg-neutral-100/40 select-none ${
                      columnsPerRow === 1 ? 'aspect-[3/4] min-h-[380px]' : 'aspect-[3/4]'
                    }`}
                  >
                    {page.thumbnailUrl ? (
                      <img
                        src={page.thumbnailUrl}
                        alt={`Page ${index + 1}`}
                        style={{
                          transform: `rotate(${page.rotation}deg)`,
                          transition: 'transform 0.2s ease',
                        }}
                        className={`max-h-full max-w-full object-contain shadow-xs rounded bg-white ${
                          page.isDeleted ? 'filter grayscale' : ''
                        }`}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-neutral-400">
                        <FileText className="w-8 h-8 stroke-1 mb-1" />
                        <span className="text-[11px]">Loading...</span>
                      </div>
                    )}

                    {page.isDeleted && (
                      <div className="absolute inset-0 bg-rose-500/10 flex items-center justify-center">
                        <span className="px-2 py-1 bg-rose-600 text-white text-[11px] font-bold rounded shadow-sm">
                          {isRtlLayout ? 'נמחק' : 'DELETED'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card Actions Footer */}
                  <div className="p-2 bg-white border-t border-neutral-100 flex items-center justify-between text-neutral-600">
                    {/* Left/Right movement buttons adjusted for visual direction */}
                    {isRtlLayout ? (
                      <div className="flex items-center gap-0.5" dir="ltr">
                        {/* In RTL, clicking Right points to previous item in visual flow */}
                        <button
                          title="הזז ימינה (דף קודם)"
                          disabled={index === 0 || page.isDeleted}
                          onClick={() => handleMovePage(index, index - 1)}
                          className="p-1 hover:bg-neutral-100 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="הזז שמאלה (דף הבא)"
                          disabled={index === pages.length - 1 || page.isDeleted}
                          onClick={() => handleMovePage(index, index + 1)}
                          className="p-1 hover:bg-neutral-100 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-0.5">
                        <button
                          title="Move page left"
                          disabled={index === 0 || page.isDeleted}
                          onClick={() => handleMovePage(index, index - 1)}
                          className="p-1 hover:bg-neutral-100 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          title="Move page right"
                          disabled={index === pages.length - 1 || page.isDeleted}
                          onClick={() => handleMovePage(index, index + 1)}
                          className="p-1 hover:bg-neutral-100 rounded disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      {/* Rotate single page */}
                      <button
                        title={isRtlLayout ? 'סובב 90° עם כיוון השעון' : 'Rotate 90° clockwise'}
                        disabled={page.isDeleted}
                        onClick={() => handleRotatePage(index)}
                        className="p-1.5 hover:bg-neutral-100 rounded hover:text-neutral-900 transition-colors disabled:opacity-30"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>

                      {/* Duplicate page (for reorder tool) */}
                      {toolId === 'reorder' && (
                        <button
                          title={isRtlLayout ? 'שכפל דף זה' : 'Duplicate this page'}
                          disabled={page.isDeleted}
                          onClick={() => handleDuplicatePage(index)}
                          className="p-1.5 hover:bg-neutral-100 rounded hover:text-neutral-900 transition-colors disabled:opacity-30"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete / Undo toggle */}
                      <button
                        title={
                          page.isDeleted
                            ? isRtlLayout ? 'בטל מחיקה' : 'Undo deletion'
                            : isRtlLayout ? 'מחק דף' : 'Delete page'
                        }
                        onClick={() => handleToggleDelete(index)}
                        className={`p-1.5 rounded transition-colors ${
                          page.isDeleted
                            ? 'text-neutral-800 hover:bg-neutral-200'
                            : 'hover:bg-rose-50 hover:text-rose-600'
                        }`}
                      >
                        {page.isDeleted ? (
                          <Undo2 className="w-3.5 h-3.5" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
