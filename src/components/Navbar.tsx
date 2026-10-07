import React from 'react';
import { ShieldCheck, Sparkles } from 'lucide-react';
import { ToolId } from '../types/pdf';

interface NavbarProps {
  activeTool: ToolId | null;
  onSelectTool: (tool: ToolId | null) => void;
  onFilterCategory?: (category: string) => void;
  onLoadSample: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTool,
  onSelectTool,
  onFilterCategory,
  onLoadSample,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Zone 1: Single text element wordmark */}
        <button
          onClick={() => onSelectTool(null)}
          className="flex items-center gap-2.5 text-left group transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center text-white font-bold text-base shadow-sm group-hover:bg-neutral-800 transition-colors">
            O
          </div>
          <span className="text-lg font-bold tracking-tight text-neutral-900">
            OmniPDF
          </span>
        </button>

        {/* Zone 2: 4-6 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-600">
          <button
            onClick={() => {
              onSelectTool(null);
              onFilterCategory?.('all');
            }}
            className={`hover:text-neutral-900 transition-colors ${
              !activeTool ? 'text-neutral-900 font-semibold' : ''
            }`}
          >
            All Tools
          </button>
          <button
            onClick={() => {
              onSelectTool(null);
              onFilterCategory?.('organize');
            }}
            className="hover:text-neutral-900 transition-colors"
          >
            Organize
          </button>
          <button
            onClick={() => {
              onSelectTool(null);
              onFilterCategory?.('edit-sign');
            }}
            className="hover:text-neutral-900 transition-colors"
          >
            Edit & Sign
          </button>
          <button
            onClick={() => {
              onSelectTool(null);
              onFilterCategory?.('convert');
            }}
            className="hover:text-neutral-900 transition-colors"
          >
            Convert
          </button>
          <button
            onClick={() => {
              onSelectTool(null);
              onFilterCategory?.('security');
            }}
            className="hover:text-neutral-900 transition-colors"
          >
            Security
          </button>
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-3">
          <div
            title="All files are processed in your browser memory. Zero files are uploaded to external servers."
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 rounded-md border border-emerald-200/60"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="whitespace-nowrap">100% In-Browser Privacy</span>
          </div>

          <button
            onClick={onLoadSample}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Load Sample PDF</span>
          </button>
        </div>
      </div>
    </header>
  );
};
