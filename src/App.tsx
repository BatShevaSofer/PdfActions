import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { FileDropzone } from './components/FileDropzone';
import { OrganizeWorkspace } from './components/workspaces/OrganizeWorkspace';
import { EditorWorkspace } from './components/workspaces/EditorWorkspace';
import { ConvertWorkspace } from './components/workspaces/ConvertWorkspace';
import { OptimizeWorkspace } from './components/workspaces/OptimizeWorkspace';
import { SecurityWorkspace } from './components/workspaces/SecurityWorkspace';
import { WatermarkWorkspace } from './components/workspaces/WatermarkWorkspace';
import { EditorTool, PdfFileItem, ToolId } from './types/pdf';
import { getPdfInfo } from './lib/pdfjsRenderer';
import { createSampleDocument } from './lib/pdfEngine';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function App() {
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [files, setFiles] = useState<PdfFileItem[]>([]);
  const [isLoadingSample, setIsLoadingSample] = useState(false);

  // Helper to process uploaded File objects into PdfFileItems
  const processUploadedFiles = async (
    uploaded: File[],
    append: boolean = false
  ): Promise<PdfFileItem[]> => {
    const newItems: PdfFileItem[] = [];

    for (const file of uploaded) {
      const buffer = await file.arrayBuffer();
      try {
        const info = await getPdfInfo(buffer);
        newItems.push({
          id: `file-${Date.now()}-${Math.random()}`,
          name: file.name,
          size: file.size,
          data: buffer,
          pageCount: info.pageCount,
          dimensions: info.dimensions.map((d) => ({
            width: d.width,
            height: d.height,
          })),
        });
      } catch (err) {
        console.error('Failed to parse PDF', file.name, err);
        alert(`Could not parse ${file.name}. Ensure it is a valid PDF.`);
      }
    }

    if (append) {
      setFiles((prev) => [...prev, ...newItems]);
    } else {
      setFiles(newItems);
    }
    return newItems;
  };

  // Load Built-in Demo PDF
  const handleLoadSample = async (targetTool?: ToolId) => {
    setIsLoadingSample(true);
    try {
      const sampleBytes = await createSampleDocument();
      // Ensure we pass an independent ArrayBuffer copy
      const buffer = sampleBytes.buffer.slice(
        sampleBytes.byteOffset,
        sampleBytes.byteOffset + sampleBytes.byteLength
      ) as ArrayBuffer;

      const info = await getPdfInfo(buffer);

      const sampleItem: PdfFileItem = {
        id: `sample-${Date.now()}`,
        name: 'OmniPDF_Sample_Proposal.pdf',
        size: sampleBytes.byteLength,
        data: buffer,
        pageCount: info.pageCount,
        dimensions: info.dimensions.map((d) => ({
          width: d.width,
          height: d.height,
        })),
      };

      setFiles([sampleItem]);
      if (targetTool) {
        setActiveTool(targetTool);
      } else if (!activeTool) {
        setActiveTool('edit');
      }
    } catch (err) {
      console.error('Failed to create sample document', err);
    } finally {
      setIsLoadingSample(false);
    }
  };

  // Select tool from Dashboard
  const handleSelectTool = (toolId: ToolId) => {
    setActiveTool(toolId);
  };

  // Files selected from Dropzone inside a workspace
  const handleWorkspaceFilesSelected = async (selected: File[]) => {
    const isMultiple = activeTool === 'merge';
    await processUploadedFiles(selected, isMultiple && files.length > 0);
  };

  // Determine active workspace view
  const renderWorkspace = () => {
    if (!activeTool) return null;

    // 1. Organize Family (Merge, Split, Delete Pages, Reorder, Rotate, Extract)
    if (
      [
        'merge',
        'split',
        'delete-pages',
        'extract-pages',
        'reorder',
        'rotate',
      ].includes(activeTool)
    ) {
      return (
        <OrganizeWorkspace
          toolId={activeTool}
          initialFiles={files}
          onBack={() => setActiveTool(null)}
          onAddMoreFiles={(extra) => processUploadedFiles(extra, true)}
          onUseSample={() => handleLoadSample(activeTool)}
        />
      );
    }

    // 2. Edit & Sign Family
    if (['edit', 'text', 'annotate', 'sign', 'fill'].includes(activeTool)) {
      if (files.length === 0) {
        return (
          <div className="max-w-3xl mx-auto px-4 py-12">
            <button
              onClick={() => setActiveTool(null)}
              className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 mb-6 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to all tools</span>
            </button>
            <h2 className="text-xl font-bold text-neutral-900 mb-2 capitalize">
              {activeTool.replace('-', ' ')}
            </h2>
            <p className="text-xs text-neutral-500 mb-6">
              Upload a document to start editing, signing, or annotating pages.
            </p>
            <FileDropzone
              onFilesSelected={handleWorkspaceFilesSelected}
              onUseSample={() => handleLoadSample(activeTool)}
              title="Select PDF to edit"
            />
          </div>
        );
      }

      const defaultTool: EditorTool =
        activeTool === 'text'
          ? 'text'
          : activeTool === 'annotate'
          ? 'highlighter'
          : activeTool === 'sign'
          ? 'signature'
          : activeTool === 'fill'
          ? 'form-text'
          : 'select';

      return (
        <EditorWorkspace
          initialFile={files[0]}
          defaultTool={defaultTool}
          onBack={() => setActiveTool(null)}
        />
      );
    }

    // 3. Convert Family
    if (activeTool === 'pdf-to-img' || activeTool === 'img-to-pdf') {
      if (activeTool === 'pdf-to-img' && files.length === 0) {
        return (
          <div className="max-w-3xl mx-auto px-4 py-12">
            <button
              onClick={() => setActiveTool(null)}
              className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 mb-6 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to all tools</span>
            </button>
            <h2 className="text-xl font-bold text-neutral-900 mb-2">Convert PDF to Images</h2>
            <p className="text-xs text-neutral-500 mb-6">
              Select a PDF file to extract all pages as high-resolution JPG or PNG images.
            </p>
            <FileDropzone
              onFilesSelected={handleWorkspaceFilesSelected}
              onUseSample={() => handleLoadSample(activeTool)}
              title="Select PDF to convert"
            />
          </div>
        );
      }

      return (
        <ConvertWorkspace
          toolId={activeTool}
          initialPdf={files[0]}
          onBack={() => setActiveTool(null)}
          onUseSample={() => handleLoadSample(activeTool)}
        />
      );
    }

    // 4. Optimize (Compress PDF)
    if (activeTool === 'compress') {
      if (files.length === 0) {
        return (
          <div className="max-w-3xl mx-auto px-4 py-12">
            <button
              onClick={() => setActiveTool(null)}
              className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 mb-6 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to all tools</span>
            </button>
            <h2 className="text-xl font-bold text-neutral-900 mb-2">Compress PDF</h2>
            <p className="text-xs text-neutral-500 mb-6">
              Reduce file size while preserving high visual resolution.
            </p>
            <FileDropzone
              onFilesSelected={handleWorkspaceFilesSelected}
              onUseSample={() => handleLoadSample(activeTool)}
              title="Select PDF to compress"
            />
          </div>
        );
      }

      return (
        <OptimizeWorkspace
          initialFile={files[0]}
          onBack={() => setActiveTool(null)}
        />
      );
    }

    // 5. Watermark & Page Numbers
    if (activeTool === 'watermark' || activeTool === 'page-numbers') {
      if (files.length === 0) {
        return (
          <div className="max-w-3xl mx-auto px-4 py-12">
            <button
              onClick={() => setActiveTool(null)}
              className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 mb-6 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to all tools</span>
            </button>
            <h2 className="text-xl font-bold text-neutral-900 mb-2 capitalize">
              {activeTool.replace('-', ' ')}
            </h2>
            <p className="text-xs text-neutral-500 mb-6">
              Stamp custom text or page numbers across pages with live real-time preview.
            </p>
            <FileDropzone
              onFilesSelected={handleWorkspaceFilesSelected}
              onUseSample={() => handleLoadSample(activeTool)}
              title={`Select PDF for ${activeTool.replace('-', ' ')}`}
            />
          </div>
        );
      }

      return (
        <WatermarkWorkspace
          toolId={activeTool}
          initialFile={files[0]}
          onBack={() => setActiveTool(null)}
        />
      );
    }

    // 6. Security (Protect, Unlock, Metadata)
    if (['protect', 'unlock', 'metadata'].includes(activeTool)) {
      if (files.length === 0) {
        return (
          <div className="max-w-3xl mx-auto px-4 py-12">
            <button
              onClick={() => setActiveTool(null)}
              className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-900 mb-6 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to all tools</span>
            </button>
            <h2 className="text-xl font-bold text-neutral-900 mb-2 capitalize">
              {activeTool === 'protect'
                ? 'Encrypt PDF'
                : activeTool === 'unlock'
                ? 'Unlock PDF'
                : 'PDF Metadata'}
            </h2>
            <p className="text-xs text-neutral-500 mb-6">
              {activeTool === 'protect'
                ? 'Add password protection to restrict document viewing.'
                : activeTool === 'unlock'
                ? 'Remove known password from protected PDF.'
                : 'View and edit document title, author, and metadata.'}
            </p>
            <FileDropzone
              onFilesSelected={handleWorkspaceFilesSelected}
              onUseSample={() => handleLoadSample(activeTool)}
              title={`Select PDF for ${activeTool}`}
            />
          </div>
        );
      }

      return (
        <SecurityWorkspace
          toolId={activeTool as any}
          initialFile={files[0]}
          onBack={() => setActiveTool(null)}
        />
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col font-sans">
      {/* Top Bar adhering to the Top Bar Contract */}
      <Navbar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        onFilterCategory={setActiveCategory}
        onLoadSample={() => handleLoadSample()}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {isLoadingSample && (
          <div className="fixed inset-0 z-50 bg-white/70 backdrop-blur-xs flex items-center justify-center">
            <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl shadow-lg border border-neutral-200 text-sm font-medium text-neutral-900">
              <Loader2 className="w-5 h-5 animate-spin text-neutral-900" />
              <span>Generating Sample Document...</span>
            </div>
          </div>
        )}

        {activeTool ? (
          renderWorkspace()
        ) : (
          <Dashboard
            onSelectTool={handleSelectTool}
            onLoadSampleForTool={handleLoadSample}
            activeCategory={activeCategory}
            onCategoryChange={setActiveCategory}
          />
        )}
      </main>

      {/* Clean quiet Footer adhering to Section 1.B */}
      {!activeTool && (
        <footer className="border-t border-neutral-200/80 bg-white py-8 text-center text-xs text-neutral-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-neutral-900">OmniPDF</span>
              <span aria-hidden="true">·</span>
              <span>All PDF operations run locally in browser memory</span>
            </div>
            <div className="flex items-center gap-4 text-neutral-500">
              <span>Zero server retention</span>
              <span aria-hidden="true">·</span>
              <span>No account required</span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
